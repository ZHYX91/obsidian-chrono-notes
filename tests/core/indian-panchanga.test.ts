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
    [2026, 3, 22, "Shukla Chaturthi"],
    [2026, 4, 20, "Shukla Tritiya"], [2026, 4, 21, "Shukla Panchami"],
    [2026, 5, 4, "Krishna Tritiya"], [2026, 5, 5, "Krishna Tritiya"],
    [2026, 6, 15, "Amavasya"], [2026, 6, 16, "Shukla Dvitiya"],
    [2026, 11, 24, "Purnima"], [2026, 11, 25, "Krishna Pratipada"],
    [2027, 3, 21, "Shukla Chaturdashi"],
  ] as const)("reads %i-%i-%i from the published sunrise table", (year, month, day, dateText) => {
    const date = { year, month, day };
    expect(isIndianPanchangaDateSupported(date)).toBe(true);
    expect(getIndianPanchangaDay(date, "en")).toMatchObject({ dateText, events: [], transition: null });
  });

  it("localizes Hindi tithi and paksha separately from the Indian national calendar", () => {
    expect(getIndianPanchangaDay({ year: 2026, month: 11, day: 25 }, "hi-IN")).toEqual({
      dateText: "कृष्ण प्रतिपदा", accessibilityText: "कृष्ण पक्ष प्रतिपदा", events: [], transition: null,
    });
  });

  it.each([{ year: 2026, month: 3, day: 21 }, { year: 2027, month: 3, day: 22 }])(
    "does not extrapolate outside the edition: %j", (date) => {
      expect(isIndianPanchangaDateSupported(date)).toBe(false);
      expect(() => getIndianPanchangaDay(date, "hi")).toThrow(RangeError);
    },
  );
});
