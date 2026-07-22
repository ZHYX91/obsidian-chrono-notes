import { describe, expect, it } from "vitest";

import type { HolidayRegion } from "../../src/shared/settings";
import {
  HOLIDAY_REGION_DEFINITIONS,
  selectRegionalHolidayDay,
  updateHolidayRegionSlot,
} from "../../src/features/calendar/holiday-region-registry";

describe("holiday region registry", () => {
  it("registers supported regions once in stable product order", () => {
    expect(HOLIDAY_REGION_DEFINITIONS.map(({ id }) => id)).toEqual(["cn", "sg"]);
    expect(new Set(HOLIDAY_REGION_DEFINITIONS.map(({ id }) => id)).size).toBe(2);
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

  it("rejects ids outside the explicit registry", () => {
    expect(() => selectRegionalHolidayDay(
      { year: 2026, month: 1, day: 1 },
      "en-US",
      ["unknown" as HolidayRegion],
    )).toThrow("Unknown holiday region: unknown");
  });
});
