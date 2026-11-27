import { afterEach, describe, expect, it } from "vitest";

import {
  clearIntlCalendarFormatterCache,
  getIntlCalendarDay,
  INTL_CALENDAR_IDS,
  isIntlCalendarSupported,
} from "../../src/core/calendar/intl-calendar";

describe("Intl calendar extensions", () => {
  afterEach(() => {
    clearIntlCalendarFormatterCache();
  });

  it.each(INTL_CALENDAR_IDS)("is available in the supported Node runtime: %s", (calendar) => {
    expect(isIntlCalendarSupported(calendar, "en")).toBe(true);
  });

  it("uses compact day text and a complete accessible date", () => {
    const day = getIntlCalendarDay(
      { year: 2026, month: 7, day: 23 },
      "en",
      "persian",
    );

    expect(day).toMatchObject({
      dateText: "Mordad 1",
      events: [],
      transition: "month",
      accessibilityText: "Mordad 1, 1405 AP",
    });
  });

  it("shows the calendar month and year at their transition boundaries", () => {
    const newYear = getIntlCalendarDay(
      { year: 2026, month: 3, day: 21 },
      "fa",
      "persian",
    );
    const newMonth = getIntlCalendarDay(
      { year: 2026, month: 7, day: 23 },
      "fa",
      "persian",
    );

    expect(newYear.transition).toBe("year-month");
    expect(newYear.dateText).toContain("۱۴۰۵");
    expect(newMonth.transition).toBe("month");
    expect(newMonth.dateText).toContain("۱");
  });

  it.each(["en", "zh-CN", "zh-TW", "ar"])("displays the first Coptic year at the change of era in %s", (locale) => {
    const copticDay = (day: number) => getIntlCalendarDay({ year: 284, month: 8, day }, locale, "coptic");
    expect(copticDay(28).transition).toBeNull();
    const epoch = copticDay(29);
    expect(epoch.transition).toBe("year-month");
    expect(epoch.dateText).toBe(epoch.accessibilityText);
    expect(copticDay(30).transition).toBeNull();
  });

  it("keeps civil and Umm al-Qura Islamic calculations distinct", () => {
    const date = { year: 2026, month: 7, day: 23 };
    const civil = getIntlCalendarDay(date, "en", "islamic-civil");
    const ummAlQura = getIntlCalendarDay(date, "en", "islamic-umalqura");

    expect(civil.accessibilityText).toBe("Safar 7, 1448 AH");
    expect(ummAlQura.accessibilityText).toBe("Safar 9, 1448 AH");
  });

  it.each([
    ["coptic", { year: 2025, month: 9, day: 11 }, /科普特|殉/u, "1742年1月1日"],
    ["ethiopic", { year: 2025, month: 9, day: 11 }, /恩|仁|慈/u, "2018年1月1日"],
    ["ethiopic", { year: 1, month: 9, day: 11 }, /世/u, "5494年1月16日"],
  ] as const)("spells out the Chinese era for %s on %j", (calendar, date, eraName, numericDate) => {
    for (const locale of ["zh-CN", "zh-TW"]) {
      const result = getIntlCalendarDay(date, locale, calendar);
      expect(result.accessibilityText).toMatch(eraName);
      expect(result.accessibilityText).toContain(numericDate);
      expect(result.accessibilityText).not.toMatch(/AM|AA/u);
      if (date.year === 2025) {
        expect(result.transition).toBe("year-month");
        expect(result.dateText).toBe(result.accessibilityText);
      }
    }
  });

  it("falls back to English for an invalid locale without changing the calendar", () => {
    const day = getIntlCalendarDay(
      { year: 2026, month: 7, day: 23 },
      "not a locale",
      "hebrew",
    );

    expect(day.accessibilityText).toBe("9 Av 5786");
  });
});
