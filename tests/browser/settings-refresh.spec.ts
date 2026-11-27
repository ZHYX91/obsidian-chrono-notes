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

test("settings tab paging arrows meet the 44 × 44 touch target in LTR and RTL", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.setContent(fixture.html);
    await page.addScriptTag({ content: fixture.script });
    for (const locale of ["en", "ar"] satisfies PluginLocale[]) {
      await page.evaluate((locale) => window.mountChronoSettings(locale, 260), locale);
      const geometry = await page.evaluate(() => {
        const row = document.querySelector<HTMLElement>(".chrono-notes-settings-tab-row")!;
        row.classList.add("has-overflow");
        const buttons = Array.from(row.querySelectorAll<HTMLButtonElement>(".chrono-notes-settings-tab-scroll"));
        // Make both ends measurable; this test concerns the target geometry, not scroll state.
        buttons.forEach((button) => { button.disabled = false; });
        return {
          coarse: matchMedia("(pointer: coarse)").matches,
          direction: getComputedStyle(row.querySelector(".chrono-notes-settings-tabs")!).direction,
          arrows: buttons.map((button) => {
            const rect = button.getBoundingClientRect();
            return { width: rect.width, height: rect.height };
          }),
        };
      });
      expect(geometry.coarse).toBe(true);
      expect(geometry.direction).toBe(locale === "ar" ? "rtl" : "ltr");
      expect(geometry.arrows).toHaveLength(2);
      for (const [index, rect] of geometry.arrows.entries()) {
        expect(rect.width, locale + " arrow " + index + " width").toBeGreaterThanOrEqual(44);
        expect(rect.height, locale + " arrow " + index + " height").toBeGreaterThanOrEqual(44);
      }
    }
  } finally {
    await context.close();
  }
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
  const guide = page.locator("details");
  const summary = guide.locator("summary");
  const body = page.locator(".chrono-notes-settings-guide-body");
  const text = page.getByText("Choose a date to create a range note.");
  const expectedTint = await guide.evaluate((element) => {
    const sample = document.createElement("span");
    sample.style.color = "color-mix(in srgb, var(--interactive-accent) 5%, var(--background-primary))";
    element.parentElement!.append(sample);
    const color = getComputedStyle(sample).color;
    sample.remove();
    return color;
  });
  const chevronColor = () => summary.evaluate((element) => getComputedStyle(element, "::before").borderBlockStartColor);
  await expect(guide).toHaveCSS("background-color", expectedTint);
  await expect(guide).toHaveCSS("border-top-color", "rgb(204, 204, 204)");
  await expect(guide).toHaveCSS("border-top-width", "1px");
  expect(await chevronColor()).toBe("rgb(120, 82, 238)");
  await expect(text).toBeHidden();
  await expect(summary).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(summary).toHaveCSS("border-top-style", "none");
  expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(32);
  await page.keyboard.press("Tab");
  await expect(summary).toBeFocused();
  await expect(summary).toHaveCSS("outline-style", "solid");
  await summary.press("Enter");
  await expect(text).toBeVisible();
  await expect(guide).toHaveCSS("background-color", expectedTint);
  await expect(body).toHaveCSS("border-inline-start-color", await chevronColor());
  await expect(body).toHaveCSS("border-left-width", "2px");
  await expect(body).toHaveCSS("border-right-width", "0px");
  await expect(body).toHaveCSS("margin-inline-start", "14px");
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
  await expect(body).toHaveCSS("margin-inline-start", "8px");
  await expect(body).toHaveCSS("padding-inline-start", "10px");
  await summary.press("Space");
  await expect(text).toBeHidden();
  await expect(body).toHaveCSS("border-inline-start-width", "0px");
  await expect(summary).toBeFocused();
});

