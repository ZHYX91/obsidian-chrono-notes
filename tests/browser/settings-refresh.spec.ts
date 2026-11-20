import { expect, test } from "@playwright/test";

import { createSettingsBrowserFixture } from "./settings-fixture";
import type { PluginLocale } from "../../src/shared/settings";
import type {} from "./settings-entry";

let fixture: Awaited<ReturnType<typeof createSettingsBrowserFixture>>;

test.beforeAll(async () => {
  fixture = await createSettingsBrowserFixture();
});

for (const tab of ["periodic", "ranges"] as const) {
  test(`${tab}: keeps focus and scroll beside the newly enabled field`, async ({ page }, testInfo) => {
    await page.setContent(fixture.html);
    await page.addScriptTag({ content: fixture.script });
    await page.evaluate(() => window.mountChronoSettings("en", 420));
    await page.addStyleTag({ content: "#settings-fixture { height: 360px; overflow-y: auto; }" });
    await page.locator(`[role="tab"][data-tab-id="${tab}"]`).click();
    const weeklySection = '[aria-labelledby="chrono-notes-weekly-settings-heading"]';
    const control = tab === "periodic"
      ? page.locator(`${weeklySection} input[type=checkbox]`)
      : page.locator('[role="tabpanel"] select');
    const dependent = tab === "periodic"
      ? page.locator(`${weeklySection} .chrono-notes-periodic-path-setting input`)
      : page.getByPlaceholder("Projects");
    await control.evaluate((field) => field.scrollIntoView({ block: "center" }));
    await control.focus();
    const scroller = page.locator("#settings-fixture");
    const before = await scroller.evaluate((el) => el.scrollTop);
    expect(before).toBeGreaterThan(0);
    if (tab === "periodic") await control.press("Space");
    else await control.selectOption("custom-folder");
    await page.evaluate(async () => { await window.chronoSettingsPending; });
    const after = await scroller.evaluate((el) => el.scrollTop);
    const rect = await dependent.boundingBox();
    const viewport = (await scroller.boundingBox())!;
    await testInfo.attach("dependent-setting-viewport", { contentType: "application/json", body: JSON.stringify({
      before, after, focused: await control.evaluate((el) => el === document.activeElement), rect, viewport,
    }) });
    expect(after).toBeCloseTo(before, 0);
    await expect(control).toBeFocused();
    await expect(dependent).toBeEnabled();
    expect(rect!.y).toBeGreaterThanOrEqual(viewport.y);
    expect(rect!.y + rect!.height).toBeLessThanOrEqual(viewport.y + viewport.height);
    await control.press("Tab");
    await expect(dependent).toBeFocused();
    const value = tab === "periodic" ? "[Weeks]/GGGG-[W]WW" : "Projects/Current";
    await dependent.fill(value);
    if (tab === "periodic") {
      await control.press("Space");
      await expect(dependent).toHaveCount(0);
      await control.press("Space");
    } else {
      await control.selectOption("entire-vault");
      await expect(dependent).toBeDisabled();
      await control.selectOption("custom-folder");
    }
    await expect(dependent).toBeEnabled();
    await expect(dependent).toHaveValue(value);
    await page.evaluate(async () => { await window.chronoSettingsPending; });
    await page.evaluate(() => {
      window.beforeChronoSettingsSave = () => new Promise<void>((resolve) =>
        window.addEventListener("release-test-save", () => resolve(), { once: true }));
    });
    if (tab === "periodic") await control.press("Space");
    else await control.selectOption("range-folder");
    const otherTab = page.locator('[role="tab"][data-tab-id="general"]');
    await otherTab.click();
    await page.evaluate(async () => {
      window.dispatchEvent(new Event("release-test-save"));
      await window.chronoSettingsPending;
    });
    await expect(otherTab).toHaveAttribute("aria-selected", "true");
    await expect(otherTab).toBeFocused();
  });
}

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
  const body = page.locator(".chrono-notes-settings-guide-body");
  const text = page.getByText("Choose a date to create a range note.");
  await expect(text).toBeHidden();
  await expect(summary).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(summary).toHaveCSS("border-top-style", "none");
  expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(32);
  await page.keyboard.press("Tab");
  await expect(summary).toBeFocused();
  await expect(summary).toHaveCSS("outline-style", "solid");
  await summary.press("Enter");
  await expect(text).toBeVisible();
  await expect(body).toHaveCSS("border-left-width", "2px");
  await expect(body).toHaveCSS("border-right-width", "0px");
  await expect(body).toHaveCSS("margin-inline-start", "6px");
  const widths = await text.evaluate((paragraph) => ({
    text: paragraph.getBoundingClientRect().width,
    available: paragraph.closest("details")!.getBoundingClientRect().width,
  }));
  expect(widths.text).toBeGreaterThan(200);
  expect(widths.text).toBeLessThan(widths.available * 0.8);
  await page.locator("details").evaluate((guide) => guide.setAttribute("dir", "rtl"));
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(body).toHaveCSS("border-left-width", "0px");
  await expect(body).toHaveCSS("border-right-width", "2px");
  await expect(body).toHaveCSS("margin-inline-start", "0px");
  await expect(body).toHaveCSS("padding-inline-start", "10px");
  await summary.press("Space");
  await expect(text).toBeHidden();
  await expect(body).toHaveCSS("border-inline-start-width", "0px");
  await expect(summary).toBeFocused();
});
