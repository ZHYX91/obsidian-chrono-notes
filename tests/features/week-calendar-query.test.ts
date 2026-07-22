import { describe, expect, it } from "vitest";

import { selectWeekCalendar } from "../../src/features/calendar/week-calendar-query";
import type { NoteIndexSnapshot } from "../../src/features/notes/note-index";
import type { RangeNoteSettings } from "../../src/shared/settings";
import type { IcsEventIndexSnapshot } from "../../src/features/calendar/ics-event-index";
import { createParsedNoteIndexSnapshot } from "../support/note-index-snapshot";

const DISABLED_ICS: IcsEventIndexSnapshot = Object.freeze({
  version: 0,
  contentVersion: 0,
  state: "disabled",
  enabled: false,
  totalSources: 0,
  loadedSources: 0,
  eventCount: 0,
  skippedRecurring: 0,
  skippedInvalid: 0,
  truncatedEvents: 0,
  refreshedAt: null,
  sourceStatuses: Object.freeze([]),
  errors: Object.freeze([]),
  eventsByDate: Object.freeze({}),
});

function snapshot(contents: Record<string, string>): NoteIndexSnapshot {
  return createParsedNoteIndexSnapshot(contents, 23);
}

const RANGE_SETTINGS: RangeNoteSettings = {
  showInCalendar: true,
  folder: "Ranges",
  scanScope: "range-folder",
  customFolder: "",
  monthViewLimit: 2,
  weekViewLimit: 1,
};

