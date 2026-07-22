import { describe, expect, it } from "vitest";

import { formatPeriodicNotePath } from "../../src/core/periodic/periodic-note-path";
import {
  createPeriodicNotePathPreview,
  getPeriodicNotePathExample,
  getPeriodicNoteTemplatePathExample,
  getPeriodicNoteFolderQuery,
  setPeriodicNoteFolder,
} from "../../src/ui/settings/periodic-note-settings-presentation";

describe("periodic note settings presentation", () => {
  const date = { year: 2026, month: 7, day: 16 } as const;

  it("distinguishes empty, invalid, and round-trippable path previews", () => {
    const empty = createPeriodicNotePathPreview(date, "daily", "", {
      locale: "en-US",
      weekStartDay: "monday",
    });
    const invalid = createPeriodicNotePathPreview(date, "daily", "yyyy-MM-dd HH a", {
      locale: "en-US",
      weekStartDay: "monday",
    });
    const valid = createPeriodicNotePathPreview(
      date,
      "daily",
      "'Calendar/Daily'/yyyy-MM-dd",
      { locale: "en-US", weekStartDay: "monday" },
    );

    expect(empty).toEqual({ status: "empty", path: null });
    expect(invalid).toEqual({
      status: "invalid",
      path: null,
      reason: "unrecognized",
    });
    expect(valid).toEqual({ status: "valid", path: "Calendar/Daily/2026-07-16.md" });
    expect(Object.isFrozen(empty)).toBe(true);
    expect(Object.isFrozen(invalid)).toBe(true);
    expect(Object.isFrozen(valid)).toBe(true);
  });

  it("explains common Obsidian Moment tokens without flagging quoted literals", () => {
    expect(createPeriodicNotePathPreview(date, "daily", "YYYY-MM-DD", {
      locale: "zh-CN",
      weekStartDay: "monday",
    })).toEqual({ status: "invalid", path: null, reason: "moment-tokens" });
    expect(createPeriodicNotePathPreview(date, "daily", "'YYYY-DD'/yyyy-MM-dd", {
      locale: "zh-CN",
      weekStartDay: "monday",
    })).toEqual({ status: "valid", path: "YYYY-DD/2026-07-16.md" });
    expect(createPeriodicNotePathPreview(date, "daily", "日记/yyyy-MM-dd", {
      locale: "zh-CN",
      weekStartDay: "monday",
    })).toEqual({ status: "valid", path: "日记/2026-07-16.md" });
  });

  it("provides distinct full-path and template examples for every note type", () => {
    expect([
      getPeriodicNotePathExample("daily"),
      getPeriodicNotePathExample("weekly"),
      getPeriodicNotePathExample("monthly"),
      getPeriodicNotePathExample("quarterly"),
      getPeriodicNotePathExample("yearly"),
    ]).toEqual([
      "'Daily'/yyyy-MM-dd",
      "'Weekly'/kkkk-'W'WW",
      "'Monthly'/yyyy-MM",
      "'Quarterly'/yyyy-'Q'q",
      "'Yearly'/yyyy",
    ]);
    expect([
      getPeriodicNoteTemplatePathExample("daily"),
      getPeriodicNoteTemplatePathExample("weekly"),
      getPeriodicNoteTemplatePathExample("monthly"),
      getPeriodicNoteTemplatePathExample("quarterly"),
      getPeriodicNoteTemplatePathExample("yearly"),
    ]).toEqual([
      "Templates/Daily.md",
      "Templates/Weekly.md",
      "Templates/Monthly.md",
      "Templates/Quarterly.md",
      "Templates/Yearly.md",
    ]);
  });

  it("previews Sunday-start ISO weeks with the canonical cross-year anchor", () => {
    expect(createPeriodicNotePathPreview(
      { year: 2023, month: 12, day: 31 },
      "weekly",
      "'Weekly'/kkkk-'W'WW",
      { locale: "en-US", weekStartDay: "sunday" },
    )).toEqual({ status: "valid", path: "Weekly/2024-W01.md" });
  });

  it("selects nested folders without adding a second persisted path setting", () => {
    expect(setPeriodicNoteFolder("", "Calendar\\Daily", "daily"))
      .toBe("'Calendar/Daily'/yyyy-MM-dd");
    expect(setPeriodicNoteFolder("Cal", "Calendar/Daily", "daily"))
      .toBe("'Calendar/Daily'/yyyy-MM-dd");
    expect(setPeriodicNoteFolder("'Old'/yyyy-'Q'q", "/Archive/Quarterly/", "quarterly"))
      .toBe("'Archive/Quarterly'/yyyy-'Q'q");
    expect(setPeriodicNoteFolder("yyyy", "", "yearly")).toBe("yyyy");
  });

  it("quotes apostrophes in suggested Vault folders for Luxon round trips", () => {
    const pattern = setPeriodicNoteFolder("yyyy-MM-dd", "People/Bob's", "daily");
    expect(formatPeriodicNotePath(date, { noteType: "daily", pattern }, {
      locale: "en-US",
      weekStartDay: "monday",
    })).toBe("People/Bob's/2026-07-16.md");
    expect(createPeriodicNotePathPreview(date, "daily", pattern, {
      locale: "en-US",
      weekStartDay: "monday",
    })).toEqual({ status: "valid", path: "People/Bob's/2026-07-16.md" });
  });

  it("extracts only the folder portion for inline suggestion filtering", () => {
    expect(getPeriodicNoteFolderQuery("'Calendar/Daily'/yyyy-MM-dd")).toBe("Calendar/Daily");
    expect(getPeriodicNoteFolderQuery("'People/Bob''''s'/yyyy-MM-dd")).toBe("People/Bob's");
    expect(getPeriodicNoteFolderQuery("Cal")).toBe("Cal");
    expect(getPeriodicNoteFolderQuery("'Cal")).toBe("Cal");
    expect(getPeriodicNoteFolderQuery("yyyy-MM-dd")).toBe("");
  });
});
