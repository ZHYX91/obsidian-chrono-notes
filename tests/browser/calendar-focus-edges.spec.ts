import { expect, test, type Locator, type Page } from "@playwright/test";
import { createCalendarBrowserFixture } from "./calendar-fixture";
import type {} from "./calendar-entry";

let fixture: Awaited<ReturnType<typeof createCalendarBrowserFixture>>;
test.beforeAll(async () => { fixture = await createCalendarBrowserFixture(); });

async function mountCalendar(page: Page, locale: "en" | "ar", width: number) {
  await page.setContent(fixture.html);
  await page.addStyleTag({ content: "#calendar-fixture { height: 420px; padding: 0; border: 0; }" });
  await page.addScriptTag({ content: fixture.script });
  await page.evaluate(({ locale, width }) => window.mountChronoCalendar(locale, width), { locale, width });
}

async function expectFrameInsideScrollport(button: Locator, scrollport: string, extent: number) {
  await expect(button).toBeFocused();
  const clearance = await button.evaluate((element, selector) => {
    const port = element.closest<HTMLElement>(selector)!;
    const rect = port.getBoundingClientRect();
    const cell = element.getBoundingClientRect();
    const left = rect.left + port.clientLeft;
    const top = rect.top + port.clientTop;
    return Math.min(cell.left - left, cell.top - top,
      left + port.clientWidth - cell.right, top + port.clientHeight - cell.bottom);
  }, scrollport);
  expect(clearance).toBeGreaterThanOrEqual(extent - 0.5);
}

// Sample the straight part of each edge in the rendered page, including ancestor clipping.
async function expectPaintedFrame(page: Page, button: Locator, distance: number) {
  const box = await button.boundingBox();
  if (box === null) throw new Error("Button has no visible bounds");
  const image = (await page.screenshot({ scale: "css" })).toString("base64");
  const accent = await button.evaluate((element) => getComputedStyle(element).getPropertyValue("--interactive-accent"));
  const result = await page.evaluate(async ({ image, box, distance, accent }) => {
    const bitmap = new Image();
    bitmap.src = "data:image/png;base64," + image;
    await bitmap.decode();
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const middleX = box.x + box.width / 2;
    const middleY = box.y + box.height / 2;
    const points = [[box.x - distance, middleY], [box.x + box.width + distance, middleY],
      [middleX, box.y - distance], [middleX, box.y + box.height + distance]] as const;
    const pixel = (x: number, y: number) => Array.from(ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data);
    const colors = points.map(([x, y]) => pixel(x, y));
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, 1, 1);
    return { colors, expected: pixel(0, 0) };
  }, { image, box, distance, accent });
  for (const [index, color] of result.colors.entries()) {
    expect(color, ["left", "right", "top", "bottom"][index]).toEqual(result.expected);
  }
}

