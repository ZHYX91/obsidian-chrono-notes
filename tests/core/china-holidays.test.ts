import { describe, expect, it } from "vitest";

import {
  getChinaHolidayDay,
  getChinaHolidayYearCoverage,
} from "../../src/core/calendar/china-holidays";
import { formatLocalDateKey } from "../../src/core/periodic/periodic-date";

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
    expect(getChinaHolidayDay({ year: 2027, month: 3, day: 3 }, "en-US")).toEqual({
      coverage: "available",
      holidays: [],
      workday: null,
    });
    expect(getChinaHolidayDay({ year: 2028, month: 1, day: 1 }, "en-US")).toEqual({
      coverage: "unavailable",
      holidays: [],
      workday: null,
    });
  });

  it("exposes annual coverage independently from an individual holiday", () => {
    expect(getChinaHolidayYearCoverage(2026)).toBe("available");
    expect(getChinaHolidayYearCoverage(2027)).toBe("available");
    expect(getChinaHolidayYearCoverage(2028)).toBe("unavailable");
  });

  it("matches every date in the official 2027 Mainland China notice", () => {
    const holidays: string[] = [];
    const adjustedWorkdays: string[] = [];
    const year = 2027;

    for (let month = 1; month <= 12; month += 1) {
      const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
      for (let day = 1; day <= days; day += 1) {
        const date = { year, month, day };
        const result = getChinaHolidayDay(date, "zh-CN");
        const key = formatLocalDateKey(date).slice(5);
        expect(result.coverage, key).toBe("available");
        if (result.workday?.isWorkday === true) {
          expect(result.holidays, key).toEqual([]);
          adjustedWorkdays.push(`${key} ${result.workday.name}`);
        } else if (result.workday !== null) {
          expect(result.holidays, key).toEqual([{ region: "cn", name: result.workday.name }]);
          holidays.push(`${key} ${result.workday.name}`);
        } else {
          expect(result.holidays, key).toEqual([]);
        }
      }
    }

    expect(holidays).toEqual([
      "01-01 元旦节", "01-02 元旦节", "01-03 元旦节",
      "02-05 春节", "02-06 春节", "02-07 春节", "02-08 春节", "02-09 春节",
      "02-10 春节", "02-11 春节", "02-12 春节", "02-13 春节",
      "04-03 清明节", "04-04 清明节", "04-05 清明节",
      "05-01 劳动节", "05-02 劳动节", "05-03 劳动节", "05-04 劳动节", "05-05 劳动节",
      "06-09 端午节", "09-15 中秋节",
      "10-01 国庆节", "10-02 国庆节", "10-03 国庆节", "10-04 国庆节",
      "10-05 国庆节", "10-06 国庆节", "10-07 国庆节",
    ]);
    expect(adjustedWorkdays).toEqual([
      "01-31 春节", "02-14 春节", "05-08 劳动节", "09-26 国庆节", "10-09 国庆节",
    ]);
  });

  it("localizes known holiday names for Traditional Chinese without mutating the source", () => {
    const result = getChinaHolidayDay({ year: 2027, month: 10, day: 1 }, "zh-Hant");

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
      expect(getChinaHolidayDay({ year: 2027, month: 2, day: 5 }, locale)).toEqual({
        coverage: "available",
        holidays: [{ region: "cn", name: "Spring Festival" }],
        workday: { region: "cn", name: "Spring Festival", isWorkday: false },
      });
    },
  );
});