for (const locale of ["en", "ar"] as const) {
  test(`${locale}: shrinking a fitted row reveals its selection once and preserves manual browsing`, async ({ page }) => {
    await page.setContent(fixture.html);
    await page.addScriptTag({ content: fixture.script });
    await page.evaluate((language) => window.mountChronoSettings(language, 900), locale);
    const root = page.locator("#settings-fixture");
    const earlier = page.locator('button[data-side="earlier"]');
    const later = page.locator('button[data-side="later"]');
    const last = page.getByRole("tab").last();
    await last.click();
    await expect(last).toHaveAttribute("aria-selected", "true");
    await expect(earlier).toBeHidden();
    await expect(later).toBeHidden();
    const clippedWidth = () => page.evaluate(() => {
      const state = window.captureChronoSettings();
      return state.activeWidth - state.activeVisibleWidth;
    });

    await root.evaluate((element) => { element.style.width = "270px"; });
    await expect(earlier).toBeVisible();
    await expect.poll(clippedWidth).toBeLessThanOrEqual(1);
    await earlier.click();
    await expect(later).toBeVisible();
    await expect.poll(clippedWidth).toBeGreaterThan(1);
    await root.evaluate((element) => { element.style.width = "269px"; });
    await page.evaluate(() => new Promise(requestAnimationFrame).then(() => new Promise(requestAnimationFrame)));
    expect(await clippedWidth()).toBeGreaterThan(1);
    await expect(last).toHaveAttribute("aria-selected", "true");
  });

  test(`${locale}: reveals clipped settings tabs without switching the panel`, async ({ page }) => {
    await page.setContent(fixture.html);
    await page.addScriptTag({ content: fixture.script });
    await page.evaluate((language) => window.mountChronoSettings(language, 240), locale);

    const earlier = page.locator('button[data-side="earlier"]');
    const later = page.locator('button[data-side="later"]');
    const list = page.getByRole("tablist");
    const panel = page.getByRole("tabpanel");
    const panelId = await panel.getAttribute("id");
    await expect(earlier).toBeHidden();
    await expect(later).toBeVisible();
    await expect(later).toHaveAccessibleName(locale === "en" ? "Show later tabs" : "إظهار علامات التبويب التالية");

    await later.click();
    await expect(earlier).toBeVisible();
    await expect.poll(() => list.evaluate((el) => Math.abs(el.scrollLeft))).toBeGreaterThan(0);
    await expect(panel).toHaveAttribute("id", panelId!);
    await expect(page.getByRole("tab", { selected: true })).toHaveAttribute("data-tab-id", "general");

    // Enlarge the final label to exercise the case where even a single tab
    // spans more than a scrollport. Repeated clicks must still reach the end.
    await list.getByRole("tab").last().evaluate((el) => { el.style.minWidth = "400px"; });
    for (let step = 0; step < 12 && await later.isVisible(); step++) await later.click();
    await expect(later).toBeHidden();
    await expect(earlier).toBeFocused();
    await earlier.press("Enter");
    await expect(later).toBeVisible();
    await list.evaluate((el) => { el.scrollLeft = 0; });
    await expect(earlier).toBeHidden();
    await expect(later).toBeVisible();

    await page.locator("#settings-fixture").evaluate((root) => { root.style.width = "1800px"; });
    await expect(earlier).toBeHidden();
    await expect(later).toBeHidden();
    const freeSpace = await list.evaluate((el) =>
      el.parentElement!.getBoundingClientRect().width - el.getBoundingClientRect().width);
    expect(freeSpace).toBeLessThan(1);
    await expect(list.getByRole("tab").first()).toHaveCSS("padding-inline-start", "12px");
    await page.locator("#settings-fixture").evaluate((root) => { root.style.width = "500px"; });
    await expect(list.getByRole("tab").first()).toHaveCSS("padding-inline-start", "8px");
    await page.locator("#settings-fixture").evaluate((root) => { root.style.width = "235px"; });
    await expect(later).toBeVisible();
    await expect(earlier).toBeHidden();
  });
}

test.describe("touch settings tabs", () => {
  test.use({ hasTouch: true });

  test("provides 44px tap targets for tabs and scroll controls", async ({ page }) => {
    await page.setContent(fixture.html);
    await page.addScriptTag({ content: fixture.script });
    await page.evaluate(() => window.mountChronoSettings("en", 200));
    const tab = page.getByRole("tab", { selected: true });
    const control = page.getByRole("button", { name: "Show later tabs" });
    await expect(tab).toHaveCSS("min-block-size", "44px");
    const target = await control.boundingBox();
    expect(target?.width).toBeGreaterThanOrEqual(44);
    expect(target?.height).toBeGreaterThanOrEqual(44);
  });
});

