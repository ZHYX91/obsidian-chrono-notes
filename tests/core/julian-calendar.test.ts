import { describe, expect, it } from "vitest";
import { getJulianDay, toJulianDate } from "../../src/core/calendar/julian";
import { selectCalendarExtensionDays } from "../../src/features/calendar/calendar-extension-registry";

describe("additional daily calendars", () => {
  it("preserves Julian century leap days and changes the offset only after February", () => {
    expect(toJulianDate({ year: 1900, month: 3, day: 13 })).toEqual({ year: 1900, month: 2, day: 29 });
    expect(getJulianDay({ year: 1900, month: 3, day: 13 }, "en").accessibilityText).toBe("February 29, 1900");
    expect(getJulianDay({ year: 1900, month: 3, day: 14 }, "en").transition).toBe("month");
    expect(getJulianDay({ year: 2100, month: 3, day: 15 }, "en").accessibilityText).toBe("March 1, 2100");
  });
  it("uses the previous Julian year and formats an early year without the 1900 offset", () => {
    expect(getJulianDay({ year: 2027, month: 1, day: 7 }, "en").accessibilityText).toBe("December 25, 2026");
    expect(getJulianDay({ year: 2027, month: 1, day: 14 }, "en").transition).toBe("year-month");
    expect(toJulianDate({ year: 12, month: 3, day: 1 })).toEqual({ year: 12, month: 3, day: 3 });
  });
  it("returns distinct Coptic and Julian dates from the normal query", () => {
    const [coptic, julian] = selectCalendarExtensionDays({year: 2025, month: 9, day: 11}, "en", ["coptic", "julian"]);
    expect(coptic?.transition).toBe("year-month");
    expect(coptic?.accessibilityText).toContain("1742");
    expect(julian?.accessibilityText).toBe("August 29, 2025");
  });
});
