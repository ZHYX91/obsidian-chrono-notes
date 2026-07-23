import { afterEach, describe, expect, it } from "vitest";

import {
  clearIntlCalendarFormatterCache,
  getIntlCalendarDay,
  INTL_CALENDAR_IDS,
  isIntlCalendarSupported,
} from "../../src/core/calendar/intl-calendar";

describe("Intl calendar overlays", () => {
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
      eventText: null,
      eventKind: null,
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

  it("keeps civil and Umm al-Qura Islamic calculations distinct", () => {
    const date = { year: 2026, month: 7, day: 23 };
    const civil = getIntlCalendarDay(date, "en", "islamic-civil");
    const ummAlQura = getIntlCalendarDay(date, "en", "islamic-umalqura");

    expect(civil.accessibilityText).toBe("Safar 7, 1448 AH");
    expect(ummAlQura.accessibilityText).toBe("Safar 9, 1448 AH");
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
