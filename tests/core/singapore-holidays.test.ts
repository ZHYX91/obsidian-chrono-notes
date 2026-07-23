import { describe, expect, it } from "vitest";

import {
  getSingaporeHolidayDay,
  getSingaporeHolidayYearCoverage,
} from "../../src/core/calendar/singapore-holidays";

describe("getSingaporeHolidayDay", () => {
  it("returns locale-specific public holiday names", () => {
    const date = { year: 2026, month: 5, day: 1 };

    expect(getSingaporeHolidayDay(date, "en-SG").holidays).toEqual([
      { region: "sg", name: "Labour Day" },
    ]);
    expect(getSingaporeHolidayDay(date, "zh-CN").holidays).toEqual([
      { region: "sg", name: "劳动节" },
    ]);
    expect(getSingaporeHolidayDay(date, "zh-Hant").holidays).toEqual([
      { region: "sg", name: "勞動節" },
    ]);
  });

  it.each(["ar", "fa", "he", "am", "hi"])(
    "falls back to the English holiday name for unsupported locale %s",
    (locale) => {
      expect(
        getSingaporeHolidayDay({ year: 2026, month: 2, day: 17 }, locale).holidays,
      ).toEqual([{ region: "sg", name: "Chinese New Year" }]);
    },
  );

  it("includes the official Monday holiday after a Sunday public holiday", () => {
    expect(getSingaporeHolidayDay({ year: 2026, month: 6, day: 1 }, "en")).toEqual({
      coverage: "available",
      holidays: [{ region: "sg", name: "Vesak Day Holiday" }],
    });
  });

  it("matches the Ministry of Manpower 2027 gazetted dates", () => {
    const expected = [
      ["2027-01-01", "New Year's Day"],
      ["2027-02-06", "Chinese New Year"],
      ["2027-02-07", "Chinese New Year"],
      ["2027-02-08", "Chinese New Year Holiday"],
      ["2027-03-10", "Hari Raya Puasa"],
      ["2027-03-26", "Good Friday"],
      ["2027-05-01", "Labour Day"],
      ["2027-05-17", "Hari Raya Haji"],
      ["2027-05-20", "Vesak Day"],
      ["2027-08-09", "National Day"],
      ["2027-10-28", "Deepavali"],
      ["2027-12-25", "Christmas Day"],
    ] as const;

    const actual: Array<readonly [string, string]> = [];
    for (let month = 1; month <= 12; month += 1) {
      for (let day = 1; day <= 31; day += 1) {
        const result = getSingaporeHolidayDay({ year: 2027, month, day }, "en");
        const date = [
          "2027",
          String(month).padStart(2, "0"),
          String(day).padStart(2, "0"),
        ].join("-");
        for (const entry of result.holidays) actual.push([date, entry.name]);
      }
    }

    expect(actual).toEqual(expected);
    expect(getSingaporeHolidayDay({ year: 2027, month: 2, day: 8 }, "zh-CN").holidays)
      .toEqual([{ region: "sg", name: "农历新年补假" }]);
    expect(getSingaporeHolidayDay({ year: 2027, month: 2, day: 8 }, "zh-Hant").holidays)
      .toEqual([{ region: "sg", name: "農曆新年補假" }]);
    expect(getSingaporeHolidayDay({ year: 2027, month: 7, day: 20 }, "en")).toEqual({
      coverage: "available",
      holidays: [],
    });
    expect(getSingaporeHolidayYearCoverage(2026)).toBe("available");
    expect(getSingaporeHolidayYearCoverage(2027)).toBe("available");
    expect(getSingaporeHolidayYearCoverage(2028)).toBe("unavailable");
  });

  it("distinguishes an ordinary covered date from an unavailable year", () => {
    expect(getSingaporeHolidayDay({ year: 2026, month: 3, day: 3 }, "en")).toEqual({
      coverage: "available",
      holidays: [],
    });
    expect(getSingaporeHolidayDay({ year: 2025, month: 1, day: 1 }, "en")).toEqual({
      coverage: "unavailable",
      holidays: [],
    });
  });

  it("returns recursively frozen values", () => {
    const result = getSingaporeHolidayDay({ year: 2026, month: 8, day: 9 }, "zh-TW");

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.holidays)).toBe(true);
    expect(Object.isFrozen(result.holidays[0])).toBe(true);
  });
});
