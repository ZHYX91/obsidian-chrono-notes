import { describe, expect, it } from "vitest";

import {
  getCurrentLocalDate,
  getMillisecondsUntilNextLocalDay,
} from "../../src/shared/local-date-clock";

describe("local date clock", () => {
  it("reads local calendar fields without UTC drift", () => {
    expect(getCurrentLocalDate(new Date(2026, 6, 18, 23, 30))).toEqual({
      year: 2026,
      month: 7,
      day: 18,
    });
  });

  it("schedules against the next local midnight", () => {
    expect(
      getMillisecondsUntilNextLocalDay(new Date(2026, 6, 18, 23, 59, 59, 900)),
    ).toBe(100);
  });

  it("rejects an invalid clock value", () => {
    expect(() => getCurrentLocalDate(new Date(Number.NaN))).toThrow(
      "Invalid clock date",
    );
    expect(() => getMillisecondsUntilNextLocalDay(new Date(Number.NaN))).toThrow(
      "Invalid clock date",
    );
  });
});
