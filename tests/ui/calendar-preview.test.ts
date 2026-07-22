import { describe, expect, it } from "vitest";

import {
  placeCalendarPreview,
  shouldDismissCalendarPreview,
} from "../../src/ui/calendar/calendar-preview";

describe("placeCalendarPreview", () => {
  it("centers a preview below its anchor when there is room", () => {
    expect(placeCalendarPreview(
      { left: 100, top: 40, width: 40, height: 30 },
      { width: 120, height: 80 },
      { width: 500, height: 400 },
    )).toEqual({ left: 60, top: 76, maxHeight: 240 });
  });

  it("moves above the anchor when the lower viewport edge would be crossed", () => {
    expect(placeCalendarPreview(
      { left: 200, top: 330, width: 40, height: 30 },
      { width: 140, height: 100 },
      { width: 500, height: 400 },
    )).toEqual({ left: 150, top: 224, maxHeight: 240 });
  });

  it("clamps oversized edge positions to the viewport margin", () => {
    expect(placeCalendarPreview(
      { left: 0, top: 0, width: 20, height: 20 },
      { width: 280, height: 300 },
      { width: 240, height: 180 },
    )).toEqual({ left: 12, top: 26, maxHeight: 142 });
  });

  it("dismisses an active preview when hover previews are disabled", () => {
    expect(shouldDismissCalendarPreview(true)).toBe(false);
    expect(shouldDismissCalendarPreview(false)).toBe(true);
  });
});
