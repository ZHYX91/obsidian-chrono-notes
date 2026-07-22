import { describe, expect, it } from "vitest";

import { moveCalendarSelection } from "../../src/ui/calendar/calendar-interaction";

describe("moveCalendarSelection", () => {
  it.each([
    ["ArrowLeft", { year: 2024, month: 8, day: 31 }],
    ["ArrowRight", { year: 2024, month: 9, day: 2 }],
    ["ArrowUp", { year: 2024, month: 8, day: 25 }],
    ["ArrowDown", { year: 2024, month: 9, day: 8 }],
  ] as const)("moves selection for %s", (key, expected) => {
    expect(
      moveCalendarSelection({ year: 2024, month: 9, day: 1 }, key),
    ).toEqual(expected);
  });

  it("ignores unrelated keys", () => {
    const date = { year: 2024, month: 9, day: 1 };
    expect(moveCalendarSelection(date, "Escape")).toBe(date);
  });
});
