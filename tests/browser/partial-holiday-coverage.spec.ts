import { expect, test } from "@playwright/test";
import { createCalendarBrowserFixture } from "./calendar-fixture";
import type {} from "./calendar-entry";

test("shows known Mexico dates without hiding the incomplete 2028 coverage notice", async ({ page }) => {
  const fixture = await createCalendarBrowserFixture();
  await page.setContent(fixture.html);
  await page.addScriptTag({ content: fixture.script });
  await page.evaluate(() => window.mountChronoCalendar("es-ES", 420, {
    navigationDate: { year: 2028, month: 9, day: 16 },
    configure: (settings) => { settings.holidayRegions = ["mx"]; },
  }));

  await expect(page.getByRole("note").filter({
    hasText: /Faltan los calendarios completos de festivos de 2028.*México/u,
  })).toBeVisible();
  const holiday = page.getByRole("gridcell", { name: /Día de la Independencia/u });
  await expect(holiday).toBeVisible();
  await expect(holiday).toHaveAttribute("data-regional-marker", "holiday");
});
