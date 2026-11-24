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
  const colors = await page.evaluate(async ({ image, box, distance }) => {
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
    return points.map(([x, y]) => Array.from(ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data));
  }, { image, box, distance });
  const accent = [113, 85, 216, 255]; // --interactive-accent in the browser fixture.
  expect(colors).toEqual([accent, accent, accent, accent]);
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
