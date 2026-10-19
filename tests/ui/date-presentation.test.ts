import { describe, expect, it } from "vitest";

import {
  createGregorianDateFormatter,
  formatMonthLabel,
  formatNarrowWeekdayLabels,
  formatShortMonthLabel,
  formatShortMonthLabels,
} from "../../src/ui/date-presentation";

import { PLUGIN_LANGUAGE_OPTIONS } from "../../src/shared/plugin-languages";

describe("UI date presentation", () => {
  it.each(PLUGIN_LANGUAGE_OPTIONS)("keeps Gregorian month identity in $label", ({ value: locale }) => {
    const labels = formatShortMonthLabels(2026, locale);
    const expected = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat(locale, {
      calendar: "gregory", timeZone: "UTC", month: "short",
    }).format(new Date(Date.UTC(2026, index, 1))));
    expect(labels).toEqual(expected);
    expect(labels[6]).toBe(formatShortMonthLabel(2026, 7, locale));
    expect(createGregorianDateFormatter(locale, { year: "numeric" }).resolvedOptions())
      .toMatchObject({ calendar: "gregory", timeZone: "UTC" });
  });

  it("labels Gregorian January and 2026 in Persian, including explicit non-Gregorian locale extensions", () => {
    expect(formatShortMonthLabel(2026, 1, "fa")).toBe("ژانویه");
    expect(formatMonthLabel({ year: 2026, month: 1 }, "fa")).toBe("ژانویهٔ ۲۰۲۶");
    expect(formatShortMonthLabel(2026, 1, "en-u-ca-persian")).toBe("Jan");
  });

  it("formats frozen narrow weekday labels from Monday or Sunday", () => {
    const mondayFirst = formatNarrowWeekdayLabels("en-US", "monday");
    const sundayFirst = formatNarrowWeekdayLabels("en-US", "sunday");

    expect(mondayFirst).toEqual(["M", "T", "W", "T", "F", "S", "S"]);
    expect(sundayFirst).toEqual(["S", "M", "T", "W", "T", "F", "S"]);
    expect(Object.isFrozen(mondayFirst)).toBe(true);
    expect(Object.isFrozen(sundayFirst)).toBe(true);
  });

  it("formats one short month and a frozen year of short month labels", () => {
    const labels = formatShortMonthLabels(2026, "en-US");

    expect(formatShortMonthLabel(2026, 7, "en-US")).toBe("Jul");
    expect(labels).toEqual([
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ]);
    expect(Object.isFrozen(labels)).toBe(true);
  });
});
