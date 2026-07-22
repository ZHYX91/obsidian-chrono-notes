import { describe, expect, it } from "vitest";

import { parseNote } from "../../src/core/note/parsed-note";
import type {
  NoteIndexSnapshot,
  PresentNoteIndexEntry,
} from "../../src/features/notes/note-index";
import {
  selectMonthCalendar,
  type MonthCalendarQuery,
} from "../../src/features/calendar/month-calendar-query";
import type { IcsEventIndexSnapshot } from "../../src/features/calendar/ics-event-index";
import type { RangeNoteSettings } from "../../src/shared/settings";
import { createNoteIndexSnapshot } from "../support/note-index-snapshot";

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

const RANGE_NOTES: RangeNoteSettings = Object.freeze({
  showInCalendar: false,
  folder: "",
  scanScope: "range-folder",
  customFolder: "",
  monthViewLimit: 2,
  weekViewLimit: 5,
});

function snapshot(entries: Record<string, PresentNoteIndexEntry>): NoteIndexSnapshot {
  return createNoteIndexSnapshot(entries, 7);
}

function days(query: MonthCalendarQuery) {
  return query.weeks.flatMap((week) => week.days);
}

describe("selectMonthCalendar", () => {
  it("maps every calendar cell through the configured daily path and one NoteIndex snapshot", () => {
    const notes = snapshot({
      "Daily/2024-09-01.md": Object.freeze({
        kind: "parsed",
        revision: 1,
        note: parseNote(
          "Daily/2024-09-01.md",
          "body\n- [x] Finished\n- [ ] Remaining 📅 2024-09-01",
        ),
      }),
      "Daily/2024-09-02.md": Object.freeze({
        kind: "parsed",
        revision: 1,
        note: parseNote("Daily/2024-09-02.md", "---\ntag: daily\n---"),
      }),
      "Daily/2024-09-03.md": Object.freeze({
        kind: "parsed",
        revision: 1,
        note: parseNote("Daily/2024-09-03.md", "  \n"),
      }),
      "Daily/2024-09-04.md": Object.freeze({
        kind: "error",
        path: "Daily/2024-09-04.md",
        revision: 2,
        error: Object.freeze({ name: "Error", message: "read failed" }),
      }),
    });

    const result = selectMonthCalendar(
      { year: 2024, month: 9 },
      notes,
      DISABLED_ICS,
      {
        locale: "en-US",
        weekStartDay: "sunday",
        calendarOverlays: [],
        holidayRegions: [],
        heatmap: null,
        daily: { enabled: true, pattern: "'Daily'/yyyy-MM-dd" },
        weekly: { enabled: true, pattern: "'Weekly'/kkkk-WW" },
        rangeNotes: RANGE_NOTES,
      },
    );

    expect(result.noteSnapshotVersion).toBe(7);
    expect(result.icsSnapshotVersion).toBe(0);
    expect(days(result)).toHaveLength(35);
    expect(days(result).slice(0, 4)).toMatchObject([
      {
        date: { day: 1 },
        notePath: "Daily/2024-09-01.md",
        noteState: "has-body",
        preview: "body\nFinished\nRemaining 📅 2024-09-01",
        statistics: { taskTotal: 2, taskCompleted: 1, taskCompletionRate: 50 },
      },
      {
        date: { day: 2 },
        notePath: "Daily/2024-09-02.md",
        noteState: "yaml-only",
        preview: null,
      },
      {
        date: { day: 3 },
        notePath: "Daily/2024-09-03.md",
        noteState: "empty",
        preview: null,
      },
      {
        date: { day: 4 },
        notePath: "Daily/2024-09-04.md",
        noteState: "error",
        preview: null,
        errorMessage: "read failed",
      },
    ]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.weeks[0]?.days)).toBe(true);
    expect(Object.isFrozen(days(result)[0])).toBe(true);
    expect(Object.isFrozen(days(result)[0]?.statistics)).toBe(true);
    expect(days(result).every((cell) => cell.calendarOverlays.length === 0)).toBe(true);
  });

  it("derives interactive weekly-note rows from the same cross-year NoteIndex snapshot", () => {
    const result = selectMonthCalendar(
      { year: 2026, month: 1 },
      snapshot({
        "Weekly/2026-01.md": Object.freeze({
          kind: "parsed",
          revision: 1,
          note: parseNote(
            "Weekly/2026-01.md",
            "Week body\n- [x] Finished\n- [ ] Remaining",
          ),
        }),
        "Weekly/2026-02.md": Object.freeze({
          kind: "error",
          path: "Weekly/2026-02.md",
          revision: 2,
          error: Object.freeze({ name: "Error", message: "weekly read failed" }),
        }),
      }),
      DISABLED_ICS,
      {
        locale: "en-US",
        weekStartDay: "monday",
        calendarOverlays: [],
        holidayRegions: [],
        heatmap: null,
        daily: { enabled: false, pattern: "" },
        weekly: { enabled: true, pattern: "'Weekly'/kkkk-WW" },
        rangeNotes: RANGE_NOTES,
      },
    );

    expect(result.weeks).toHaveLength(5);
    expect(result.weeks.slice(0, 3)).toMatchObject([
      {
        weekStart: { year: 2025, month: 12, day: 29 },
        weekNumber: 1,
        weekYear: 2026,
        weeklyNote: {
          notePath: "Weekly/2026-01.md",
          noteState: "has-body",
          statistics: { taskTotal: 2, taskCompleted: 1, taskCompletionRate: 50 },
        },
      },
      {
        weekStart: { year: 2026, month: 1, day: 5 },
        weekNumber: 2,
        weekYear: 2026,
        weeklyNote: {
          notePath: "Weekly/2026-02.md",
          noteState: "error",
          errorMessage: "weekly read failed",
        },
      },
      {
        weekStart: { year: 2026, month: 1, day: 12 },
        weekNumber: 3,
        weekYear: 2026,
        weeklyNote: {
          notePath: "Weekly/2026-03.md",
          noteState: "missing",
        },
      },
    ]);
    expect(Object.isFrozen(result.weeks)).toBe(true);
    expect(result.weeks.every(Object.isFrozen)).toBe(true);
    expect(Object.isFrozen(result.weeks[0]?.weeklyNote.statistics)).toBe(true);
  });

  it("uses the configured Sunday anchor and never probes weekly paths when disabled", () => {
    const result = selectMonthCalendar(
      { year: 2026, month: 1 },
      snapshot({
        "Weekly/2025-53.md": Object.freeze({
          kind: "parsed",
          revision: 1,
          note: parseNote("Weekly/2025-53.md", "must not be selected"),
        }),
      }),
      DISABLED_ICS,
      {
        locale: "en-US",
        weekStartDay: "sunday",
        calendarOverlays: [],
        holidayRegions: [],
        heatmap: null,
        daily: { enabled: false, pattern: "" },
        weekly: { enabled: false, pattern: "'Weekly'/kkkk-WW" },
        rangeNotes: RANGE_NOTES,
      },
    );

    expect(result.weeks[0]).toMatchObject({
      weekStart: { year: 2025, month: 12, day: 28 },
      weekNumber: 1,
      weekYear: 2026,
      weeklyNote: { notePath: null, noteState: "not-configured" },
    });
    expect(result.weeks.every((week) => week.weeklyNote.notePath === null)).toBe(true);
  });

  it("represents a disabled or invalid daily pattern without probing arbitrary index paths", () => {
    const result = selectMonthCalendar(
      { year: 2024, month: 9 },
      snapshot({}),
      DISABLED_ICS,
      {
        locale: "en-US",
        weekStartDay: "monday",
        calendarOverlays: [],
        holidayRegions: [],
        heatmap: null,
        daily: { enabled: false, pattern: "" },
        weekly: { enabled: false, pattern: "" },
        rangeNotes: RANGE_NOTES,
      },
    );

    expect(new Set(days(result).map((cell) => cell.noteState))).toEqual(
      new Set(["not-configured"]),
    );
    expect(days(result).every((cell) => cell.notePath === null)).toBe(true);
    expect(days(result).every((cell) => cell.preview === null)).toBe(true);
  });

  it("adds frozen calendar overlays in configured slot order", () => {
    const result = selectMonthCalendar(
      { year: 2026, month: 2 },
      snapshot({}),
      DISABLED_ICS,
      {
        locale: "zh-CN",
        weekStartDay: "monday",
        calendarOverlays: ["ganzhi", "chinese-lunar"],
        holidayRegions: [],
        heatmap: null,
        daily: { enabled: false, pattern: "" },
        weekly: { enabled: false, pattern: "" },
        rangeNotes: RANGE_NOTES,
      },
    );
    const springFestival = days(result).find(
      (cell) => cell.date.year === 2026 && cell.date.month === 2 && cell.date.day === 17,
    );

    expect(springFestival?.calendarOverlays).toMatchObject([
      { id: "ganzhi" },
      {
        id: "chinese-lunar",
        dateText: "正月",
        eventText: "春节",
        eventKind: "festival",
        transition: "month",
      },
    ]);
    expect(Object.isFrozen(springFestival?.calendarOverlays)).toBe(true);
    expect(springFestival?.calendarOverlays.every(Object.isFrozen)).toBe(true);
    expect(springFestival?.holidays).toEqual([]);
    expect(springFestival?.workday).toBeNull();
  });

  it("adds China holiday metadata independently from the lunar overlay", () => {
    const result = selectMonthCalendar(
      { year: 2026, month: 2 },
      snapshot({}),
      DISABLED_ICS,
      {
        locale: "zh-CN",
        weekStartDay: "monday",
        calendarOverlays: [],
        holidayRegions: ["cn"],
        heatmap: null,
        daily: { enabled: false, pattern: "" },
        weekly: { enabled: false, pattern: "" },
        rangeNotes: RANGE_NOTES,
      },
    );
    const springFestival = days(result).find(
      (cell) => cell.date.year === 2026 && cell.date.month === 2 && cell.date.day === 17,
    );
    const adjustedWorkday = days(result).find(
      (cell) => cell.date.year === 2026 && cell.date.month === 2 && cell.date.day === 28,
    );

    expect(springFestival).toMatchObject({
      calendarOverlays: [],
      holidays: [{ region: "cn", name: "春节" }],
      workday: { region: "cn", name: "春节", isWorkday: false },
    });
    expect(adjustedWorkday).toMatchObject({
      holidays: [],
      workday: { region: "cn", name: "春节", isWorkday: true },
    });
    expect(Object.isFrozen(springFestival?.holidays)).toBe(true);
    expect(Object.isFrozen(springFestival?.workday)).toBe(true);
  });

  it("combines selected holiday regions in configured order without adding SG workdays", () => {
    const result = selectMonthCalendar(
      { year: 2026, month: 1 },
      snapshot({}),
      DISABLED_ICS,
      {
        locale: "en-US",
        weekStartDay: "monday",
        calendarOverlays: [],
        holidayRegions: ["sg", "cn"],
        heatmap: null,
        daily: { enabled: false, pattern: "" },
        weekly: { enabled: false, pattern: "" },
        rangeNotes: RANGE_NOTES,
      },
    );
    const newYear = days(result).find(
      (cell) => cell.date.year === 2026 && cell.date.month === 1 && cell.date.day === 1,
    );

    expect(newYear?.holidays).toEqual([
      { region: "sg", name: "New Year's Day" },
      { region: "cn", name: "元旦节" },
    ]);
    expect(newYear?.workday).toEqual({
      region: "cn",
      name: "元旦节",
      isWorkday: false,
    });
    expect(newYear?.regionalMarker).toEqual({ kind: "holiday", region: "sg" });
    expect(Object.isFrozen(newYear?.holidays)).toBe(true);
  });

  it("derives frozen heatmap metrics from the same NoteIndex snapshot", () => {
    const result = selectMonthCalendar(
      { year: 2024, month: 9 },
      snapshot({
        "Daily/2024-09-01.md": Object.freeze({
          kind: "parsed",
          revision: 1,
          note: parseNote("Daily/2024-09-01.md", "one two three four five"),
        }),
      }),
      DISABLED_ICS,
      {
        locale: "en-US",
        weekStartDay: "sunday",
        calendarOverlays: [],
        holidayRegions: [],
        heatmap: { dimension: "word-count", valueStep: 2 },
        daily: { enabled: true, pattern: "'Daily'/yyyy-MM-dd" },
        weekly: { enabled: false, pattern: "" },
        rangeNotes: RANGE_NOTES,
      },
    );
    const first = days(result)[0];
    const missing = days(result)[1];

    expect(first?.heatmap).toEqual({ dimension: "word-count", value: 5, level: 3 });
    expect(missing?.heatmap).toEqual({ dimension: "word-count", value: 0, level: 0 });
    expect(Object.isFrozen(first?.heatmap)).toBe(true);
  });

  it("does not read interval projections and returns empty heatmap lanes", () => {
    const base = snapshot({
      "Daily/2026-07-14.md": Object.freeze({
        kind: "parsed",
        revision: 1,
        note: parseNote("Daily/2026-07-14.md", "heatmap words"),
      }),
    });
    const guarded: NoteIndexSnapshot = Object.freeze({
      version: base.version,
      notes: base.notes,
      taskDates: base.taskDates,
      get intervals(): NoteIndexSnapshot["intervals"] {
        throw new Error("Heatmap month must not read interval projections");
      },
    });

    const result = selectMonthCalendar(
      { year: 2026, month: 7 },
      guarded,
      DISABLED_ICS,
      {
        locale: "en-US",
        weekStartDay: "monday",
        calendarOverlays: [],
        holidayRegions: [],
        heatmap: { dimension: "word-count", valueStep: 2 },
        daily: { enabled: true, pattern: "'Daily'/yyyy-MM-dd" },
        weekly: { enabled: false, pattern: "" },
        rangeNotes: {
          ...RANGE_NOTES,
          showInCalendar: true,
          folder: "Ranges",
        },
      },
    );

    expect(result.weeks.every((week) => week.intervals.totalCount === 0))
      .toBe(true);
    expect(result.weeks.every((week) => Object.isFrozen(week.intervals)))
      .toBe(true);
  });

  it("nests each interval row with the corresponding seven-day week", () => {
    const result = selectMonthCalendar(
      { year: 2026, month: 7 },
      snapshot({
        "Ranges/planning.md": Object.freeze({
          kind: "parsed",
          revision: 1,
          note: parseNote(
            "Ranges/planning.md",
            "---\nstart: 2026-07-14\nend: 2026-07-16\n---",
          ),
        }),
      }),
      DISABLED_ICS,
      {
        locale: "en-US",
        weekStartDay: "monday",
        calendarOverlays: [],
        holidayRegions: [],
        heatmap: null,
        daily: { enabled: false, pattern: "" },
        weekly: { enabled: false, pattern: "" },
        rangeNotes: {
          ...RANGE_NOTES,
          showInCalendar: true,
          folder: "Ranges",
        },
      },
    );
    const intervalWeek = result.weeks.find(
      (week) => week.weekStart.year === 2026 &&
        week.weekStart.month === 7 &&
        week.weekStart.day === 13,
    );

    expect(result.weeks.every((week) => week.days.length === 7)).toBe(true);
    expect(intervalWeek?.intervals).toMatchObject({
      totalCount: 1,
      items: [{
        path: "Ranges/planning.md",
        startColumn: 1,
        endColumn: 3,
      }],
    });
    expect(
      result.weeks
        .filter((week) => week !== intervalWeek)
        .every((week) => week.intervals.totalCount === 0),
    ).toBe(true);
    expect(Object.isFrozen(intervalWeek?.intervals)).toBe(true);
  });
});
