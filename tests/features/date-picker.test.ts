import { describe, expect, it } from "vitest";

import {
  createDatePickerModel,
  parseDateInput,
  shiftPickerMonth,
  shiftPickerYear,
} from "../../src/features/calendar/date-picker";

describe("date picker contracts", () => {
  it("parses every accepted date input format without rolling invalid dates", () => {
    expect(parseDateInput(" 2026-05-06 ")).toEqual({ year: 2026, month: 5, day: 6 });
    expect(parseDateInput("2026/05/06")).toEqual({ year: 2026, month: 5, day: 6 });
    expect(parseDateInput("2026.05.06")).toEqual({ year: 2026, month: 5, day: 6 });
    expect(parseDateInput("20260506")).toEqual({ year: 2026, month: 5, day: 6 });
    expect(parseDateInput("2024-02-29")).toEqual({ year: 2024, month: 2, day: 29 });

    expect(parseDateInput("2026-02-29")).toBeNull();
    expect(parseDateInput("2026-13-01")).toBeNull();
    expect(parseDateInput("2026-5-6")).toBeNull();
    expect(parseDateInput("2026-05-06T12:00:00")).toBeNull();
    expect(parseDateInput(" ")).toBeNull();
  });

  it("builds a frozen boundary-week model around the selected local date", () => {
    const model = createDatePickerModel(
      { year: 2026, month: 5, day: 6 },
      { year: 2026, month: 6 },
      "sunday",
    );

    expect(model).toMatchObject({
      selectedDate: { year: 2026, month: 5, day: 6 },
      displayMonth: { year: 2026, month: 6 },
      weekStartDay: "sunday",
    });
    expect(model.grid.days).toHaveLength(35);
    expect(model.grid.days[0]?.date).toEqual({ year: 2026, month: 5, day: 31 });
    expect(Object.isFrozen(model)).toBe(true);
    expect(Object.isFrozen(model.displayMonth)).toBe(true);
  });

  it("moves display months and years across calendar boundaries", () => {
    expect(shiftPickerMonth({ year: 2026, month: 1 }, -1)).toEqual({
      year: 2025,
      month: 12,
    });
    expect(shiftPickerMonth({ year: 2026, month: 12 }, 1)).toEqual({
      year: 2027,
      month: 1,
    });
    expect(shiftPickerYear({ year: 2024, month: 2 }, 2)).toEqual({
      year: 2026,
      month: 2,
    });
    expect(() => shiftPickerMonth({ year: 2026, month: 5 }, 0.5)).toThrow(
      "Date picker shift must be an integer",
    );
  });

});
