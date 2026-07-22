import { describe, expect, it } from "vitest";

import {
  compareLocalDate,
  formatLocalDateKey,
  getPeriodAnchor,
  isSameLocalDate,
  isSamePeriod,
  parseLocalDateKey,
  shiftPeriod,
  toUtcDate,
  type LocalDate,
  type PeriodicNoteType,
} from "../../src/core/periodic/periodic-date";

const mayDate: LocalDate = { year: 2026, month: 5, day: 18 };

describe("periodic date rules", () => {
  it("owns the canonical local-date key conversion", () => {
    const date = { year: 2026, month: 7, day: 8 };

    expect(formatLocalDateKey(date)).toBe("2026-07-08");
    expect(parseLocalDateKey("2026-07-08")).toEqual(date);
    expect(parseLocalDateKey("2026-7-8")).toBeNull();
    expect(parseLocalDateKey("2026-02-30")).toBeNull();
  });

  it("compares local dates and creates UTC formatter values without host-zone drift", () => {
    expect(compareLocalDate(mayDate, { year: 2026, month: 5, day: 17 })).toBeGreaterThan(0);
    expect(compareLocalDate(mayDate, { ...mayDate })).toBe(0);
    expect(compareLocalDate(mayDate, { year: 2027, month: 1, day: 1 })).toBeLessThan(0);
    expect(isSameLocalDate(mayDate, { ...mayDate })).toBe(true);
    expect(isSameLocalDate(mayDate, { year: 2026, month: 5, day: 19 })).toBe(false);
    expect(toUtcDate({ year: 2026, month: 7, day: 18 }).toISOString()).toBe(
      "2026-07-18T00:00:00.000Z",
    );
  });

  it.each<[PeriodicNoteType, LocalDate]>([
    ["daily", { year: 2026, month: 5, day: 18 }],
    ["weekly", { year: 2026, month: 5, day: 18 }],
    ["monthly", { year: 2026, month: 5, day: 1 }],
    ["quarterly", { year: 2026, month: 4, day: 1 }],
    ["yearly", { year: 2026, month: 1, day: 1 }],
  ])("canonicalizes %s notes", (noteType, expected) => {
    const weekStartDay = noteType === "weekly" ? "monday" : "sunday";
    expect(getPeriodAnchor(mayDate, noteType, weekStartDay)).toEqual(expected);
  });

  it("uses the configured first weekday across a year boundary", () => {
    const date = { year: 2024, month: 1, day: 1 };
    expect(getPeriodAnchor(date, "weekly", "monday")).toEqual(date);
    expect(getPeriodAnchor(date, "weekly", "sunday")).toEqual({
      year: 2023,
      month: 12,
      day: 31,
    });
  });

  it("compares canonical periods instead of display labels", () => {
    expect(isSamePeriod(mayDate, { ...mayDate }, "daily", "monday")).toBe(true);
    expect(
      isSamePeriod(mayDate, { year: 2026, month: 5, day: 19 }, "daily", "monday"),
    ).toBe(false);
    expect(
      isSamePeriod(
        { year: 2023, month: 12, day: 31 },
        { year: 2024, month: 1, day: 6 },
        "weekly",
        "sunday",
      ),
    ).toBe(true);
    expect(
      isSamePeriod(
        { year: 2024, month: 1, day: 1 },
        { year: 2024, month: 1, day: 8 },
        "weekly",
        "monday",
      ),
    ).toBe(false);
    expect(
      isSamePeriod(
        { year: 2026, month: 5, day: 1 },
        { year: 2026, month: 5, day: 31 },
        "monthly",
        "monday",
      ),
    ).toBe(true);
    expect(
      isSamePeriod(
        { year: 2026, month: 7, day: 18 },
        { year: 2026, month: 9, day: 30 },
        "quarterly",
        "monday",
      ),
    ).toBe(true);
    expect(
      isSamePeriod(
        { year: 2026, month: 1, day: 1 },
        { year: 2026, month: 12, day: 31 },
        "yearly",
        "monday",
      ),
    ).toBe(true);
  });

  it("moves between canonical periods without month-end drift", () => {
    expect(shiftPeriod({ year: 2024, month: 2, day: 29 }, "daily", 1, "monday")).toEqual({
      year: 2024,
      month: 3,
      day: 1,
    });
    expect(shiftPeriod(mayDate, "monthly", -1, "monday")).toEqual({
      year: 2026,
      month: 4,
      day: 1,
    });
    expect(shiftPeriod(mayDate, "quarterly", 1, "monday")).toEqual({
      year: 2026,
      month: 7,
      day: 1,
    });
    expect(shiftPeriod(mayDate, "yearly", -1, "monday")).toEqual({
      year: 2025,
      month: 1,
      day: 1,
    });
  });

  it("rejects impossible civil dates at the domain boundary", () => {
    expect(() => getPeriodAnchor({ year: 2026, month: 2, day: 30 }, "daily", "monday")).toThrow(
      "Invalid local date: 2026-02-30",
    );
  });
});
