import { expect, test } from "@playwright/test";
import { createCalendarBrowserFixture } from "./calendar-fixture";
import type {} from "./calendar-entry";

let fixture: Awaited<ReturnType<typeof createCalendarBrowserFixture>>;
test.beforeAll(async () => { fixture = await createCalendarBrowserFixture(); });

for (const [locale, mobile] of [["en", false], ["ar", true]] as const) {
  test(`mini calendar month navigation in ${locale} preserves focus and follows the visible grid`, async ({ page }) => {
    await page.setViewportSize({ width: mobile ? 320 : 800, height: 700 });
    await page.setContent(fixture.html);
    await page.addScriptTag({ content: fixture.script });
    await page.evaluate(({ locale, mobile }) => window.mountChronoMiniCalendar(locale, mobile), { locale, mobile });
    const day = page.getByRole("gridcell", { name: "2026-10-01", exact: true });
    await expect(day).toBeFocused();
    const trigger = page.locator(".chrono-notes-mini-calendar-period-trigger");
    await trigger.click();
    const picker = page.locator(".chrono-notes-mini-calendar-period-picker");
    const months = picker.locator(".chrono-notes-mini-calendar-month-grid button");
    await expect(months.nth(9)).toBeFocused();
    await expect(picker).toHaveCSS("direction", locale === "ar" ? "rtl" : "ltr");
    await expect(picker.locator(".chrono-notes-mini-calendar-month-grid [tabindex='0']")).toHaveCount(1);
    await page.keyboard.press("Home");
    await expect(months.first()).toBeFocused();
    await page.keyboard.press(locale === "ar" ? "ArrowLeft" : "ArrowRight");
    await expect(months.nth(1)).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(months.nth(5)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(picker).toHaveCount(0);
    await trigger.press("Enter");
    await expect(months.nth(9)).toBeFocused();
    await page.keyboard.press("End");
    await months.last().press("Enter");
    await expect(page.getByRole("gridcell", { name: "2026-12-01", exact: true })).toBeFocused();
    // Returning to the initially selected day with a header button must not steal its focus.
    const previous = page.locator(".chrono-notes-mini-calendar-navigation > button").first();
    await previous.click();
    await previous.click();
    await expect(day).toBeVisible();
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(previous).toBeFocused();
  });
}
