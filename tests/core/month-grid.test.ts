import { describe, expect, it } from "vitest";

import { buildMonthGrid } from "../../src/core/calendar/month-grid";

describe("buildMonthGrid", () => {
  it("keeps six rows when the target month genuinely spans six calendar weeks", () => {
    const grid = buildMonthGrid(2024, 9, "monday");

    expect(grid.weeks).toHaveLength(6);
    expect(grid.days).toHaveLength(42);
    expect(grid.days[0]).toEqual({
      date: { year: 2024, month: 8, day: 26 },
      inCurrentMonth: false,
    });
    expect(grid.days.at(-1)).toEqual({
      date: { year: 2024, month: 10, day: 6 },
      inCurrentMonth: false,
    });
    expect(grid.weeks[0]).toMatchObject({ weekNumber: 35, weekYear: 2024 });
  });

  it("omits complete weeks that do not intersect the target month", () => {
    const grid = buildMonthGrid(2026, 7, "monday");

    expect(grid.weeks).toHaveLength(5);
    expect(grid.days).toHaveLength(35);
    expect(grid.days[0]?.date).toEqual({ year: 2026, month: 6, day: 29 });
    expect(grid.days.at(-1)?.date).toEqual({ year: 2026, month: 8, day: 2 });
    expect(grid.weeks.map(({ weekNumber }) => weekNumber)).toEqual([27, 28, 29, 30, 31]);
  });

  it("allows a four-row month when its boundaries align to complete weeks", () => {
    const grid = buildMonthGrid(2021, 2, "monday");

    expect(grid.weeks).toHaveLength(4);
    expect(grid.days).toHaveLength(28);
    expect(grid.days[0]?.date).toEqual({ year: 2021, month: 2, day: 1 });
    expect(grid.days.at(-1)?.date).toEqual({ year: 2021, month: 2, day: 28 });
  });

  it("uses Sunday starts while keeping ISO week labels aligned to Monday", () => {
    const grid = buildMonthGrid(2024, 9, "sunday");

    expect(grid.weeks).toHaveLength(5);
    expect(grid.days[0]?.date).toEqual({ year: 2024, month: 9, day: 1 });
    expect(grid.days.at(-1)?.date).toEqual({ year: 2024, month: 10, day: 5 });
    expect(grid.weeks[0]).toMatchObject({ weekNumber: 36, weekYear: 2024 });
  });

  it("rejects impossible target months", () => {
    expect(() => buildMonthGrid(2026, 13, "monday")).toThrow("Invalid calendar month");
  });
});
