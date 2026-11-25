import { HOLIDAY_REGIONS } from "../../src/core/calendar/regional-holidays";
import { describe, expect, it } from "vitest";

import type { HolidayRegion } from "../../src/shared/settings";
import {
  HOLIDAY_REGION_DEFINITIONS,
  combineRegionalHolidayDays,
  selectRegionalHolidayDay,
  updateHolidayRegionSlot,
} from "../../src/features/calendar/holiday-region-registry";

describe("holiday region registry", () => {
  it("registers supported regions once in stable product order", () => {
    expect(HOLIDAY_REGION_DEFINITIONS.map(({ id }) => id).sort()).toEqual([...HOLIDAY_REGIONS].sort());
    expect(new Set(HOLIDAY_REGION_DEFINITIONS.map(({ id }) => id)).size).toBe(HOLIDAY_REGIONS.length);
  });

  it("maintains three compact ordered slots without duplicates", () => {
    expect(updateHolidayRegionSlot(["cn"], 2, "sg")).toEqual(["cn", "sg"]);
    expect(updateHolidayRegionSlot(["cn", "sg"], 0, null)).toEqual(["sg"]);
    expect(updateHolidayRegionSlot(["cn", "sg"], 2, "cn")).toEqual(["cn", "sg"]);
  });

  it("uses slot order for holiday markers but always prioritizes adjusted workdays", () => {
    const date = { year: 2026, month: 1, day: 1 };

    expect(selectRegionalHolidayDay(date, "en-US", ["sg", "cn"]).marker).toEqual({
      kind: "holiday",
      region: "sg",
    });
    expect(selectRegionalHolidayDay(date, "en-US", ["cn", "sg"]).marker).toEqual({
      kind: "rest",
      region: "cn",
    });
    expect(selectRegionalHolidayDay(
      { year: 2026, month: 2, day: 28 },
      "zh-CN",
      ["sg", "cn"],
    ).marker).toEqual({ kind: "work", region: "cn" });
  });

  it("keeps each region’s work status and uses the first adjusted workday for both summaries", () => {
    const rest = { region: "tw", name: "Substitute holiday", isWorkday: false } as const;
    const firstWork = { region: "ru", name: "Working Saturday", isWorkday: true } as const;
    const secondWork = { region: "vn", name: "Working Saturday", isWorkday: true } as const;
    for (const workdays of [[rest, firstWork, secondWork], [firstWork, secondWork, rest]]) {
      const combined = combineRegionalHolidayDays(workdays.map((workday) => ({
        region: workday.region,
        holidays: workday.isWorkday ? [] : [{ region: workday.region, name: workday.name }],
        workday,
      })));
      expect(combined.workday).toBe(firstWork);
      expect(combined.marker).toEqual({ kind: "work", region: "ru" });
      expect(combined.regionalDays.map((day) => day.workday)).toEqual(workdays);
      expect(Object.isFrozen(combined.regionalDays)).toBe(true);
    }
  });

  it("keeps employer-choice holidays visible without assigning a definite day off", () => {
    const day = selectRegionalHolidayDay({ year: 2027, month: 3, day: 26 }, "fr-CA", ["ca-qc"]);
    expect(day.holidays[0]).toMatchObject({ conditional: true });
    expect(day.marker).toBeNull();
  });

  it("rejects ids outside the explicit registry", () => {
    expect(() => selectRegionalHolidayDay(
      { year: 2026, month: 1, day: 1 },
      "en-US",
      ["unknown" as HolidayRegion],
    )).toThrow("Unknown holiday region: unknown");
  });
});
