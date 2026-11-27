import { describe, expect, it } from "vitest";

import {
  getEastAsianLunarDate,
  getEastAsianLunarDay,
  isEastAsianLunarDateSupported,
} from "../../src/core/calendar/east-asian-lunar";
import {
  UTC9_LUNAR_YEARS,
  VIETNAMESE_LUNAR_YEARS,
} from "../../src/core/calendar/east-asian-lunar-years";
import type { LocalDate } from "../../src/core/periodic/periodic-date";

function localDate(iso: string): LocalDate {
  const stamp = new Date(iso);
  return { year: stamp.getUTCFullYear(), month: stamp.getUTCMonth() + 1, day: stamp.getUTCDate() };
}

const leapText = (month: string) => `leap ${month}`;

describe("modern East Asian lunisolar dates", () => {
  // The Vietnamese UTC+7 rules, with independent boundary examples:
  // https://xemamlich.uhm.vn/calrules_en.html
  it.each([
    ["1985-01-21", 1985, 1, 1, false],
    ["1985-03-21", 1985, 2, 1, true],
    ["1985-04-19", 1985, 2, 30, true],
    ["2007-02-17", 2007, 1, 1, false],
    ["2030-02-02", 2030, 1, 1, false],
    ["2025-07-25", 2025, 6, 1, true],
    ["2031-04-30", 2031, 3, 10, true],
  ] as const)("converts Vietnamese lunar dates on %s", (iso, year, month, day, isLeapMonth) => {
    expect(getEastAsianLunarDate(localDate(iso), "vietnamese-lunar"))
      .toEqual({ year, month, day, isLeapMonth });
  });

  // KASI's month-two conjunction on 2017-02-26 at 23:58 Korean time.
  // https://astro.kasi.re.kr/life/pageView/1
  // https://www.kasi.re.kr/kor/publication/post/newsMaterial/2151
  it.each([
    ["2017-02-25", 2017, 1, 29, false],
    ["2017-02-26", 2017, 2, 1, false],
    ["2017-03-27", 2017, 2, 30, false],
    ["2017-03-28", 2017, 3, 1, false],
    ["2025-07-25", 2025, 6, 1, true],
    ["2028-01-26", 2027, 12, 30, false],
    ["2028-01-27", 2028, 1, 1, false],
  ] as const)("preserves Korean reference dates on %s", (iso, year, month, day, isLeapMonth) => {
    expect(getEastAsianLunarDate(localDate(iso), "korean-lunar"))
      .toEqual({ year, month, day, isLeapMonth });
  });

  // NAOJ publishes multiple assignments for this span; the calendar industry
  // association recommends leap month 11. https://www.nao.ac.jp/news/blog/2023/20230829-koyomi.html
  it.each([
    ["2033-08-25", 2033, 8, false],
    ["2033-09-23", 2033, 9, false],
    ["2033-11-22", 2033, 11, false],
    ["2033-12-22", 2033, 11, true],
    ["2034-01-20", 2033, 12, false],
    ["2034-02-19", 2034, 1, false],
  ] as const)("uses the published Japanese leap-month convention on %s", (iso, year, month, isLeapMonth) => {
    expect(getEastAsianLunarDate(localDate(iso), "japanese-lunisolar"))
      .toEqual({ year, month, day: 1, isLeapMonth });
  });

  it.each([
    ["vietnamese-lunar", "1976-01-01", "1975-12-31", "2050-12-31", "2051-01-01"],
    ["korean-lunar", "1962-01-01", "1961-12-31", "2050-12-31", "2051-01-01"],
    ["japanese-lunisolar", "1900-01-01", "1899-12-31", "2099-12-31", "2100-01-01"],
  ] as const)("bounds %s by Gregorian dates and covers the preceding lunar year", (id, first, before, last, after) => {
    for (const iso of [before, after]) {
      expect(isEastAsianLunarDateSupported(localDate(iso), id)).toBe(false);
      expect(() => getEastAsianLunarDate(localDate(iso), id)).toThrow(RangeError);
    }
    const start = localDate(first);
    expect(getEastAsianLunarDate(start, id).year).toBe(start.year - 1);
    expect(getEastAsianLunarDate(localDate(last), id).year).toBe(localDate(last).year);
    expect(() => getEastAsianLunarDate({ year: 2026, month: 2, day: 30 }, id)).toThrow(RangeError);
  });

  it("preserves all regular and leap month lengths across consecutive lunar years", () => {
    for (const [rows, start] of [[UTC9_LUNAR_YEARS, 1899], [VIETNAMESE_LUNAR_YEARS, 1975]] as const) {
      for (const [i, [offset, leap, lengths]] of rows.entries()) {
        expect(leap).toBeGreaterThanOrEqual(0);
        expect(leap).toBeLessThanOrEqual(12);
        expect(lengths).toMatch(/^[01]+$/);
        expect(lengths).toHaveLength(leap === 0 ? 12 : 13);
        const next = rows[i + 1];
        if (next === undefined) continue;
        const days = Array.from(lengths).reduce((total, bit) => total + 29 + Number(bit), 0);
        const startDate = Date.UTC(start + i, 0, 1 + offset);
        const endDate = Date.UTC(start + i + 1, 0, 1 + next[0]);
        expect((endDate - startDate) / 86_400_000).toBe(days);
      }
    }
  });

  it.each([
    ["vietnamese-lunar", "2030-02-02", "vn-new-year"],
    ["vietnamese-lunar", "2025-04-07", "vn-hung-kings"],
    ["vietnamese-lunar", "2026-09-25", "vn-mid-autumn"],
    ["korean-lunar", "2028-01-26", null],
    ["korean-lunar", "2028-01-27", "kr-new-year"],
    ["korean-lunar", "2026-09-25", "kr-autumn"],
    ["japanese-lunisolar", "2024-09-17", "jp-moon-viewing"],
    ["japanese-lunisolar", "2024-09-18", null],
    ["japanese-lunisolar", "2025-10-06", "jp-moon-viewing"],
    ["vietnamese-lunar", "2031-04-30", null], // Leap month 3, day 10.
  ] as const)("reports local festivals for %s on %s", (id, iso, expected) => {
    expect(getEastAsianLunarDay(localDate(iso), "en", id, leapText).festival).toBe(expected);
  });

  it("retains the year and localized leap marker in details and keeps ordinary day cells compact", () => {
    const id = "japanese-lunisolar";
    const newYear = getEastAsianLunarDay(localDate("2034-02-19"), "ja", id, leapText);
    expect(newYear.transition).toBe("year-month");
    expect(newYear.dateText).toContain("2034");
    const first = getEastAsianLunarDay(localDate("2033-12-22"), "ja", id, (m) => `閏${m}`);
    expect(first.dateText).toContain("閏11");
    expect(first.transition).toBe("month");
    const ordinary = getEastAsianLunarDay(localDate("2033-12-23"), "vi", id, (m) => `${m} nhuận`);
    expect(ordinary.dateText).toBe("2");
    expect(ordinary.accessibilityText).toContain("11 nhuận");
    expect(ordinary.transition).toBeNull();
    const arabic = getEastAsianLunarDay(localDate("2033-12-23"), "ar-u-nu-arab", id, leapText);
    expect(arabic.dateText).toBe("٢");
    expect(getEastAsianLunarDay(localDate("2033-12-23"), "invalid_locale", id, leapText).dateText).toBe("2");
  });
});
