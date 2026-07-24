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
    const invalid = createPeriodicNotePathPreview(date, "daily", "yyyy-MM-dd", {
      locale: "en-US",
      weekStartDay: "monday",
    });
    const valid = createPeriodicNotePathPreview(
      date,
      "daily",
      "[Calendar/Daily]/YYYY-MM-DD",
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

  it("accepts Moment tokens and rejects removed Luxon syntax", () => {
    expect(createPeriodicNotePathPreview(date, "daily", "YYYY-MM-DD", {
      locale: "zh-CN",
      weekStartDay: "monday",
    })).toEqual({ status: "valid", path: "2026-07-16.md" });
    expect(createPeriodicNotePathPreview(date, "daily", "[YYYY-DD]/YYYY-MM-DD", {
      locale: "zh-CN",
      weekStartDay: "monday",
    })).toEqual({ status: "valid", path: "YYYY-DD/2026-07-16.md" });
    expect(createPeriodicNotePathPreview(date, "daily", "日记/YYYY-MM-DD", {
      locale: "zh-CN",
      weekStartDay: "monday",
    })).toEqual({ status: "valid", path: "日记/2026-07-16.md" });
    expect(createPeriodicNotePathPreview(date, "daily", "yyyy-MM-dd", {
      locale: "zh-CN",
      weekStartDay: "monday",
    })).toEqual({ status: "invalid", path: null, reason: "unrecognized" });
  });

  it("provides distinct full-path and template examples for every note type", () => {
    expect([
      getPeriodicNotePathExample("daily"),
      getPeriodicNotePathExample("weekly"),
      getPeriodicNotePathExample("monthly"),
      getPeriodicNotePathExample("quarterly"),
      getPeriodicNotePathExample("yearly"),
    ]).toEqual([
      "[diary]/YYYY/YYYY-MM/YYYY-MM-DD",
      "[diary]/GGGG/GGGG-[W]WW",
      "[diary]/YYYY/YYYY-MM",
      "[diary]/YYYY/YYYY-[Q]Q",
      "[diary]/YYYY",
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

  it("round-trips every shared diary hierarchy example", () => {
    const options = { locale: "en-US", weekStartDay: "monday" as const };
    const examples = [
      ["daily", "diary/2026/2026-07/2026-07-24.md"],
      ["weekly", "diary/2026/2026-W30.md"],
      ["monthly", "diary/2026/2026-07.md"],
      ["quarterly", "diary/2026/2026-Q3.md"],
      ["yearly", "diary/2026.md"],
    ] as const;

    for (const [noteType, path] of examples) {
      expect(createPeriodicNotePathPreview(
        { year: 2026, month: 7, day: 24 },
        noteType,
        getPeriodicNotePathExample(noteType),
        options,
      )).toEqual({ status: "valid", path });
    }
  });

  it("previews Sunday-start ISO weeks with the canonical cross-year anchor", () => {
    expect(createPeriodicNotePathPreview(
      { year: 2023, month: 12, day: 31 },
      "weekly",
      "[Weekly]/GGGG-[W]WW",
      { locale: "en-US", weekStartDay: "sunday" },
    )).toEqual({ status: "valid", path: "Weekly/2024-W01.md" });
  });

  it("selects nested folders without adding a second persisted path setting", () => {
    expect(setPeriodicNoteFolder("", "Calendar\\Daily", "daily"))
      .toBe("[Calendar/Daily]/YYYY-MM-DD");
    expect(setPeriodicNoteFolder("Cal", "Calendar/Daily", "daily"))
      .toBe("[Calendar/Daily]/YYYY-MM-DD");
    expect(setPeriodicNoteFolder("[Old]/YYYY-[Q]Q", "/Archive/Quarterly/", "quarterly"))
      .toBe("[Archive/Quarterly]/YYYY-[Q]Q");
    expect(setPeriodicNoteFolder("YYYY", "", "yearly")).toBe("YYYY");
  });

  it("quotes suggested Vault folders for Moment round trips", () => {
    const pattern = setPeriodicNoteFolder("YYYY-MM-DD", "People/Bob's", "daily");
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
    expect(getPeriodicNoteFolderQuery("[Calendar/Daily]/YYYY-MM-DD")).toBe("Calendar/Daily");
    expect(getPeriodicNoteFolderQuery("[People/Bob's]/YYYY-MM-DD")).toBe("People/Bob's");
    expect(getPeriodicNoteFolderQuery("Cal")).toBe("Cal");
    expect(getPeriodicNoteFolderQuery("[Cal")).toBe("Cal");
    expect(getPeriodicNoteFolderQuery("YYYY-MM-DD")).toBe("");
  });
});
