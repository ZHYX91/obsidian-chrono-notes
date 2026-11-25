import { expect, test, type Locator } from "@playwright/test";
import { createCalendarBrowserFixture } from "./calendar-fixture";
import type {} from "./calendar-entry";

let fixture: Awaited<ReturnType<typeof createCalendarBrowserFixture>>;
test.beforeAll(async () => { fixture = await createCalendarBrowserFixture(); });
test.beforeEach(async ({ page }) => {
  await page.setContent(fixture.html);
  await page.addScriptTag({ content: fixture.script });
});

async function expectAlignment(
  cell: Locator, offset: number, marker: "state" | "progress" | null,
) {
  const label = cell.locator(".chrono-notes-period-cell-label, .chrono-notes-week-number-label");
  const indicator = cell.locator(".chrono-notes-calendar-indicator");
  await expect(label).toBeVisible();
  if (marker === null) await expect(indicator).toHaveCount(0);
  else await expect(indicator).toHaveClass(new RegExp(`\\bis-${marker}\\b`));

  const geometry = await cell.evaluate((button) => {
    const box = button.getBoundingClientRect();
    const text = button.querySelector(".chrono-notes-period-cell-label, .chrono-notes-week-number-label")!.getBoundingClientRect();
    const mark = button.querySelector(".chrono-notes-calendar-indicator")?.getBoundingClientRect();
    const row = button.closest(".chrono-notes-year-summary-row")?.getBoundingClientRect();
    return {
      offset: text.top - box.top + (text.height - box.height) / 2,
      gap: mark ? text.top - mark.bottom : null,
      labelY: row ? text.top - row.top : null,
      height: box.height,
    };
  });
  expect(geometry.offset).toBeCloseTo(offset, 1);
  if (marker !== null) expect(geometry.gap).toBeCloseTo(4, 1);
  return geometry;
}

test("week numbers switch between optical and geometric centering in the monthly heatmap", async ({ page }) => {
  await page.evaluate(() => window.mountChronoCalendar("en", 520));
  const week = page.locator(".chrono-notes-week-number-button").first();
  const toggle = page.locator(".chrono-notes-heatmap-toggle");
  await expectAlignment(week, 2, "state");
  await toggle.click();
  await expectAlignment(week, 0, null);
  await toggle.click();
  await expectAlignment(week, 2, "state");
});

test("quarters and months share one baseline across status, progress and hidden indicators", async ({ page }) => {
  const previousHeights: number[] = [];
  for (const mode of ["progress", "state", "hidden", "heatmap"] as const) {
    await page.evaluate((mode) => window.mountChronoCalendar("en", 520, {
      configure(settings, addNote) {
        settings.showNoteIndicators = mode !== "hidden";
        settings.showTaskProgress = mode !== "state";
        settings.yearViewHeatmap = mode === "heatmap";
        addNote("Months/2026-10.md", "- [ ] Publish the October review");
      },
    }), mode);
    await page.getByRole("button", { name: "Year", exact: true }).click();
    const marked = mode === "progress" || mode === "state";
    const quarter = page.locator('[data-period-kind="quarter"][data-period-month="10"]');
    const quarterBox = await expectAlignment(quarter, marked ? 2 : 0, null);
    for (const month of [10, 11, 12]) {
      const cell = page.locator(`[data-period-kind="month"][data-period-month="${month}"]`);
      const marker = marked ? (month === 10 && mode === "progress" ? "progress" : "state") : null;
      const box = await expectAlignment(cell, marked ? 2 : 0, marker);
      if (mode !== "heatmap") {
        expect(box.labelY).toBeCloseTo(quarterBox.labelY!, 1);
        if (mode === "progress") previousHeights.push(box.height);
        else expect(box.height).toBe(previousHeights[month - 10]);
      }
    }
  }
});

test("decade, century and year cards use the same small offset at either layout width", async ({ page }) => {
  for (const showDecade of [true, false]) {
    await page.evaluate((enabled) => window.mountChronoCalendar("en", 640, {
      configure(settings) {
        settings.periodicNotes.yearly.enabled = true;
        settings.periodicNotes.yearly.pattern = "[Years]/YYYY";
        settings.periodicNotes.century.enabled = true;
        settings.periodicNotes.decadal.enabled = enabled;
      },
    }), showDecade);
    await page.getByRole("button", { name: "Century", exact: true }).click();
    const decade = page.locator('[data-period-kind="decade"][data-period-year="2020"]');
    const year = page.locator('[data-period-kind="year"][data-period-year="2026"]');
    const century = page.locator('[data-period-kind="century"]');
    for (const width of [640, 252]) {
      await page.locator("#calendar-fixture").evaluate((node, value) => { node.style.width = `${value}px`; }, width);
      const { height: yearHeight } = await expectAlignment(year, 2, "state");
      const { height: decadeHeight } = await expectAlignment(decade, showDecade ? 2 : 0, showDecade ? "state" : null);
      await expectAlignment(century, 2, "state");
      if (width === 640) expect(decadeHeight).toBeGreaterThanOrEqual(2 * yearHeight);
      else expect(decadeHeight).toBeCloseTo(yearHeight, 1);
    }
  }
});
