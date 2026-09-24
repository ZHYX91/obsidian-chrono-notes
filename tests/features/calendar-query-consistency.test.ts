import { describe, expect, it, vi } from "vitest";

import type { PeriodicNoteType } from "../../src/core/periodic/periodic-date";
import {
  CalendarQueryStore,
  type CalendarQueryRequest,
} from "../../src/features/calendar/calendar-query-store";
import { selectCenturyCalendar } from "../../src/features/calendar/century-calendar-query";
import { IcsEventIndex } from "../../src/features/calendar/ics-event-index";
import { resolveIndexedPeriodicNotePath } from "../../src/features/calendar/indexed-periodic-note";
import { selectMonthCalendar } from "../../src/features/calendar/month-calendar-query";
import { selectWeekCalendar } from "../../src/features/calendar/week-calendar-query";
import {
  selectYearCalendarHeatmap,
  selectYearCalendarOverview,
} from "../../src/features/calendar/year-calendar-query";
import { isIntervalNoteInScope } from "../../src/features/intervals/interval-note-query";
import type { NoteIndexSnapshot } from "../../src/features/notes/note-index";
import type { RangeNoteSettings } from "../../src/shared/settings";
import { createParsedNoteIndexSnapshot } from "../support/note-index-snapshot";

const DATE = Object.freeze({ year: 2026, month: 7, day: 8 });
const RANGE: RangeNoteSettings = {
  showInCalendar: true,
  folder: "Ranges",
  templatePath: "",
  scanScope: "range-folder",
  customFolder: "",
  monthViewLimit: 2,
  weekViewLimit: 5,
};
const CONTEXT = { locale: "en", weekStartDay: "monday" } as const;
const RULES = {
  daily: { enabled: true, pattern: "[Daily]/YYYY-MMMM-DD", pathLocale: "zh-CN" },
  weekly: { enabled: true, pattern: "[Weekly]/YYYY-MMMM-DD", pathLocale: "zh-CN" },
  monthly: { enabled: true, pattern: "[Monthly]/YYYY-MMMM", pathLocale: "zh-CN" },
  quarterly: { enabled: true, pattern: "[Quarterly]/YYYY-MMMM", pathLocale: "zh-CN" },
  yearly: { enabled: true, pattern: "[Yearly]/YYYY-MMMM", pathLocale: "zh-CN" },
  decadal: { enabled: true, pattern: "[Decadal]/YYYY-MMMM", pathLocale: "zh-CN" },
  century: { enabled: true, pattern: "[Century]/YYYY-MMMM", pathLocale: "zh-CN" },
} as const;

type View = "month" | "week" | "year" | "century";
const PATH_CASES: readonly (readonly [View, PeriodicNoteType])[] = [
  ["month", "daily"], ["month", "weekly"],
  ["week", "daily"], ["week", "weekly"],
  ["year", "daily"], ["year", "monthly"], ["year", "quarterly"],
  ["century", "yearly"], ["century", "decadal"], ["century", "century"],
];

