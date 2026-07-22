import { describe, expect, it } from "vitest";

import {
  buildCalendarWeeks,
  getCalendarWeek,
  getCalendarWeekIdentity,
  getWeeksInWeekYear,
  moveDateToCalendarWeek,
  moveDateToCalendarWeekYear,
} from "../../src/core/periodic/calendar-week";

describe("calendar week rules", () => {
  it("derives 52- and 53-week ISO week years instead of hard-coding a limit", () => {
    expect(getWeeksInWeekYear(2025)).toBe(52);
    expect(getWeeksInWeekYear(2026)).toBe(53);
    expect(buildCalendarWeeks(2026, "monday")).toHaveLength(53);
  });

  it("maps ISO week boundaries to Monday and Sunday calendar starts", () => {
    expect(getCalendarWeek(2026, 1, "monday")).toEqual({
      weekYear: 2026,
      weekNumber: 1,
      start: { year: 2025, month: 12, day: 29 },
      end: { year: 2026, month: 1, day: 4 },
    });
    expect(getCalendarWeek(2026, 1, "sunday")).toEqual({
      weekYear: 2026,
      weekNumber: 1,
      start: { year: 2025, month: 12, day: 28 },
      end: { year: 2026, month: 1, day: 3 },
    });
    expect(getCalendarWeekIdentity(
      { year: 2025, month: 12, day: 28 },
      "sunday",
    )).toEqual({ weekYear: 2026, weekNumber: 1 });
    expect(getCalendarWeek(2026, 53, "monday")).toMatchObject({
      start: { year: 2026, month: 12, day: 28 },
      end: { year: 2027, month: 1, day: 3 },
    });
    expect(getCalendarWeek(2026, 53, "sunday")).toMatchObject({
      start: { year: 2026, month: 12, day: 27 },
      end: { year: 2027, month: 1, day: 2 },
    });
    expect(getCalendarWeekIdentity(
      { year: 2027, month: 1, day: 1 },
      "monday",
    )).toEqual({ weekYear: 2026, weekNumber: 53 });
  });

  it.each(["monday", "sunday"] as const)(
    "keeps the selected weekday when choosing a %s-start week",
    (weekStartDay) => {
      const selected = weekStartDay === "monday"
        ? { year: 2026, month: 7, day: 22 }
        : { year: 2026, month: 7, day: 21 };

      expect(moveDateToCalendarWeek(selected, 2026, 1, weekStartDay)).toEqual(
        weekStartDay === "monday"
          ? { year: 2025, month: 12, day: 31 }
          : { year: 2025, month: 12, day: 30 },
      );
    },
  );

  it("clamps W53 when the target week year has only 52 weeks", () => {
    const selected = { year: 2026, month: 12, day: 31 };

    expect(getCalendarWeekIdentity(selected, "monday")).toEqual({
      weekYear: 2026,
      weekNumber: 53,
    });
    expect(moveDateToCalendarWeekYear(selected, 2027, "monday")).toEqual({
      year: 2027,
      month: 12,
      day: 30,
    });
    expect(getCalendarWeekIdentity(
      moveDateToCalendarWeekYear(selected, 2027, "monday"),
      "monday",
    )).toEqual({ weekYear: 2027, weekNumber: 52 });
  });

  it("rejects a nonexistent W53 in a 52-week year", () => {
    expect(() => getCalendarWeek(2027, 53, "monday")).toThrow(
      "Invalid calendar week: 2027-W53",
    );
  });
});
