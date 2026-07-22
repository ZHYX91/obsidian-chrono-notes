import { describe, expect, it } from "vitest";

import type { CalendarOverlayId } from "../../src/core/calendar/calendar-overlay";
import {
  CALENDAR_OVERLAY_DEFINITIONS,
  selectCalendarOverlayDays,
  updateCalendarOverlaySlot,
} from "../../src/features/calendar/calendar-overlay-registry";

describe("calendar overlay registry", () => {
  it("registers each supported provider once in stable product order", () => {
    expect(CALENDAR_OVERLAY_DEFINITIONS.map(({ id }) => id)).toEqual([
      "chinese-lunar",
      "ganzhi",
    ]);
    expect(new Set(CALENDAR_OVERLAY_DEFINITIONS.map(({ id }) => id)).size).toBe(2);
  });

  it("returns recursively frozen results in selected slot order", () => {
    const result = selectCalendarOverlayDays(
      { year: 2026, month: 2, day: 17 },
      "zh-CN",
      ["ganzhi", "chinese-lunar"],
    );

    expect(result.map(({ id }) => id)).toEqual(["ganzhi", "chinese-lunar"]);
    expect(result[1]).toMatchObject({ dateText: "正月", eventText: "春节" });
    expect(Object.isFrozen(result)).toBe(true);
    expect(result.every(Object.isFrozen)).toBe(true);
  });

  it("rejects provider ids outside the explicit registry", () => {
    expect(() => selectCalendarOverlayDays(
      { year: 2026, month: 2, day: 17 },
      "zh-CN",
      ["unknown" as CalendarOverlayId],
    )).toThrow("Unknown calendar overlay: unknown");
  });

  it("updates compact ordered slots without allowing duplicate providers", () => {
    expect(updateCalendarOverlaySlot(["chinese-lunar"], 1, "ganzhi")).toEqual([
      "chinese-lunar",
      "ganzhi",
    ]);
    expect(updateCalendarOverlaySlot(["chinese-lunar", "ganzhi"], 0, null)).toEqual([
      "ganzhi",
    ]);
    expect(updateCalendarOverlaySlot(["chinese-lunar", "ganzhi"], 1, "chinese-lunar"))
      .toEqual(["chinese-lunar"]);
  });
});
