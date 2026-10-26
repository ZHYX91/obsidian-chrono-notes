import { expect, test } from "@playwright/test";
import { createCalendarBrowserFixture } from "./calendar-fixture";
import type {} from "./calendar-entry";

let fixture: Awaited<ReturnType<typeof createCalendarBrowserFixture>>;
test.beforeAll(async () => { fixture = await createCalendarBrowserFixture(); });

const longTitles = [
  "Review every outstanding project decision with the complete team before the next milestone",
  "很长的日程标题，完整内容保留在所选日期详情中",
  "مراجعة جميع قرارات المشروع مع الفريق قبل الموعد النهائي",
];

for (const width of [320, 360, 600]) {
  for (const locale of ["en", "ar"] as const) {
    test(`keeps month events compact and complete at ${width}px in ${locale}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1_000 });
      await page.setContent(fixture.html);
      await page.addStyleTag({ content: "body{margin:0} #calendar-fixture{padding:0;border:0;height:auto}" });
      await page.addScriptTag({ content: fixture.script });
      await page.evaluate(({ locale, width, titles }) => window.mountChronoCalendar(locale, width, titles), {
        locale, width, titles: longTitles,
      });
      const selected = page.locator(".chrono-notes-day.is-selected");
      const events = selected.locator(".chrono-notes-ics-event:visible");
      const overflow = selected.locator(".chrono-notes-ics-more:visible");
      await expect(events).toHaveCount(width < 560 ? 1 : 3);
      await expect(overflow).toHaveText(width < 560 ? "+4" : "+2");
      const details = page.locator(".chrono-notes-selected-day-details");
      for (const title of ["Team review", "Project planning", ...longTitles]) {
        await expect(selected).toHaveAccessibleName(new RegExp(title));
        await expect(details).toContainText(title);
      }
      await expect(details).toContainText("example.ics");
      const geometry = await selected.evaluate((cell) => {
        const events = [...cell.querySelectorAll<HTMLElement>(".chrono-notes-ics-event")]
          .filter((element) => getComputedStyle(element).display !== "none");
        const count = [...cell.querySelectorAll<HTMLElement>(".chrono-notes-ics-more")]
          .find((element) => getComputedStyle(element).display !== "none")!;
        const box = (element: Element) => {
          const rect = element.getBoundingClientRect();
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
        };
        return {
          cell: box(cell), count: box(count), first: box(events[0]!),
          text: box(events.at(-1)!.querySelector(".chrono-notes-ics-event-text")!),
          fits: document.documentElement.scrollWidth <= innerWidth,
          ellipsis: events.every((event) => getComputedStyle(event.querySelector(".chrono-notes-ics-event-text")!).textOverflow === "ellipsis"),
        };
      });
      expect(geometry.fits).toBe(true);
      expect(geometry.ellipsis).toBe(true);
      expect(geometry.first.right).toBeLessThanOrEqual(geometry.cell.right);
      expect(geometry.first.left).toBeGreaterThanOrEqual(geometry.cell.left);
      expect(geometry.count.left).toBeGreaterThanOrEqual(geometry.cell.left);
      expect(geometry.count.right).toBeLessThanOrEqual(geometry.cell.right);
      if (width < 560) {
        expect(geometry.count.top).toBeGreaterThanOrEqual(geometry.first.bottom);
      } else if (locale === "ar") {
        expect(geometry.text.left).toBeGreaterThanOrEqual(geometry.count.right);
      } else {
        expect(geometry.text.right).toBeLessThanOrEqual(geometry.count.left);
      }

      await selected.focus();
      await page.keyboard.press("ArrowDown");
      await expect(selected).toHaveAttribute("aria-labelledby", /-2026-10-27-label$/u);
      await page.keyboard.press("ArrowUp");
      await expect(selected).toHaveAttribute("aria-labelledby", /-2026-10-20-label$/u);
      await expect(page.locator('.chrono-notes-day[tabindex="0"]')).toHaveCount(1);
      for (const title of longTitles) await expect(details).toContainText(title);
    });
  }
}