describe("selectWeekCalendar", () => {
  it("resolves seven daily notes and the weekly note from one cross-year snapshot", () => {
    const source = snapshot({
      "Daily/2025-12-29.md": "Monday body",
      "Daily/2026-01-01.md": "---\nkind: daily\n---",
      "Weekly/2026-01.md": "Week body\n- [x] Complete",
    });
    const result = selectWeekCalendar(
      { year: 2026, month: 1, day: 1 },
      source,
      DISABLED_ICS,
      {
        locale: "en-US",
        weekStartDay: "monday",
        today: { year: 2026, month: 1, day: 1 },
        calendarOverlays: [],
        holidayRegions: [],
        daily: { enabled: true, pattern: "'Daily'/yyyy-MM-dd" },
        weekly: { enabled: true, pattern: "'Weekly'/kkkk-WW" },
        rangeNotes: RANGE_SETTINGS,
      },
    );

    expect(result.noteSnapshotVersion).toBe(23);
    expect(result.icsSnapshotVersion).toBe(0);
    expect(result.weekStart).toEqual({ year: 2025, month: 12, day: 29 });
    expect(result.weekEnd).toEqual({ year: 2026, month: 1, day: 4 });
    expect(result.weekNumber).toBe(1);
    expect(result.weekYear).toBe(2026);
    expect(result.days).toHaveLength(7);
    expect(result.days[0]).toMatchObject({
      date: { year: 2025, month: 12, day: 29 },
      notePath: "Daily/2025-12-29.md",
      noteState: "has-body",
      preview: "Monday body",
    });
    expect(result.days[3]).toMatchObject({
      date: { year: 2026, month: 1, day: 1 },
      noteState: "yaml-only",
    });
    expect(result.weeklyNote).toMatchObject({
      notePath: "Weekly/2026-01.md",
      noteState: "has-body",
      statistics: { taskCompleted: 1, taskTotal: 1, taskCompletionRate: 100 },
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.days)).toBe(true);
    expect(Object.isFrozen(result.days[0])).toBe(true);

    const sunday = selectWeekCalendar(
      { year: 2026, month: 1, day: 1 },
      source,
      DISABLED_ICS,
      {
        locale: "en-US",
        weekStartDay: "sunday",
        today: { year: 2026, month: 1, day: 1 },
        calendarOverlays: [],
        holidayRegions: [],
        daily: { enabled: false, pattern: "" },
        weekly: { enabled: false, pattern: "" },
        rangeNotes: { ...RANGE_SETTINGS, showInCalendar: false },
      },
    );
    expect(sunday.weekStart).toEqual({ year: 2025, month: 12, day: 28 });
    expect(sunday.weekEnd).toEqual({ year: 2026, month: 1, day: 3 });
    expect(sunday.weekNumber).toBe(1);
    expect(sunday.weekYear).toBe(2026);
    expect(sunday.days.every((day) => day.noteState === "not-configured")).toBe(
      true,
    );
    expect(sunday.weeklyNote.noteState).toBe("not-configured");
  });

  it("indexes due, scheduled, and start dates without duplicate same-day occurrences", () => {
    const result = selectWeekCalendar(
      { year: 2026, month: 1, day: 7 },
      snapshot({
        "Projects/alpha.md": [
          "- [ ] Mixed 📅 2026-01-05 ⏳ 2026-01-05",
          "- [ ] Scheduled with old due 📅 2026-01-01 ⏳ 2026-01-07",
          "- [x] Completed 📅 2026-01-08",
          "- [ ] Recent due 📅 2026-01-09",
          "- [ ] Invalid 📅 2026-99-99",
        ].join("\n"),
        "Projects/beta.md": [
          "- [ ] Starts 🛫 2026-01-06",
          "- [ ] Scheduled only ⏳ 2026-01-06",
        ].join("\n"),
      }),
      DISABLED_ICS,
      {
        locale: "en-US",
        weekStartDay: "monday",
        today: { year: 2026, month: 1, day: 10 },
        calendarOverlays: [],
        holidayRegions: [],
        daily: { enabled: false, pattern: "" },
        weekly: { enabled: false, pattern: "" },
        rangeNotes: { ...RANGE_SETTINGS, showInCalendar: false },
      },
    );

    expect(
      result.tasks.map((occurrence) => ({
        dateKey: occurrence.dateKey,
        text: occurrence.task.text,
        dateKinds: occurrence.dateKinds,
        overdue: occurrence.overdue,
      })),
    ).toEqual([
      {
        dateKey: "2026-01-05",
        text: "Mixed",
        dateKinds: ["due", "scheduled"],
        overdue: "severe",
      },
      {
        dateKey: "2026-01-06",
        text: "Starts",
        dateKinds: ["start"],
        overdue: "none",
      },
      {
        dateKey: "2026-01-06",
        text: "Scheduled only",
        dateKinds: ["scheduled"],
        overdue: "none",
      },
      {
        dateKey: "2026-01-07",
        text: "Scheduled with old due",
        dateKinds: ["scheduled"],
        overdue: "severe",
      },
      {
        dateKey: "2026-01-08",
        text: "Completed",
        dateKinds: ["due"],
        overdue: "none",
      },
      {
        dateKey: "2026-01-09",
        text: "Recent due",
        dateKinds: ["due"],
        overdue: "warning",
      },
    ]);
    expect(Object.isFrozen(result.tasks)).toBe(true);
    expect(result.tasks.every(Object.isFrozen)).toBe(true);
    expect(
      result.tasks.every((occurrence) => Object.isFrozen(occurrence.dateKinds)),
    ).toBe(true);
  });

  it("emits one occurrence for each distinct in-week milestone of a task", () => {
    const result = selectWeekCalendar(
      { year: 2026, month: 1, day: 7 },
      snapshot({
        "Projects/milestones.md":
          "- [ ] Milestones 🛫 2026-01-05 ⏳ 2026-01-07 📅 2026-01-09",
      }),
      DISABLED_ICS,
      {
        locale: "en-US",
        weekStartDay: "monday",
        today: { year: 2026, month: 1, day: 7 },
        calendarOverlays: [],
        holidayRegions: [],
        daily: { enabled: false, pattern: "" },
        weekly: { enabled: false, pattern: "" },
        rangeNotes: { ...RANGE_SETTINGS, showInCalendar: false },
      },
    );

    expect(result.tasks.map(({ dateKey, dateKinds }) => ({
      dateKey,
      dateKinds,
    }))).toEqual([
      { dateKey: "2026-01-05", dateKinds: ["start"] },
      { dateKey: "2026-01-07", dateKinds: ["scheduled"] },
      { dateKey: "2026-01-09", dateKinds: ["due"] },
    ]);
    expect(new Set(result.tasks.map(({ task }) => `${task.path}:${task.line}`)).size)
      .toBe(1);
  });

  it("keeps final date/path/line ordering independent of snapshot insertion order", () => {
    const result = selectWeekCalendar(
      { year: 2026, month: 1, day: 7 },
      snapshot({
        "Projects/z-source.md": "- [ ] Alpha path 📅 2026-01-06",
        "Projects/a-source.md": "- [ ] Zeta path 📅 2026-01-06",
        "Projects/middle.md": [
          "- [ ] Later line 📅 2026-01-06",
          "- [ ] Earlier date 📅 2026-01-05",
        ].join("\n"),
      }),
      DISABLED_ICS,
      {
        locale: "en-US",
        weekStartDay: "monday",
        today: { year: 2026, month: 1, day: 7 },
        calendarOverlays: [],
        holidayRegions: [],
        daily: { enabled: false, pattern: "" },
        weekly: { enabled: false, pattern: "" },
        rangeNotes: { ...RANGE_SETTINGS, showInCalendar: false },
      },
    );

    expect(
      result.tasks.map(({ dateKey, task }) => [dateKey, task.path, task.line]),
    )
      .toEqual([
        ["2026-01-05", "Projects/middle.md", 1],
        ["2026-01-06", "Projects/a-source.md", 0],
        ["2026-01-06", "Projects/middle.md", 0],
        ["2026-01-06", "Projects/z-source.md", 0],
      ]);
  });

  it("reads only the seven projected task buckets instead of scanning notes", () => {
    const indexed = snapshot({
      "Projects/task.md": "- [ ] Indexed 📅 2026-01-06",
      "Projects/outside.md": "- [ ] Outside 📅 2026-02-06",
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
          throw new Error("week task selection must not scan notes");
        },
      },
    )) as NoteIndexSnapshot;

    const result = selectWeekCalendar(
      { year: 2026, month: 1, day: 7 },
      source,
      DISABLED_ICS,
      {
        locale: "en-US",
        weekStartDay: "monday",
        today: { year: 2026, month: 1, day: 7 },
        calendarOverlays: [],
        holidayRegions: [],
        daily: { enabled: false, pattern: "" },
        weekly: { enabled: false, pattern: "" },
        rangeNotes: { ...RANGE_SETTINGS, showInCalendar: false },
      },
    );

    expect(result.tasks.map((occurrence) => occurrence.task.text)).toEqual(["Indexed"]);
  });

  it("reuses the configured range scan and lane limit for clipped interval segments", () => {
    const result = selectWeekCalendar(
      { year: 2026, month: 5, day: 7 },
      snapshot({
        "Ranges/first.md": "---\nstart: 2026-05-01\nend: 2026-05-05\n---",
        "Ranges/second.md": "---\nstart: 2026-05-06\nend: 2026-05-12\n---",
        "Other/ignored.md": "---\nstart: 2026-05-04\nend: 2026-05-05\n---",
      }),
      DISABLED_ICS,
      {
        locale: "en-US",
        weekStartDay: "monday",
        today: { year: 2026, month: 5, day: 7 },
        calendarOverlays: [],
        holidayRegions: [],
        daily: { enabled: false, pattern: "" },
        weekly: { enabled: false, pattern: "" },
        rangeNotes: RANGE_SETTINGS,
      },
    );

    expect(result.intervals).toMatchObject({
      totalCount: 2,
      hiddenCount: 0,
      hiddenItems: [],
      items: [
        { path: "Ranges/first.md", startColumn: 0, endColumn: 1, lane: 0 },
        { path: "Ranges/second.md", startColumn: 2, endColumn: 6, lane: 0 },
      ],
    });
    expect(result.rangeNotesVisible).toBe(true);
    expect(result.rangeCreationConfigured).toBe(true);
    expect(Object.isFrozen(result.intervals)).toBe(true);
  });
});