for (const scheme of ["light", "dark"] as const) {
  for (const forcedColors of ["none", "active"] as const) {
    test(`paints the selected underline separately from keyboard focus in ${scheme} with forced colors ${forcedColors}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, forcedColors });
      await page.setContent(fixture.html);
      await page.addStyleTag({ content: `
        :root { color-scheme: light dark; --background-primary: light-dark(white, #1c1c1c);
          --text-normal: light-dark(#222, #ddd); --interactive-accent: light-dark(#9873f7, #8a5cf5); }
        body { background: var(--background-primary); }
      ` });
      await page.addScriptTag({ content: fixture.script });
      await page.evaluate(() => window.mountChronoSettings("en", 720));
      const tabs = page.getByRole("tab");
      await page.keyboard.press("Tab");
      await tabs.nth(1).focus();
      await expect(tabs.nth(1)).toBeFocused();
      await expect(tabs.first()).toHaveAttribute("aria-selected", "true");

      const screenshot = (await page.screenshot({ scale: "css" })).toString("base64");
      const [selected, focused, idle] = await page.evaluate(async (png) => {
        const image = new Image();
        image.src = "data:image/png;base64," + png;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(image, 0, 0);
        return Array.from(document.querySelectorAll('[role=tab]')).slice(0, 3).map((button) => {
          const bounds = button.getBoundingClientRect();
          const x = Math.floor(bounds.left + bounds.width / 2);
          const pixel = (y: number) => Array.from(ctx.getImageData(x, Math.floor(y), 1, 1).data);
          return { bottom: [pixel(bounds.bottom - 0.5), pixel(bounds.bottom - 1.5)],
            top: pixel(bounds.top + 0.5), interior: pixel(bounds.top + 4.5) };
        });
      }, screenshot);
      expect(selected!.bottom[0]).toEqual(selected!.bottom[1]);
      for (let edge = 0; edge < 2; edge++) {
        expect(selected!.bottom[edge]).not.toEqual(idle!.bottom[edge]);
      }
      expect(focused!.top).not.toEqual(focused!.interior);
      expect(idle!.top).toEqual(idle!.interior);
    });
  }
}

test("hidden dropdown sizing preserves the intrinsic measurement without widening the settings pane", async ({ page }) => {
  await page.setContent(fixture.html);
  await page.addStyleTag({ content: ".dropdown.is-measuring {position:absolute;visibility:hidden;pointer-events:none;width:max-content!important;max-width:none!important}" });
  await page.addScriptTag({ content: fixture.script });
  await page.evaluate(() => window.mountChronoSettings("de-DE", 260));
  await page.locator('[data-tab-id="extensions-and-integrations"]').click();
  const result = await page.locator('[role="tabpanel"]').evaluate((panel) => {
    const select = panel.querySelector("select")!;
    const probe = select.cloneNode(false) as HTMLSelectElement;
    probe.className = "dropdown is-measuring";
    probe.setAttribute("aria-hidden", "true");
    probe.tabIndex = -1;
    probe.add(new Option("Lokalisiertes Kalenderformat ".repeat(5)));
    select.after(probe);
    return { width: panel.clientWidth, scroll: panel.scrollWidth, measured: probe.offsetWidth };
  });
  expect(result.measured).toBeGreaterThan(result.width);
  expect(result.scroll).toBeLessThanOrEqual(result.width + 1);
});

test("a repeated boundary key keeps the active tab and its scroll position", async ({ page }) => {
  await page.setContent(fixture.html);
  await page.addScriptTag({ content: fixture.script });
  await page.evaluate(() => window.mountChronoSettings("en", 260));
  await page.addStyleTag({ content: "#settings-fixture { height: 260px; overflow-y: auto; }" });
  const last = page.getByRole("tab").last();
  await last.click();
  await page.locator("#settings-fixture").evaluate((container) => {
    container.scrollTop = 0;
    container.addEventListener("keydown", (event) => {
      container.dataset.blocked = String(event.defaultPrevented);
    });
  });
  await last.press("End");
  await expect(last).toBeFocused();
  await expect(page.locator("#settings-fixture")).toHaveAttribute("data-blocked", "true");
  expect(await page.locator("#settings-fixture").evaluate((container) => container.scrollTop)).toBe(0);
});
