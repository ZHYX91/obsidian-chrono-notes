import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";

import { getPeriodAnchor, getPeriodRange, shiftPeriod } from "../../src/core/periodic/periodic-date";
import { formatPeriodDate } from "../../src/core/periodic/period-format";
import { formatPeriodicNotePath, parsePeriodicNotePath } from "../../src/core/periodic/periodic-note-path";
import { renderBuiltinTemplate } from "../../src/core/template/builtin-template";

const options = { locale: "en", weekStartDay: "monday" } as const;
const date = (year: number) => ({ year, month: 9, day: 7 });

describe("long-period boundaries and formats", () => {
  it.each([
    [1999, 1990, 1901, 2000], [2000, 2000, 1901, 2000],
    [2001, 2000, 2001, 2100], [2009, 2000, 2001, 2100],
    [2010, 2010, 2001, 2100], [2099, 2090, 2001, 2100],
    [2100, 2100, 2001, 2100], [2101, 2100, 2101, 2200],
  ])("keeps independent boundaries for %i", (year, decade, centuryStart, centuryEnd) => {
    expect(getPeriodAnchor(date(year), "decadal", "monday").year).toBe(decade);
    const range = getPeriodRange(date(year), "century", "monday");
    expect(Object.isFrozen(range.start)).toBe(true);
    expect(Object.isFrozen(range.end)).toBe(true);
    expect(range.start).toEqual({ year: centuryStart, month: 1, day: 1 });
    expect(range.end).toEqual({ year: centuryEnd, month: 12, day: 31 });
    expect(shiftPeriod(date(year), "decadal", -1, "monday").year).toBe(decade - 10);
    expect(shiftPeriod(date(year), "century", 1, "monday").year).toBe(centuryStart + 100);
  });

  it.each(["en", "zh-CN", "ar", "fa", "he", "hi", "am"])("keeps extension digits fixed in %s", (locale) => {
    const value = DateTime.fromISO("2026-09-07", { zone: "UTC", locale });
    expect(formatPeriodDate(value, "DEC[s]/CEN/DEC[年代]")).toBe("2020s/21/2020年代");
    expect(formatPeriodDate(value, "[DEC/CEN] \\D\\E\\C")).toBe("DEC/CEN DEC");
    expect(formatPeriodDate(value, "[unclosed")).toBeNull();
    expect(formatPeriodDate(value, "CBASE")).toBeNull();
  });

  it.each(["decadal", "century"] as const)("round trips %s paths including redundant native fields", (noteType) => {
    const formats = noteType === "decadal"
      ? ["[diary]/DEC[s]", "[C]CEN/DEC[s]", "DEC/DEC/YYYY"]
      : ["[diary]/[C]CEN", "CEN/YYYY", "CEN/DEC/YYYY"];
    for (const pattern of formats) for (const year of [1900, 2000, 2001, 2026, 2100, 2101]) {
      const rule = { noteType, pattern };
      const path = formatPeriodicNotePath(date(year), rule, options);
      expect(path).not.toBeNull();
      expect(parsePeriodicNotePath(path ?? "", rule, options)).toEqual(getPeriodAnchor(date(year), noteType, "monday"));
    }
  });

  it("rejects noncanonical and conflicting extension fields", () => {
    for (const path of ["C21/2000s.md", "C20/2001s.md", "C020/2000s.md"]) {
      expect(parsePeriodicNotePath(path, { noteType: "decadal", pattern: "[C]CEN/DEC[s]" }, options)).toBeNull();
    }
    expect(parsePeriodicNotePath("2020/2030.md", { noteType: "decadal", pattern: "DEC/DEC" }, options)).toBeNull();
    expect(parsePeriodicNotePath("C20/2005.md", { noteType: "yearly", pattern: "[C]CEN/YYYY" }, options)).toBeNull();
  });

  it.each(["daily", "weekly", "monthly", "quarterly", "yearly", "decadal"] as const)(
    "does not let a century token collapse distinct %s notes into one file", (noteType) => {
      const rule = { noteType, pattern: "[diary]/[C]CEN" };
      expect(formatPeriodicNotePath(date(2026), rule, options)).toBeNull();
      expect(parsePeriodicNotePath("diary/C21.md", rule, options)).toBeNull();
    },
  );

  it("uses the canonical Sunday anchor for extensions while preserving ISO week identity", () => {
    const rule = { noteType: "weekly", pattern: "[C]CEN/DEC[s]/GGGG-[W]WW" } as const;
    const sunday = { ...options, weekStartDay: "sunday" } as const;
    const path = formatPeriodicNotePath({ year: 2000, month: 12, day: 31 }, rule, sunday);
    expect(path).toBe("C20/2000s/2001-W01.md");
    expect(parsePeriodicNotePath(path ?? "", rule, sunday)).toEqual({ year: 2000, month: 12, day: 31 });
  });

  it("renders period bounds inclusively and does not reinterpret inserted titles", () => {
    const range = getPeriodRange(date(2026), "decadal", "monday");
    expect(range.dayCount).toBe(3653);
    expect(renderBuiltinTemplate("{{title}} | {{date:DEC[s]}} | {{start:YYYY}}–{{end:YYYY}} | {{days}}", {
      date: range.start, range, title: "{{date:CEN}}", now: new Date("2031-05-02T13:14:15Z"),
      locale: "en", timeZone: "UTC",
    })).toBe("{{date:CEN}} | 2020s | 2020–2029 | 3653");
    expect(getPeriodRange(date(2026), "century", "monday").dayCount).toBe(36524);
    const weekly = getPeriodRange({ year: 2026, month: 3, day: 8 }, "weekly", "sunday");
    expect(weekly.dayCount).toBe(7);
    expect(weekly.end).toEqual({ year: 2026, month: 3, day: 14 });
  });
});
