import { describe, expect, it } from "vitest";

import {
  getPeriodPickerAnchor,
  getPeriodPickerWindow,
  resolvePeriodGridNavigation,
} from "../../src/ui/calendar/calendar-period-picker";

describe("period picker pages", () => {
  it.each([
    [1999, 1901], [2000, 1901], [2001, 2001],
    [2026, 2001], [2100, 2001], [2101, 2101],
  ])("uses the containing century for %i", (year, century) => {
    expect(getPeriodPickerAnchor("century", year)).toBe(century);
  });

  it("labels complete centuries and pages by ten centuries", () => {
    const page = getPeriodPickerWindow("century", 2026);
    expect(page.title).toBe("C21–C30");
    expect(page.items[0]).toEqual({ start: 2001, end: 2100, label: "C21", detail: "2001–2100" });
    expect(page.previousYear).toBe(1001);
    expect(page.nextYear).toBe(3001);
    expect(getPeriodPickerWindow("century", page.previousYear ?? 0).items.at(-1))
      .toEqual({ start: 1901, end: 2000, label: "C20", detail: "1901–2000" });
  });

  it.each(["year", "century"] as const)("bounds %s pages and freezes their data", (kind) => {
    const first = getPeriodPickerWindow(kind, 1);
    const last = getPeriodPickerWindow(kind, 9999);
    expect(first.previousYear).toBeNull();
    expect(last.nextYear).toBeNull();
    expect(last.items.every((item) => item.start <= 9999)).toBe(true);
    expect(Object.isFrozen(last)).toBe(true);
    expect(Object.isFrozen(last.items)).toBe(true);
    expect(last.items.every(Object.isFrozen)).toBe(true);
    expect(() => getPeriodPickerWindow(kind, 0)).toThrow(RangeError);
    expect(() => getPeriodPickerWindow(kind, 10000)).toThrow(RangeError);
  });

  it("retains the full C100 boundary at the supported-year edge", () => {
    expect(getPeriodPickerWindow("century", 9999).items.at(-1))
      .toEqual({ start: 9901, end: 10000, label: "C100", detail: "9901–10000" });
  });

  it("moves with the visual column count and reverses horizontal movement in RTL", () => {
    expect(resolvePeriodGridNavigation("ArrowDown", 2, 10, 2, false)).toBe(4);
    expect(resolvePeriodGridNavigation("ArrowDown", 2, 10, 3, false)).toBe(5);
    expect(resolvePeriodGridNavigation("ArrowRight", 2, 10, 2, true)).toBe(1);
    expect(resolvePeriodGridNavigation("ArrowLeft", 2, 10, 2, true)).toBe(3);
    expect(resolvePeriodGridNavigation("ArrowUp", 0, 10, 2, false)).toBe(0);
    expect(resolvePeriodGridNavigation("End", 2, 10, 2, false)).toBe(9);
    expect(resolvePeriodGridNavigation("Home", 2, 10, 2, false)).toBe(0);
    expect(resolvePeriodGridNavigation("Enter", 2, 10, 2, false)).toBeNull();
  });
});
