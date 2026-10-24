import { expect, test } from "@playwright/test";
import { createCalendarBrowserFixture } from "./calendar-fixture";
import type {} from "./calendar-entry";

let fixture: Awaited<ReturnType<typeof createCalendarBrowserFixture>>;
test.beforeAll(async () => { fixture = await createCalendarBrowserFixture(); });

for (const count of [1000, 5000]) {
  test(`measures ${count} same-week tasks and real IndexedDB persistence`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await page.route("http://chrono-fixture.test/", (route) => route.fulfill({ contentType: "text/html", body: fixture.html }));
    await page.goto("http://chrono-fixture.test/");
    await page.addScriptTag({ content: fixture.script });
    const samples = [];
    for (let run = 0; run < 5; run += 1) {
      samples.push(await page.evaluate((size) => window.runChronoBrowserBenchmark(size), count));
    }
    const metrics = samples[0]!;
    expect(metrics.updateReads).toBe(1);
    expect(metrics.rowCount).toBe(100);
    await expect(page.getByRole("status")).toHaveText(`101–200 of ${count}`);
    await expect(page.locator(".chrono-notes-week-task")).toHaveCount(100);
    if (count === 1000) {
      for (let pageIndex = 2; pageIndex < 10; pageIndex += 1) {
        await page.getByRole("button", { name: "Next tasks", exact: true }).click();
      }
      await expect(page.getByRole("status")).toHaveText("901–1000 of 1000");
      await expect(page.getByRole("button", { name: "Next tasks", exact: true })).toBeDisabled();
      await expect(page.locator(".chrono-notes-week-task")).toHaveCount(100);
    }
    expect(metrics.cacheBytes).toBeGreaterThan(count * 100);
    console.info(JSON.stringify({ count, samples }));
    await testInfo.attach("browser-performance", { body: JSON.stringify(samples, null, 2), contentType: "application/json" });
  });
}

test("renders all four calendar tabs in wide and narrow fixtures", async ({ page }, testInfo) => {
  await page.setContent(fixture.html);
  await page.addScriptTag({ content: fixture.script });
  for (const width of [840, 340]) {
    await page.evaluate((width) => window.mountChronoCalendar("en", width), width);
    await expect(page.locator(".chrono-notes-view-mode button")).toHaveCount(4);
    await expect(page.locator(".chrono-notes-selected-day-details")).toContainText("Team review");
    await expect(page.locator(".chrono-notes-selected-day-details")).toContainText("Project planning");
    await expect(page.locator(".chrono-notes-selected-day-details")).toContainText("example.ics");
    await testInfo.attach(`calendar-${width}`, { body: await page.locator("#calendar-fixture").screenshot(), contentType: "image/png" });
  }
});
