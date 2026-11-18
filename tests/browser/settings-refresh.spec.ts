import { expect, test } from "@playwright/test";

import { createSettingsBrowserFixture } from "./settings-fixture";
import type { PluginLocale } from "../../src/shared/settings";
import type {} from "./settings-entry";

let fixture: Awaited<ReturnType<typeof createSettingsBrowserFixture>>;

test.beforeAll(async () => {
  fixture = await createSettingsBrowserFixture();
});

for (const locale of ["en", "fa", "ar", "he"] satisfies PluginLocale[]) {
  test(`${locale}: keeps the active tab and dropdown focus through saving and refresh`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setContent(fixture.html);
    await page.addScriptTag({ content: fixture.script });
    await page.evaluate((locale) => window.mountChronoSettings(locale, 320), locale);
    await page.locator('[role="tab"][data-tab-id="extensions-and-integrations"]').click();
    const measurements = [];
    for (const [slotIndex, selectIndex] of [0, 2].entries()) {
      const dropdown = page.locator('[role="tabpanel"] select').nth(selectIndex);
      await dropdown.focus();
      const selected = await dropdown.evaluate((select: HTMLSelectElement) => {
        const options = [...select.options];
        return options.find((option) => option.value !== "" && option.value !== select.value)?.value
          ?? options.find((option) => option.value !== select.value)?.value;
      });
      expect(selected).toBeDefined();
      await dropdown.selectOption(selected!);
      await page.evaluate(async () => { await window.chronoSettingsPending; });
      const state = await page.evaluate(() => window.captureChronoSettings());
      measurements.push(state);
      expect(state.direction).toBe(locale === "en" ? "ltr" : "rtl");
      expect(state.activeTab).toBe("extensions-and-integrations");
      expect.soft(state.activeVisibleWidth).toBeGreaterThanOrEqual(state.activeWidth - 1);
      expect(state.savedCount).toBe(slotIndex + 1);
      expect((slotIndex === 0 ? state.calendarExtensions : state.holidayRegions)[0]).toBe(selected);
      expect.soft(await page.locator('[role="tabpanel"] select').nth(selectIndex)
        .evaluate((select) => select === document.activeElement)).toBe(true);
      await expect(page.locator('[role="tabpanel"] select').nth(selectIndex)).toHaveValue(selected!);
    }
    await testInfo.attach("measured-settings-layout", {
      body: JSON.stringify(measurements, null, 2), contentType: "application/json",
    });
    expect(errors).toEqual([]);
  });
}

test("the tutorial opens by keyboard and keeps readable line lengths on a wide screen", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.setContent(fixture.html);
  await page.addScriptTag({ content: fixture.script });
  await page.evaluate(() => window.mountSettingsGuide());
  const summary = page.locator("summary");
  const text = page.getByText("Choose a date to create a range note.");
  await expect(text).toBeHidden();
  await summary.focus();
  await summary.press("Enter");
  await expect(text).toBeVisible();
  const widths = await text.evaluate((paragraph) => ({
    text: paragraph.getBoundingClientRect().width,
    available: paragraph.closest("details")!.getBoundingClientRect().width,
  }));
  expect(widths.text).toBeGreaterThan(200);
  expect(widths.text).toBeLessThan(widths.available * 0.8);
});
