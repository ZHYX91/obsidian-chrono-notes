import { describe, expect, it } from "vitest";

import {
  getIndianPanchangaDay,
  isIndianPanchangaDateSupported,
} from "../../src/core/calendar/indian-panchanga";

describe("IMD Panchanga tithi at Central Station sunrise", () => {
  // Primary daily tables: https://packolkata.imd.gov.in/panchang/en/panchang
  // In vaishaka, Krishna Tritiya lasts across two sunrises. In chaitra,
  // Chaturthi starts after April 20 sunrise and ends before April 21 sunrise.
  it.each([
    [2026, 3, 22, "Waxing 4", "Shukla Chaturthi"],
    [2026, 4, 20, "Waxing 3", "Shukla Tritiya"], [2026, 4, 21, "Waxing 5", "Shukla Panchami"],
    [2026, 5, 4, "Waning 3", "Krishna Tritiya"], [2026, 5, 5, "Waning 3", "Krishna Tritiya"],
    [2026, 6, 15, "Waning 15", "Amavasya"], [2026, 6, 16, "Waxing 2", "Shukla Dvitiya"],
    [2026, 6, 29, "Waxing 15", "Purnima"], [2026, 6, 30, "Waxing 15", "Purnima"],
    [2026, 11, 24, "Waxing 15", "Purnima"], [2026, 11, 25, "Waning 1", "Krishna Pratipada"],
    [2027, 3, 21, "Waxing 14", "Shukla Chaturdashi"],
  ] as const)("reads %i-%i-%i from the published sunrise table", (year, month, day, dateText, localName) => {
    const date = { year, month, day };
    expect(isIndianPanchangaDateSupported(date)).toBe(true);
    const result = getIndianPanchangaDay(date, "en");
    expect(result).toMatchObject({ dateText, events: [], transition: null });
    expect(result.accessibilityText).toContain(localName);
  });

  it("localizes Hindi tithi and paksha separately from the Indian national calendar", () => {
    expect(getIndianPanchangaDay({ year: 2026, month: 11, day: 25 }, "hi-IN")).toEqual({
      dateText: "कृष्ण प्रतिपदा", accessibilityText: "कृष्ण पक्ष प्रतिपदा", events: [], transition: null,
    });
  });

  it.each([
    { year: 2026, month: 3, day: 22 }, { year: 2026, month: 5, day: 4 },
    { year: 2026, month: 6, day: 15 }, { year: 2026, month: 11, day: 24 },
  ])("provides Chinese and English for sunrise tithi on $year-$month-$day", (date) => {
    const english = getIndianPanchangaDay(date, "en");
    expect(getIndianPanchangaDay(date, "fr-FR")).toEqual(english);
    for (const locale of ["zh-Hans", "zh-Hant"]) {
      const result = getIndianPanchangaDay(date, locale);
      expect(result.dateText).toMatch(/\p{Script=Han}/u);
      expect(result.accessibilityText).toMatch(/\p{Script=Han}/u);
    }
  });

  it.each([{ year: 2026, month: 3, day: 21 }, { year: 2027, month: 3, day: 22 }])(
    "does not extrapolate outside the edition: %j", (date) => {
      expect(isIndianPanchangaDateSupported(date)).toBe(false);
      expect(() => getIndianPanchangaDay(date, "hi")).toThrow(RangeError);
    },
  );
});
