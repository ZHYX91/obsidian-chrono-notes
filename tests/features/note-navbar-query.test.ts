import { describe, expect, it } from "vitest";

import {
  selectNoteNavbarContext,
  selectNoteNavbarContextFromProjection,
} from "../../src/features/periodic/note-navbar-query";
import type { NoteIndexSnapshot } from "../../src/features/notes/note-index";
import { createDefaultSettings } from "../../src/shared/settings";
import { createParsedNoteIndexSnapshot } from "../support/note-index-snapshot";

function snapshot(contents: Record<string, string>): NoteIndexSnapshot {
  return createParsedNoteIndexSnapshot(contents, 31);
}

function settings() {
  const value = createDefaultSettings();
  value.periodicNotes.daily = { enabled: true, pattern: "'Daily'/yyyy-MM-dd", templatePath: "" };
  value.periodicNotes.weekly = { enabled: true, pattern: "'Weekly'/kkkk-WW", templatePath: "" };
  value.periodicNotes.monthly = { enabled: true, pattern: "'Monthly'/yyyy-MM", templatePath: "" };
  value.periodicNotes.yearly = { enabled: true, pattern: "'Yearly'/yyyy", templatePath: "" };
  value.rangeNotes.scanScope = "entire-vault";
  return value;
}

describe("selectNoteNavbarContext", () => {
  it("recognizes an enabled exact periodic path and derives stable navigation targets", () => {
    const value = settings();
    const result = selectNoteNavbarContext("Weekly/2026-01.md", snapshot({}), {
      locale: "en-US",
      weekStartDay: "monday",
      periodicNotes: value.periodicNotes,
      rangeNotes: value.rangeNotes,
    });

    expect(result).toMatchObject({
      snapshotVersion: 31,
      noteType: "weekly",
      date: { year: 2025, month: 12, day: 29 },
      label: "Week 1",
      previous: { noteType: "weekly", date: { year: 2025, month: 12, day: 22 } },
      next: { noteType: "weekly", date: { year: 2026, month: 1, day: 5 } },
      higher: { noteType: "monthly", date: { year: 2025, month: 12, day: 1 } },
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result?.previous)).toBe(true);
  });

  it("rejects disabled, partial, and non-Markdown path matches", () => {
    const value = settings();
    value.periodicNotes.weekly.enabled = false;
    const options = {
      locale: "en-US",
      weekStartDay: "monday" as const,
      periodicNotes: value.periodicNotes,
      rangeNotes: value.rangeNotes,
    };
    expect(selectNoteNavbarContext("Weekly/2026-01.md", snapshot({}), options)).toBeNull();
    value.periodicNotes.weekly.enabled = true;
    expect(selectNoteNavbarContext("Archive/Weekly/2026-01.md", snapshot({}), options)).toBeNull();
    expect(selectNoteNavbarContext("Weekly/2026-01.txt", snapshot({}), options)).toBeNull();
  });

  it("targets the next enabled higher period and skips disabled levels", () => {
    const value = settings();
    value.periodicNotes.weekly.enabled = false;
    const result = selectNoteNavbarContext("Daily/2026-01-01.md", snapshot({}), {
      locale: "en-US",
      weekStartDay: "monday",
      periodicNotes: value.periodicNotes,
      rangeNotes: value.rangeNotes,
    });

    expect(result?.higher).toEqual({
      noteType: "monthly",
      date: { year: 2026, month: 1, day: 1 },
    });
  });

  it("skips enabled higher periods whose generated path cannot be parsed", () => {
    const value = settings();
    value.periodicNotes.weekly.enabled = false;
    value.periodicNotes.monthly.pattern = "'Monthly'";
    const result = selectNoteNavbarContext("Daily/2026-01-01.md", snapshot({}), {
      locale: "en-US",
      weekStartDay: "monday",
      periodicNotes: value.periodicNotes,
      rangeNotes: value.rangeNotes,
    });

    expect(result?.higher).toEqual({
      noteType: "yearly",
      date: { year: 2026, month: 1, day: 1 },
    });
  });

  it("selects only ranges overlapping weekly or monthly note boundaries", () => {
    const value = settings();
    const source = snapshot({
      "Ranges/before.md": "---\nstart: 2025-12-20\nend: 2025-12-30\n---",
      "Ranges/inside.md": "---\nstart: 2026-01-01\nend: 2026-01-02\n---",
      "Ranges/after.md": "---\nstart: 2026-01-04\nend: 2026-02-01\n---",
      "Ranges/outside.md": "---\nstart: 2026-02-02\nend: 2026-02-03\n---",
    });
    const options = {
      locale: "en-US",
      weekStartDay: "monday" as const,
      periodicNotes: value.periodicNotes,
      rangeNotes: value.rangeNotes,
    };

    expect(selectNoteNavbarContext("Weekly/2026-01.md", source, options)
      ?.relatedIntervals.map((item) => item.title)).toEqual(["before", "inside", "after"]);
    expect(selectNoteNavbarContext("Monthly/2026-01.md", source, options)
      ?.relatedIntervals.map((item) => item.title)).toEqual(["inside", "after"]);
    expect(selectNoteNavbarContext("Daily/2026-01-01.md", source, options)
      ?.relatedIntervals).toEqual([]);
  });

  it("keeps related ranges independent from calendar-bar visibility and carries statistics", () => {
    const value = settings();
    value.rangeNotes.showInCalendar = false;
    const source = snapshot({
      "Ranges/project.md": [
        "---",
        "start: 2026-01-01",
        "end: 2026-01-04",
        "---",
        "- [x] Done",
        "- [ ] Pending",
      ].join("\n"),
    });

    const related = selectNoteNavbarContext("Weekly/2026-01.md", source, {
      locale: "en-US",
      weekStartDay: "monday",
      periodicNotes: value.periodicNotes,
      rangeNotes: value.rangeNotes,
    })?.relatedIntervals;

    expect(related).toHaveLength(1);
    expect(related?.[0]?.statistics).toMatchObject({
      taskCompleted: 1,
      taskTotal: 2,
      taskCompletionRate: 50,
    });
  });

  it("selects related ranges from the interval projection without scanning notes", () => {
    const value = settings();
    const indexed = snapshot({
      "Ranges/project.md": "---\nstart: 2026-01-01\nend: 2026-01-04\n---",
      "Notes/ordinary.md": "ordinary",
    });
    const source = Object.freeze(Object.defineProperty(
      {
        version: indexed.version,
        taskDates: indexed.taskDates,
        intervals: indexed.intervals,
      },
      "notes",
      {
        enumerable: true,
        get(): never {
          throw new Error("navbar interval selection must not scan notes");
        },
      },
    )) as NoteIndexSnapshot;

    expect(selectNoteNavbarContext("Weekly/2026-01.md", source, {
      locale: "en-US",
      weekStartDay: "monday",
      periodicNotes: value.periodicNotes,
      rangeNotes: value.rangeNotes,
    })?.relatedIntervals.map((item) => item.path)).toEqual(["Ranges/project.md"]);

    expect(selectNoteNavbarContextFromProjection(
      "Weekly/2026-01.md",
      indexed.intervals,
      {
        locale: "en-US",
        weekStartDay: "monday",
        periodicNotes: value.periodicNotes,
        rangeNotes: value.rangeNotes,
      },
    )?.snapshotVersion).toBe(indexed.intervals.revision);
  });
});