for (const [locale, width, columns] of [["en", 520, 5], ["ar", 252, 2]] as const) {
  test(`century selection and keyboard frames survive scrolling in ${locale}`, async ({ page }) => {
    await mountCalendar(page, locale, width);
    await page.locator(".chrono-notes-view-mode button").last().click();
    const port = ".chrono-notes-long-period";
    const list = page.locator(port);
    const decade = list.locator('[data-period-kind="decade"]').first();
    await list.evaluate((element) => { element.scrollTop = 0; });
    await decade.click();
    await expect(decade).toHaveAttribute("aria-pressed", "true");
    await expectPaintedFrame(page, decade, 1);
    await decade.press("Home");
    await expect(decade).toHaveCSS("outline-offset", "3px");
    await expectFrameInsideScrollport(decade, port, 5);
    await expectPaintedFrame(page, decade, 4);
    await decade.press("ArrowDown");
    await expect(list.locator('[data-period-kind="decade"][data-period-year="2010"]')).toBeFocused();
    await expect(decade).toHaveAttribute("aria-pressed", "true");
    for (let year = 2020; year <= 2050; year += 10) await page.keyboard.press("ArrowDown");
    const nextDecade = list.locator('[data-period-kind="decade"][data-period-year="2060"]');
    // The next button is fully visible, but its outer frame still needs scrolling into view.
    await nextDecade.evaluate((button) => {
      const scroller = button.closest<HTMLElement>(".chrono-notes-long-period")!;
      const bottom = scroller.getBoundingClientRect().top + scroller.clientTop + scroller.clientHeight;
      scroller.scrollTop += button.getBoundingClientRect().bottom - (bottom - 1);
    });
    await page.keyboard.press("ArrowDown");
    await expectFrameInsideScrollport(nextDecade, port, 5);
    await page.keyboard.press("End");
    const lastYear = list.locator('[data-period-kind="year"]').last();
    await expectFrameInsideScrollport(lastYear, port, 5);
    expect(await list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    const firstYear = list.locator('[data-period-kind="year"]').first();
    await page.keyboard.press("Home");
    await page.keyboard.press(locale === "ar" ? "ArrowLeft" : "ArrowRight");
    await expect(firstYear).toBeFocused();
    await firstYear.press("ArrowDown");
    await expect(list.locator(`[data-period-kind="year"][data-period-year="${2001 + columns}"]`)).toBeFocused();
    await expect(decade).toHaveAttribute("aria-pressed", "true");
  });
}

test("view buttons paint their own focus frame before and after wrapping", async ({ page }) => {
  await mountCalendar(page, "en", 520);
  const group = page.locator(".chrono-notes-view-mode");
  const buttons = group.getByRole("button");
  await buttons.first().click();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(buttons.first()).toBeFocused();
  await expectPaintedFrame(page, buttons.first(), 2);
  await group.evaluate((element) => { element.style.maxWidth = "130px"; });
  for (let index = 1; index < await buttons.count(); index++) await page.keyboard.press("Tab");
  await expect(buttons.last()).toBeFocused();
  expect((await buttons.last().boundingBox())!.y).toBeGreaterThan((await buttons.first().boundingBox())!.y);
  await expectPaintedFrame(page, buttons.last(), 2);
});

test("week picker scrolls the full keyboard frame into view at both ends", async ({ page }) => {
  await mountCalendar(page, "en", 520);
  await page.locator(".chrono-notes-view-mode").getByRole("button", { name: "Week", exact: true }).click();
  const trigger = page.getByRole("button", { name: /^Choose a week:/ });
  await trigger.click();
  const port = ".chrono-notes-week-picker-grid";
  const weeks = page.locator(port).getByRole("button");
  await page.keyboard.press("Home");
  await expectFrameInsideScrollport(weeks.first(), port, 3);
  await page.keyboard.press("End");
  await expectFrameInsideScrollport(weeks.last(), port, 3);
  await expectPaintedFrame(page, weeks.last(), 2);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("forced colors distinguish selection from focus after keyboard navigation", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await mountCalendar(page, "en", 520);
  const modes = page.locator(".chrono-notes-view-mode");
  await modes.getByRole("button", { name: "Century" }).click();
  const decades = page.locator('[data-period-kind="decade"]');
  await decades.first().click();
  await decades.first().press("Home");
  await expect(decades.first()).toHaveCSS("outline-style", "double");
  await expectFrameInsideScrollport(decades.first(), ".chrono-notes-long-period", 6);
  await page.keyboard.press("ArrowDown");
  await expect(decades.first()).toHaveAttribute("aria-pressed", "true");
  await expect(decades.first()).toHaveCSS("outline-width", "2px");
  await expect(decades.nth(1)).toBeFocused();
  await expect(decades.nth(1)).toHaveCSS("outline-offset", "3px");
  await modes.getByRole("button", { name: "Week", exact: true }).click();
  await page.getByRole("button", { name: /^Choose a week:/ }).click();
  const selected = page.locator(".chrono-notes-week-picker-grid button.is-selected");
  await page.keyboard.press("Home");
  await expect(selected).toHaveAttribute("aria-pressed", "true");
  expect(await selected.evaluate((button) => getComputedStyle(button, "::after").borderTopStyle)).toBe("solid");
});
