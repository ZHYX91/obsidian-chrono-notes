import { describe, expect, it } from "vitest";

import {
  formatNarrowWeekdayLabels,
  formatShortMonthLabel,
  formatShortMonthLabels,
} from "../../src/ui/date-presentation";

describe("UI date presentation", () => {
  it("formats frozen narrow weekday labels from Monday or Sunday", () => {
    const mondayFirst = formatNarrowWeekdayLabels("en-US", "monday");
    const sundayFirst = formatNarrowWeekdayLabels("en-US", "sunday");

    expect(mondayFirst).toEqual(["M", "T", "W", "T", "F", "S", "S"]);
    expect(sundayFirst).toEqual(["S", "M", "T", "W", "T", "F", "S"]);
    expect(Object.isFrozen(mondayFirst)).toBe(true);
    expect(Object.isFrozen(sundayFirst)).toBe(true);
  });

  it("formats one short month and a frozen year of short month labels", () => {
    const labels = formatShortMonthLabels(2026, "en-US");

    expect(formatShortMonthLabel(2026, 7, "en-US")).toBe("Jul");
    expect(labels).toEqual([
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ]);
    expect(Object.isFrozen(labels)).toBe(true);
  });
});
