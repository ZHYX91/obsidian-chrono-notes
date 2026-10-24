import { expect, test } from "@playwright/test";
import { createCalendarBrowserFixture } from "./calendar-fixture";
import type {} from "./calendar-entry";

let fixture: Awaited<ReturnType<typeof createCalendarBrowserFixture>>;
test.beforeAll(async () => { fixture = await createCalendarBrowserFixture(); });

test.describe("narrow weekly task controls", () => {
  test.use({ viewport: { width: 360, height: 1000 }, hasTouch: true });

  for (const locale of ["en", "de-DE"] as const) {
    test(`keeps long text readable beside independent touch and keyboard targets: ${locale}`, async ({ page }) => {
      await page.setContent(fixture.html);
      // Include the host's centered flex-button presentation that used to clip
      // the start of task text, with a full-width 360px mobile sidebar.
      await page.addStyleTag({ content: "body{margin:0} button:not(.clickable-icon){display:inline-flex;align-items:center;justify-content:center} #calendar-fixture{height:auto}" });
      await page.addScriptTag({ content: fixture.script });
      await page.evaluate((language) => window.mountChronoTaskLayout(360, language), locale);
      expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
      const row = page.locator('.chrono-notes-week-task[data-overdue="severe"]');
      await expect(row).toHaveCount(1);
      const source = row.locator(".chrono-notes-week-task-source");
      const date = row.getByRole("combobox");
      const checkbox = row.getByRole("checkbox");
      const geometry = await row.evaluate((element) => {
        const source = element.querySelector<HTMLButtonElement>(".chrono-notes-week-task-source")!;
        const date = element.querySelector<HTMLSelectElement>("select")!;
        const toggle = element.querySelector<HTMLElement>(".chrono-notes-week-task-toggle")!;
        const meta = element.querySelector<HTMLElement>(".chrono-notes-week-task-meta")!;
        const box = (node: Element) => {
          const rect = node.getBoundingClientRect();
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
        };
        const prefix = document.createRange();
        prefix.setStart(source.firstChild!, 0);
        prefix.setEnd(source.firstChild!, 24);
        const range = prefix.getBoundingClientRect();
        return { row: box(element), source: box(source), date: box(date), toggle: box(toggle), meta: box(meta),
          prefix: { left: range.left, right: range.right }, sourceOverflow: source.scrollWidth > source.clientWidth,
          metaFits: meta.scrollWidth <= meta.clientWidth, documentFits: document.documentElement.scrollWidth <= innerWidth,
          ellipsis: getComputedStyle(source).textOverflow };
      });
      expect(geometry.source.width).toBeGreaterThanOrEqual(200);
      expect(geometry.source.height).toBeGreaterThanOrEqual(44);
      expect(geometry.date.height).toBeGreaterThanOrEqual(44);
      expect(geometry.date.width).toBeGreaterThanOrEqual(44);
      expect(geometry.toggle.width).toBeGreaterThanOrEqual(44);
      expect(geometry.date.top).toBeGreaterThanOrEqual(geometry.source.bottom);
      expect(geometry.meta.top).toBeGreaterThanOrEqual(geometry.source.bottom);
      expect(geometry.date.right).toBeLessThanOrEqual(geometry.meta.left);
      expect(geometry.prefix.left).toBeGreaterThanOrEqual(geometry.source.left);
      expect(geometry.prefix.right).toBeLessThanOrEqual(geometry.source.right);
      expect(geometry.source.right).toBeLessThanOrEqual(geometry.row.right);
      expect(geometry.sourceOverflow).toBe(true);
      expect(geometry.ellipsis).toBe("ellipsis");
      expect(geometry.metaFits).toBe(true);
      expect(geometry.documentFits).toBe(true);
      await expect(source).toHaveAccessibleName(/Review the current period and reconcile every outstanding project decision/);
      await expect(checkbox).toHaveAccessibleName(locale === "en" ? /seriously overdue/ : /überfällig/);
      await expect(date.locator("option")).toHaveCount(7);
      await expect(date.locator("option:checked")).toHaveText("12/30");

      await source.tap();
      await expect.poll(() => page.evaluate(() => window.chronoTaskActions)).toEqual(["source:tab"]);
      await checkbox.tap();
      await expect.poll(() => page.evaluate(() => window.chronoTaskActions)).toEqual(["source:tab", "toggle"]);
      await expect(checkbox).toBeEnabled();
      await checkbox.focus();
      await page.keyboard.press("Tab");
      await expect(date).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(source).toBeFocused();
      await page.keyboard.press("Enter");
      await expect.poll(() => page.evaluate(() => window.chronoTaskActions.filter((item) => item === "source:tab").length)).toBe(2);
      await date.focus();
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await expect.poll(() => page.evaluate(() => window.chronoTaskActions)).toContain("date:31");
      await expect(page.locator('.chrono-notes-week-task[data-overdue="none"] .chrono-notes-week-task-source')).toBeVisible();
    });
  }
});

test("retains the single-row task layout in a wide desktop calendar", async ({ page }) => {
  await page.setContent(fixture.html);
  await page.addScriptTag({ content: fixture.script });
  await page.evaluate(() => window.mountChronoTaskLayout(840, "en"));
  const row = page.locator('.chrono-notes-week-task[data-overdue="severe"]');
  const boxes = await row.evaluate((element) => [...element.children].map((child) => {
    const rect = child.getBoundingClientRect();
    return { left: rect.left, right: rect.right, center: (rect.top + rect.bottom) / 2 };
  }));
  expect(boxes).toHaveLength(4);
  for (let index = 1; index < boxes.length; index += 1) {
    expect(boxes[index]!.left).toBeGreaterThanOrEqual(boxes[index - 1]!.right);
    expect(Math.abs(boxes[index]!.center - boxes[0]!.center)).toBeLessThan(1);
  }
});
