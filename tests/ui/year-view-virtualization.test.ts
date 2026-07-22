import { describe, expect, it } from "vitest";

import {
  INITIAL_RENDERED_QUARTERS,
  clampQuarter,
  formatQuarterPlaceholderHeight,
  getInitialRenderedQuarters,
  getQuarterWindow,
  isSelectedDayRendered,
} from "../../src/ui/calendar/year-view-virtualization";

describe("year view virtualization", () => {
  it("renders the first two quarters initially", () => {
    expect(INITIAL_RENDERED_QUARTERS).toEqual([1, 2]);
    expect([...getInitialRenderedQuarters()]).toEqual([1, 2]);
  });

  it("includes the selected month quarter when the visible year changes", () => {
    expect([...getInitialRenderedQuarters(7)]).toEqual([1, 2, 3, 4]);
    expect([...getInitialRenderedQuarters(12)]).toEqual([1, 2, 3, 4]);
  });

  it("clamps invalid and fractional quarter values", () => {
    expect(clampQuarter(-3)).toBe(1);
    expect(clampQuarter(2.9)).toBe(2);
    expect(clampQuarter(9)).toBe(4);
  });

  it("returns a clamped quarter window with configurable overscan", () => {
    expect(getQuarterWindow(1)).toEqual([1, 2]);
    expect(getQuarterWindow(2)).toEqual([1, 2, 3]);
    expect(getQuarterWindow(4)).toEqual([3, 4]);
    expect(getQuarterWindow(3, 0)).toEqual([3]);
    expect(getQuarterWindow(3, 2)).toEqual([1, 2, 3, 4]);
  });

  it("preserves the measured quarter height for responsive placeholders", () => {
    expect(formatQuarterPlaceholderHeight(42)).toBe("42px");
    expect(formatQuarterPlaceholderHeight(147)).toBe("147px");
    expect(formatQuarterPlaceholderHeight(160.25)).toBe("160.25px");
    expect(formatQuarterPlaceholderHeight(0)).toBeNull();
    expect(formatQuarterPlaceholderHeight(-1)).toBeNull();
    expect(formatQuarterPlaceholderHeight(Number.NaN)).toBeNull();
    expect(formatQuarterPlaceholderHeight(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("keeps a fallback tab stop until the selected day quarter is rendered", () => {
    const renderedQuarters = new Set([1, 2]);
    expect(isSelectedDayRendered(true, 7, renderedQuarters)).toBe(false);
    renderedQuarters.add(3);
    expect(isSelectedDayRendered(true, 7, renderedQuarters)).toBe(true);
    expect(isSelectedDayRendered(false, 7, renderedQuarters)).toBe(false);
  });
});
