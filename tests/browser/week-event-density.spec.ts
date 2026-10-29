import { expect, test } from "@playwright/test";
import { createCalendarBrowserFixture } from "./calendar-fixture";
import type {} from "./calendar-entry";

let fixture: Awaited<ReturnType<typeof createCalendarBrowserFixture>>;
test.beforeAll(async () => { fixture = await createCalendarBrowserFixture(); });

for (const width of [400, 600]) {
  for (const locale of ["en", "ar"] as const) {
    test(`separates weekly event titles and counts at ${width}px in ${locale}`, async ({ page }) => {
      await page.setContent(fixture.html);
      await page.addStyleTag({ content: "body{margin:0} #calendar-fixture{padding:0;border:0;height:auto}" });
      await page.addScriptTag({ content: fixture.script });
      const title = "Review every outstanding project decision with the complete team before the next milestone";
      await page.evaluate(({ locale, width, title }) => window.mountChronoCalendar(locale, width, [title, title]), {
        locale, width, title,
      });
      await page.getByRole("button", { name: locale === "en" ? "Week" : "الأسبوع", exact: true }).click();
      const selected = page.locator(".chrono-notes-week-day.is-selected");
      const events = selected.locator(".chrono-notes-ics-event:visible");
      const overflow = selected.locator(".chrono-notes-ics-more:visible");
      await expect(events).toHaveCount(width < 560 ? 1 : 3);
      await expect(overflow).toHaveText(width < 560 ? "+3" : "+1");
      const geometry = await selected.evaluate((cell) => {
        const events = [...cell.querySelectorAll<HTMLElement>(".chrono-notes-ics-event")]
          .filter((element) => getComputedStyle(element).display !== "none");
        const count = [...cell.querySelectorAll<HTMLElement>(".chrono-notes-ics-more")]
          .find((element) => getComputedStyle(element).display !== "none")!;
        const box = (element: Element) => {
          const rect = element.getBoundingClientRect();
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
        };
        return { event: box(events.at(-1)!), text: box(events.at(-1)!.querySelector(".chrono-notes-ics-event-text")!), count: box(count) };
      });
      if (width < 560) expect(geometry.count.top).toBeGreaterThanOrEqual(geometry.event.bottom);
      else if (locale === "ar") expect(geometry.text.left).toBeGreaterThanOrEqual(geometry.count.right);
      else expect(geometry.text.right).toBeLessThanOrEqual(geometry.count.left);
      await expect(selected).toHaveAccessibleName(new RegExp(title));
      await page.getByRole("button", { name: locale === "en" ? "Month" : "الشهر", exact: true }).click();
      await expect(page.locator(".chrono-notes-selected-day-details")).toContainText(title);
    });
  }
}
