import { describe, expect, it } from "vitest";

import { createPeriodicNotePathPreview } from "../../src/ui/settings/periodic-note-settings-presentation";

describe("periodic path preview identity", () => {
  const options = { locale: "en-US", weekStartDay: "monday" as const };

  it("does not present a monthly path as a valid daily-note configuration", () => {
    expect(createPeriodicNotePathPreview(
      { year: 2026, month: 9, day: 14 }, "daily", "[Daily]/YYYY-MM", options,
    )).toEqual({ status: "invalid", path: null, reason: "unrecognized" });
    expect(createPeriodicNotePathPreview(
      { year: 2026, month: 9, day: 14 }, "monthly", "[Monthly]/YYYY-MM", options,
    )).toEqual({ status: "valid", path: "Monthly/2026-09.md" });
  });

  it("rejects a syntactically round-trippable path resolving to a different century", () => {
    expect(createPeriodicNotePathPreview(
      { year: 1905, month: 9, day: 14 }, "daily", "[Daily]/YY-MM-DD", options,
    )).toEqual({ status: "invalid", path: null, reason: "unrecognized" });
  });

  it("compares canonical periods rather than requiring the selected day to be the anchor", () => {
    expect(createPeriodicNotePathPreview(
      { year: 2023, month: 12, day: 31 }, "weekly", "[Weekly]/GGGG-[W]WW",
      { ...options, weekStartDay: "sunday" },
    )).toEqual({ status: "valid", path: "Weekly/2024-W01.md" });
    expect(createPeriodicNotePathPreview(
      { year: 2026, month: 9, day: 14 }, "quarterly", "[Quarterly]/YYYY-[Q]Q", options,
    )).toEqual({ status: "valid", path: "Quarterly/2026-Q3.md" });
  });
});
