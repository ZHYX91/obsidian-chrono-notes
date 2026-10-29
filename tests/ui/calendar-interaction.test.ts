import { describe, expect, it } from "vitest";

import { moveCalendarSelection } from "../../src/ui/calendar/calendar-interaction";

describe("moveCalendarSelection", () => {
  it.each([
    [{ year: 1, month: 1, day: 1 }, "ArrowLeft", "ltr"],
    [{ year: 1, month: 1, day: 1 }, "ArrowRight", "rtl"],
    [{ year: 1, month: 1, day: 1 }, "ArrowUp", "ltr"],
    [{ year: 9999, month: 12, day: 31 }, "ArrowRight", "ltr"],
    [{ year: 9999, month: 12, day: 31 }, "ArrowLeft", "rtl"],
    [{ year: 9999, month: 12, day: 31 }, "ArrowDown", "ltr"],
  ] as const)("keeps a boundary date inside interactive years %#", (date, key, direction) => {
    expect(moveCalendarSelection(date, key, direction)).toBe(date);
  });

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

  it.each([
    ["ArrowLeft", { year: 2024, month: 9, day: 2 }],
    ["ArrowRight", { year: 2024, month: 8, day: 31 }],
    ["ArrowUp", { year: 2024, month: 8, day: 25 }],
    ["ArrowDown", { year: 2024, month: 9, day: 8 }],
  ] as const)("keeps %s aligned with an RTL grid", (key, expected) => {
    expect(moveCalendarSelection({ year: 2024, month: 9, day: 1 }, key, "rtl"))
      .toEqual(expected);
  });
});
