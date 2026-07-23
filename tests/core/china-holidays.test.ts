import { describe, expect, it } from "vitest";

import {
  getChinaHolidayDay,
  getChinaHolidayYearCoverage,
} from "../../src/core/calendar/china-holidays";

describe("getChinaHolidayDay", () => {
  it("distinguishes a public holiday from an adjusted workday", () => {
    expect(getChinaHolidayDay({ year: 2026, month: 2, day: 17 }, "zh-CN")).toEqual({
      coverage: "available",
      holidays: [{ region: "cn", name: "春节" }],
      workday: { region: "cn", name: "春节", isWorkday: false },
    });
    expect(getChinaHolidayDay({ year: 2026, month: 2, day: 28 }, "zh-CN")).toEqual({
      coverage: "available",
      holidays: [],
      workday: { region: "cn", name: "春节", isWorkday: true },
    });
  });

  it("distinguishes an ordinary covered date from an unavailable year", () => {
    expect(getChinaHolidayDay({ year: 2026, month: 3, day: 3 }, "en-US")).toEqual({
      coverage: "available",
      holidays: [],
      workday: null,
    });
    expect(getChinaHolidayDay({ year: 2027, month: 1, day: 1 }, "en-US")).toEqual({
      coverage: "unavailable",
      holidays: [],
      workday: null,
    });
  });

  it("exposes annual coverage independently from an individual holiday", () => {
    expect(getChinaHolidayYearCoverage(2026)).toBe("available");
    expect(getChinaHolidayYearCoverage(2027)).toBe("unavailable");
  });

  it("localizes known holiday names for Traditional Chinese without mutating the source", () => {
    const result = getChinaHolidayDay({ year: 2026, month: 10, day: 1 }, "zh-Hant");

    expect(result.holidays).toEqual([{ region: "cn", name: "國慶節" }]);
    expect(result.workday?.name).toBe("國慶節");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.holidays)).toBe(true);
    expect(Object.isFrozen(result.holidays[0])).toBe(true);
    expect(Object.isFrozen(result.workday)).toBe(true);
  });

  it("localizes holidays and their adjusted workdays in English", () => {
    expect(getChinaHolidayDay({ year: 2026, month: 2, day: 17 }, "en-US")).toEqual({
      coverage: "available",
      holidays: [{ region: "cn", name: "Spring Festival" }],
      workday: { region: "cn", name: "Spring Festival", isWorkday: false },
    });
    expect(getChinaHolidayDay({ year: 2026, month: 2, day: 28 }, "en-US")).toEqual({
      coverage: "available",
      holidays: [],
      workday: { region: "cn", name: "Spring Festival", isWorkday: true },
    });
  });

  it.each(["ar", "fa", "he", "am", "hi"])(
    "falls back to the English holiday name for unsupported locale %s",
    (locale) => {
      expect(getChinaHolidayDay({ year: 2026, month: 2, day: 17 }, locale)).toEqual({
        coverage: "available",
        holidays: [{ region: "cn", name: "Spring Festival" }],
        workday: { region: "cn", name: "Spring Festival", isWorkday: false },
      });
    },
  );
});