describe("calendar query dependency consistency", () => {
  it.each(PATH_CASES)("tracks the localized %s/%s path through ready updates", (view, type) => {
    const rule = RULES[type];
    const path = resolveIndexedPeriodicNotePath(DATE, type, CONTEXT, rule);
    const englishPath = resolveIndexedPeriodicNotePath(DATE, type, CONTEXT, {
      ...rule, pathLocale: "en",
    });
    expect(path).not.toBeNull();
    expect(path).not.toBe(englishPath);
    if (path === null) throw new Error("Expected a configured localized path");
    const initial = createParsedNoteIndexSnapshot({ [path]: "before" }, 1);
    const notes = new Source(initial);
    const ics = new IcsEventIndex({ read: async () => "" });
    const request = makeRequest(view);
    const store = new CalendarQueryStore(notes, ics, request);
    const first = store.getSnapshot();
    const listener = vi.fn();
    store.subscribe(listener);

    const changed = createParsedNoteIndexSnapshot({ [path]: "after with more words" }, 2);
    notes.publish(changed);
    expect(changed.readiness).toBe(initial.readiness);
    expect(listener).toHaveBeenCalledOnce();
    expect(store.getSnapshot()).not.toBe(first);
    expect(businessValue(store.getSnapshot().query)).toEqual(
      businessValue(selectFresh(request, changed, ics)),
    );

    const removed = createParsedNoteIndexSnapshot({}, 3);
    notes.publish(removed);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(businessValue(store.getSnapshot().query)).toEqual(
      businessValue(selectFresh(request, removed, ics)),
    );
    store.dispose();
    ics.stop();
  });

  for (const view of ["month", "week"] as const) {
    for (const [label, rangeNotes] of [
      ["range folder", RANGE],
      ["custom folder", { ...RANGE, scanScope: "custom-folder", customFolder: "Other" }],
      ["empty custom folder", { ...RANGE, scanScope: "custom-folder", customFolder: "" }],
      ["entire Vault", { ...RANGE, scanScope: "entire-vault" }],
    ] as const) {
      it(`${view} follows explicit ranges outside ${label} through edits, moves and deletion`, () => {
        const path = "Projects/launch.md";
        const initial = createParsedNoteIndexSnapshot({ [path]: interval("2026-07-09") }, 1);
        const notes = new Source(initial);
        const ics = new IcsEventIndex({ read: async () => "" });
        const request = makeRequest(view, rangeNotes);
        const store = new CalendarQueryStore(notes, ics, request);
        const first = store.getSnapshot();
        const listener = vi.fn();
        store.subscribe(listener);
        const contents = [
          { [path]: interval("2026-07-12") },
          { "Elsewhere/moved.md": interval("2026-07-12") },
          {},
          { [path]: interval("2026-07-09") },
          { [path]: interval("2026-07-09").replace("interval", "excluded") },
        ];
        for (const [index, content] of contents.entries()) {
          const snapshot = createParsedNoteIndexSnapshot(content, index + 2);
          notes.publish(snapshot);
          expect(listener).toHaveBeenCalledTimes(index + 1);
          expect(businessValue(store.getSnapshot().query)).toEqual(
            businessValue(selectFresh(request, snapshot, ics)),
          );
        }
        expect(store.getSnapshot()).not.toBe(first);
        store.dispose();
        ics.stop();
      });
    }
  }

  it("shares the explicit/unmarked scope predicate without broadening unmarked recognition", () => {
    for (const folder of [null, "", "Ranges"] as const) {
      expect(isIntervalNoteInScope({ path: "Other/a.md", recognition: "explicit" }, folder))
        .toBe(true);
    }
    expect(isIntervalNoteInScope({ path: "Other/a.md", recognition: "unmarked" }, "Ranges"))
      .toBe(false);
    expect(isIntervalNoteInScope({ path: "Ranges-old/a.md", recognition: "unmarked" }, "Ranges"))
      .toBe(false);
    expect(isIntervalNoteInScope({ path: "Ranges/a.md", recognition: "unmarked" }, "Ranges"))
      .toBe(true);
    expect(isIntervalNoteInScope({ path: "Ranges/a.md", recognition: "unmarked" }, ""))
      .toBe(false);
  });
});

function makeRequest(view: View, rangeNotes: RangeNoteSettings = RANGE): CalendarQueryRequest {
  const dayOptions = {
    ...CONTEXT,
    daily: RULES.daily,
    weekly: RULES.weekly,
    calendarExtensions: [],
    holidayRegions: [],
    rangeNotes,
  };
  switch (view) {
    case "month": return {
      kind: "month", target: DATE, options: { ...dayOptions, heatmap: null },
    };
    case "week": return {
      kind: "week", selectedDate: DATE, options: { ...dayOptions, today: DATE },
    };
    case "year": return {
      kind: "year", year: DATE.year, heatmap: true, options: {
        ...CONTEXT,
        daily: RULES.daily, monthly: RULES.monthly, quarterly: RULES.quarterly,
        statisticDisplayDimension: "word-count", statisticValueStep: 200,
      },
    };
    case "century": return {
      kind: "century", year: DATE.year, options: {
        ...CONTEXT,
        yearly: RULES.yearly, decadal: RULES.decadal, century: RULES.century,
      },
    };
  }
}

function selectFresh(request: CalendarQueryRequest, notes: NoteIndexSnapshot, ics: IcsEventIndex) {
  switch (request.kind) {
    case "month": return selectMonthCalendar(request.target, notes, ics.getSnapshot(), request.options);
    case "week": return selectWeekCalendar(request.selectedDate, notes, ics.getSnapshot(), request.options);
    case "year": return request.heatmap
      ? selectYearCalendarHeatmap(request.year, notes, request.options)
      : selectYearCalendarOverview(request.year, notes, request.options);
    case "century": return selectCenturyCalendar(request.year, notes, request.options);
  }
}

// Shared submodels may retain provenance versions; compare all business values.
function businessValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(businessValue);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !["snapshotVersion", "noteSnapshotVersion", "icsSnapshotVersion"].includes(key))
    .map(([key, child]) => [key, businessValue(child)]));
}

function interval(end: string): string {
  return `---\nchrono-notes: interval\nstart: 2026-07-08\nend: ${end}\n---\nLaunch\n`;
}

class Source {
  private readonly listeners = new Set<() => void>();
  constructor(private snapshot: NoteIndexSnapshot) {}
  getSnapshot = (): NoteIndexSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  publish(snapshot: NoteIndexSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
}
