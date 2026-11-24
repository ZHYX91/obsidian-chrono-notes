import { expect, test } from "@playwright/test";
import { createCalendarBrowserFixture } from "./calendar-fixture";

const fixture = createCalendarBrowserFixture();

for (const [width, fontSize, locale] of [
  [356, 16, "en"], [320, 24, "de-DE"], [320, 24, "ru-RU"], [840, 16, "en"],
  [320, 24, "ar"], [320, 24, "fa"], [320, 24, "he"], [320, 24, "hi"], [320, 24, "am"],
  [320, 24, "es-ES"], [320, 24, "pt-BR"], [320, 24, "fr-FR"], [320, 24, "ja-JP"],
  [320, 24, "ko-KR"], [320, 24, "zh-CN"], [320, 24, "zh-TW"], [320, 24, "vi-VN"],
] as const) {
  test(`range note rows fit their contents at ${width}px, ${fontSize}px ${locale} font`, async ({ page }) => {
    const { html, script } = await fixture;
    await page.setContent(html);
    await page.evaluate((language) => {
      document.documentElement.lang = language;
      document.documentElement.dir = ["ar", "fa", "he"].includes(language) ? "rtl" : "ltr";
    }, locale);
    // Host controls have a fixed input height and reserve space for the select arrow.
    await page.addStyleTag({ content: `
      body { font-size:${fontSize}px; --font-ui-small:${fontSize - 1}px; }
      button { height:44px; white-space:nowrap; }
      select { appearance:none; padding-inline:12px 32px; }
      .chrono-notes-interval-list-modal { width:${width}px; }
    ` });
    await page.addScriptTag({ content: script });
    await page.evaluate((language) => window.mountChronoIntervalList(language), locale);
    const rows = page.locator(".chrono-notes-interval-list-item");
    await expect(rows).toHaveCount(13);
    const sort = page.getByRole("combobox").filter({ has: page.locator('option[value="start-desc"]') });
    const firstPath = rows.first().locator("small");
    await expect(firstPath).toHaveText("Projects/Explicit range.md");
    await sort.selectOption("start-desc");
    await expect(firstPath).toHaveText(/\/Plan-22\.md$/);
    await sort.selectOption("start-asc");
    await expect(firstPath).toHaveText("Projects/Explicit range.md");
    const last = rows.last();
    for (const row of [rows.first(), last]) {
      const path = await row.locator("small").innerText();
      const fits = await row.evaluate((button) => {
        const box = button.getBoundingClientRect();
        return [...button.querySelectorAll("strong, small, .chrono-notes-interval-list-main > span, .chrono-notes-interval-list-duration")]
          .every((part) => {
            const range = document.createRange();
            range.selectNodeContents(part);
            const text = range.getBoundingClientRect();
            return text.top >= box.top && text.bottom <= box.bottom
              && (part.tagName === "SMALL" || text.width <= part.clientWidth + 1);
          });
      });
      expect.soft(fits, path).toBe(true);
      const dates = await row.locator(".chrono-notes-interval-list-main > span").innerText();
      const summary = await row.locator(".chrono-notes-interval-list-duration").innerText();
      await expect.soft(row).toHaveAccessibleDescription(`${dates} ${path} ${summary}`);
      expect.soft(await row.getAttribute("title")).toContain(path);
      if (width < 500) {
        expect.soft(await row.locator("small").evaluate((label) => label.scrollWidth - label.clientWidth)).toBeLessThanOrEqual(1);
      }
    }
    const overflowingOptions = await page.getByRole("combobox").evaluateAll((elements) =>
      elements.flatMap((element) => {
        const select = element as HTMLSelectElement;
        const style = getComputedStyle(select);
        const canvas = document.createElement("canvas").getContext("2d")!;
        canvas.font = style.font;
        const available = select.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        return [...select.options].flatMap((option) => {
          const width = canvas.measureText(option.text).width;
          return width <= available + 1 ? [] : [{ label: option.text, width, available }];
        });
      }));
    expect.soft(overflowingOptions, "both menus fit every translated option").toEqual([]);
    const results = page.locator(".chrono-notes-interval-list-results");
    await last.focus();
    expect(await results.evaluate((list) => list.scrollTop)).toBeGreaterThan(0);
    expect(await results.evaluate((list) => list.scrollWidth - list.clientWidth)).toBeLessThanOrEqual(1);
    await last.press("Enter");
    expect(await page.evaluate(() => window.chronoOpenedPath)).toBe(await last.locator("small").innerText());
  });
}
