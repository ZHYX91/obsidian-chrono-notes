import { describe, expect, it, vi } from "vitest";

import type { IcsEventOccurrence } from "../../src/core/calendar/ics-calendar";
import { parseNote } from "../../src/core/note/parsed-note";
import {
  CalendarQueryStore,
  type MonthCalendarQueryRequest,
  type WeekCalendarQueryRequest,
  type YearCalendarQueryRequest,
} from "../../src/features/calendar/calendar-query-store";
import type { IcsEventIndexSnapshot } from "../../src/features/calendar/ics-event-index";
import type {
  NoteIndexSnapshot,
  PresentNoteIndexEntry,
} from "../../src/features/notes/note-index";
import type { TaskDateRef } from "../../src/features/notes/note-index-projections";
import type { RangeNoteSettings } from "../../src/shared/settings";
import {
  createNoteIndexSnapshot,
  createParsedNoteIndexSnapshot,
} from "../support/note-index-snapshot";

const RANGE_NOTES_OFF: RangeNoteSettings = Object.freeze({
  showInCalendar: false,
  folder: "",
  scanScope: "range-folder",
  customFolder: "",
  monthViewLimit: 2,
  weekViewLimit: 5,
});

const RANGE_NOTES_ON: RangeNoteSettings = Object.freeze({
  ...RANGE_NOTES_OFF,
  showInCalendar: true,
  scanScope: "entire-vault",
});

describe("CalendarQueryStore", () => {
  it("skips dependency collection without subscribers when source identities are stable", () => {
    let notesReads = 0;
    const baseNotes = createNoteIndexSnapshot({}, 0);
    const guardedNotes = new Proxy(baseNotes, {
      get(target, property, receiver) {
        if (property === "notes") notesReads += 1;
        return Reflect.get(target, property, receiver) as unknown;
      },
    });
    const store = new CalendarQueryStore(
      new MutableSnapshotSource(guardedNotes),
      new MutableSnapshotSource(disabledIcs()),
      monthRequest(),
    );

    const first = store.getSnapshot();
    expect(notesReads).toBeGreaterThan(0);
    notesReads = 0;

    expect(store.getSnapshot()).toBe(first);
    expect(notesReads).toBe(0);
  });

  it("does not notify for unrelated notes or ICS refresh state", () => {
    const initialNotes = createParsedNoteIndexSnapshot({
      "Daily/2026-07-08.md": "visible",
      "Other/stable.md": "stable",
    }, 1);
    const events = Object.freeze({
      "2026-07-08": Object.freeze([event("visible")]),
    });
    const noteSource = new MutableSnapshotSource(initialNotes);
    const icsSource = new MutableSnapshotSource(icsSnapshot(1, "ready", events));
    const request = monthRequest();
    const store = new CalendarQueryStore(noteSource, icsSource, request);
    const first = store.getSnapshot();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    const unrelatedEntry = parsedEntry("Other/changed.md", "changed", 2);
    noteSource.publish(createNoteIndexSnapshot({
      ...initialNotes.notes,
      "Other/changed.md": unrelatedEntry,
    }, 2));
    icsSource.publish(icsSnapshot(2, "refreshing", events));

    expect(listener).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toBe(first);

    unsubscribe();
    expect(noteSource.listenerCount).toBe(0);
    expect(icsSource.listenerCount).toBe(0);
  });

  it("recomputes unknown periodic paths when note-index readiness changes", () => {
    const ready = createNoteIndexSnapshot({}, 1, "ready");
    const noteSource = new MutableSnapshotSource(ready);
    const store = new CalendarQueryStore(
      noteSource,
      new MutableSnapshotSource(disabledIcs()),
      monthRequest(),
    );
    const initial = expectMonth(store.getSnapshot());
    expect(findDay(initial, "2026-07-08").noteState).toBe("missing");
    const listener = vi.fn();
    store.subscribe(listener);

    noteSource.publish(Object.freeze({
      ...ready,
      version: 2,
      readiness: "indexing",
    }));

    const indexing = expectMonth(store.getSnapshot());
    expect(listener).toHaveBeenCalledOnce();
    expect(findDay(indexing, "2026-07-08").noteState).toBe("indexing");
    expect(findDay(indexing, "2026-07-08")).not.toBe(
      findDay(initial, "2026-07-08"),
    );
  });

  it("replaces only the affected month day and week", () => {
    const initial = createParsedNoteIndexSnapshot({
      "Daily/2026-07-08.md": "before",
      "Daily/2026-07-20.md": "unchanged",
    }, 1);
    const noteSource = new MutableSnapshotSource(initial);
    const icsSource = new MutableSnapshotSource(disabledIcs());
    const request = monthRequest();
    const store = new CalendarQueryStore(noteSource, icsSource, request);
    const first = expectMonth(store.getSnapshot());
    const firstChangedDay = findDay(first, "2026-07-08");
    const firstStableDay = findDay(first, "2026-07-20");
    const firstChangedWeek = findWeek(first, "2026-07-08");
    const firstStableWeek = findWeek(first, "2026-07-20");
    const listener = vi.fn();
    store.subscribe(listener);

    noteSource.publish(createNoteIndexSnapshot({
      ...initial.notes,
      "Daily/2026-07-08.md": parsedEntry(
        "Daily/2026-07-08.md",
        "after",
        2,
      ),
    }, 2));

    const second = expectMonth(store.getSnapshot());
    expect(listener).toHaveBeenCalledOnce();
    expect(second).not.toBe(first);
    expect(findDay(second, "2026-07-08")).not.toBe(firstChangedDay);
    expect(findDay(second, "2026-07-20")).toBe(firstStableDay);
    expect(findWeek(second, "2026-07-08")).not.toBe(firstChangedWeek);
    expect(findWeek(second, "2026-07-20")).toBe(firstStableWeek);
    expect(firstChangedDay.preview).toBe("before");
    expect(findDay(second, "2026-07-08").preview).toBe("after");
    expect(Object.isFrozen(second)).toBe(true);
    expect(Object.isFrozen(second.weeks)).toBe(true);
  });

  it("depends on ICS event buckets only inside the visible month grid", () => {
    const notes = new MutableSnapshotSource(createNoteIndexSnapshot({}, 0));
    const visibleEvents = Object.freeze([event("visible")]);
    const ics = new MutableSnapshotSource(icsSnapshot(1, "ready", Object.freeze({
      "2026-07-08": visibleEvents,
    })));
    const request = monthRequest();
    const store = new CalendarQueryStore(notes, ics, request);
    const first = expectMonth(store.getSnapshot());
    const firstVisibleDay = findDay(first, "2026-07-08");
    const firstStableDay = findDay(first, "2026-07-20");
    const listener = vi.fn();
    store.subscribe(listener);

    ics.publish(icsSnapshot(2, "ready", Object.freeze({
      "2026-07-08": visibleEvents,
      "2027-01-01": Object.freeze([event("outside")]),
    })));
    expect(listener).not.toHaveBeenCalled();

    ics.publish(icsSnapshot(3, "ready", Object.freeze({
      "2026-07-08": Object.freeze([event("changed")]),
    })));
    const second = expectMonth(store.getSnapshot());

    expect(listener).toHaveBeenCalledOnce();
    expect(findDay(second, "2026-07-08")).not.toBe(firstVisibleDay);
    expect(findDay(second, "2026-07-20")).toBe(firstStableDay);
  });

  it("tracks only the seven visible task buckets in week mode", () => {
    const initial = createParsedNoteIndexSnapshot({
      "Tasks/current.md": "- [ ] Current 📅 2026-07-08",
    }, 1);
    const noteSource = new MutableSnapshotSource(initial);
    const icsSource = new MutableSnapshotSource(disabledIcs());
    const request = weekRequest();
    const store = new CalendarQueryStore(noteSource, icsSource, request);
    const first = expectWeek(store.getSnapshot());
    const firstDays = first.days;
    const listener = vi.fn();
    store.subscribe(listener);

    const outsideBucket = Object.freeze([taskRef("2026-08-08", "outside.md")]);
    noteSource.publish(Object.freeze({
      ...initial,
      version: 2,
      taskDates: Object.freeze({
        revision: initial.taskDates.revision + 1,
        byDate: Object.freeze({
          ...initial.taskDates.byDate,
          "2026-08-08": outsideBucket,
        }),
      }),
    }));

    expect(listener).not.toHaveBeenCalled();
    expect(store.getSnapshot().query).toBe(first);

    const currentBucket = Object.freeze([
      ...(initial.taskDates.byDate["2026-07-08"] ?? []),
      taskRef("2026-07-08", "added.md"),
    ]);
    noteSource.publish(Object.freeze({
      ...initial,
      version: 3,
      taskDates: Object.freeze({
        revision: initial.taskDates.revision + 2,
        byDate: Object.freeze({
          ...initial.taskDates.byDate,
          "2026-07-08": currentBucket,
          "2026-08-08": outsideBucket,
        }),
      }),
    }));

    const second = expectWeek(store.getSnapshot());
    expect(listener).toHaveBeenCalledOnce();
    expect(second.tasks).not.toBe(first.tasks);
    expect(second.tasks).toHaveLength(2);
    expect(second.days).toBe(firstDays);
  });

  it("ignores intervals outside the visible window and shares unaffected month data", () => {
    const initial = createNoteIndexSnapshot({}, 1);
    const noteSource = new MutableSnapshotSource(initial);
    const icsSource = new MutableSnapshotSource(disabledIcs());
    const request = monthRequest(RANGE_NOTES_ON);
    const store = new CalendarQueryStore(noteSource, icsSource, request);
    const first = expectMonth(store.getSnapshot());
    const listener = vi.fn();
    store.subscribe(listener);

    const outside = createParsedNoteIndexSnapshot({
      "Ranges/outside.md": "---\nstart: 2027-01-01\nend: 2027-01-03\n---",
    }, 2);
    noteSource.publish(outside);
    expect(listener).not.toHaveBeenCalled();
    expect(store.getSnapshot().query).toBe(first);

    const visible = createParsedNoteIndexSnapshot({
      "Ranges/outside.md": "---\nstart: 2027-01-01\nend: 2027-01-03\n---",
      "Ranges/visible.md": "---\nstart: 2026-07-08\nend: 2026-07-10\n---",
    }, 3);
    noteSource.publish(visible);

    const second = expectMonth(store.getSnapshot());
    expect(listener).toHaveBeenCalledOnce();
    expect(second.weeks[0]).toBe(first.weeks[0]);
    expect(second.weeks[0]?.days).toBe(first.weeks[0]?.days);
    expect(second.weeks.find((week) => week.intervals.totalCount > 0)).toBeDefined();
  });

  it("ignores interval-only updates while the month heatmap is active", () => {
    const initial = guardIntervals(createNoteIndexSnapshot({}, 1));
    const noteSource = new MutableSnapshotSource(initial);
    const icsSource = new MutableSnapshotSource(disabledIcs());
    const baseRequest = monthRequest(RANGE_NOTES_ON);
    const request: MonthCalendarQueryRequest = {
      ...baseRequest,
      options: {
        ...baseRequest.options,
        heatmap: { dimension: "word-count", valueStep: 200 },
      },
    };
    const store = new CalendarQueryStore(noteSource, icsSource, request);
    const firstSnapshot = store.getSnapshot();
    const first = expectMonth(firstSnapshot);
    const listener = vi.fn();
    store.subscribe(listener);

    noteSource.publish(guardIntervals(createParsedNoteIndexSnapshot({
      "Ranges/visible.md": "---\nstart: 2026-07-08\nend: 2026-07-10\n---",
    }, 2)));

    expect(listener).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toBe(firstSnapshot);
    expect(store.getSnapshot().query).toBe(first);
    expect(first.weeks.every((week) => week.intervals.totalCount === 0))
      .toBe(true);
  });

  it("tracks visible interval dates even when timestamp offsets reverse epoch order", () => {
    const noteSource = new MutableSnapshotSource(createParsedNoteIndexSnapshot({
      "Ranges/epoch-first-date-later.md": [
        "---",
        "start: 2026-07-06T00:00:00+14:00",
        "end: 2026-07-06T01:00:00+14:00",
        "---",
      ].join("\n"),
      "Ranges/epoch-later-date-visible.md": [
        "---",
        "start: 2026-07-05T23:00:00-12:00",
        "end: 2026-07-05T23:30:00-12:00",
        "---",
      ].join("\n"),
    }, 1));
    const request: MonthCalendarQueryRequest = {
      ...monthRequest(RANGE_NOTES_ON),
      target: { year: 2026, month: 6 },
    };
    const store = new CalendarQueryStore(
      noteSource,
      new MutableSnapshotSource(disabledIcs()),
      request,
    );

    const finalWeek = findWeek(expectMonth(store.getSnapshot()), "2026-07-05");

    expect(finalWeek.intervals.items.map((item) => item.path)).toEqual([
      "Ranges/epoch-later-date-visible.md",
    ]);
  });

  it("rebuilds a week when an epoch-earlier future date changes a visible lane", () => {
    const futureBlocker = [
      "---",
      "start: 2026-07-13T00:00:00+14:00",
      "end: 2026-07-13T01:00:00+14:00",
      "---",
    ].join("\n");
    const visible = [
      "---",
      "start: 2026-07-12T23:00:00-12:00",
      "end: 2026-07-12T23:30:00-12:00",
      "---",
    ].join("\n");
    const noteSource = new MutableSnapshotSource(createParsedNoteIndexSnapshot({
      "Ranges/future-blocker.md": futureBlocker,
      "Ranges/visible.md": visible,
    }, 1));
    const store = new CalendarQueryStore(
      noteSource,
      new MutableSnapshotSource(disabledIcs()),
      monthRequest(RANGE_NOTES_ON),
    );
    const firstWeek = findWeek(expectMonth(store.getSnapshot()), "2026-07-12");
    expect(firstWeek.intervals.items.find((item) => item.path === "Ranges/visible.md")?.lane)
      .toBe(1);
    store.subscribe(() => undefined);

    noteSource.publish(removeIntervalWhileSharingOtherReferences(
      noteSource.getSnapshot(),
      "Ranges/future-blocker.md",
      2,
    ));

    const secondWeek = findWeek(expectMonth(store.getSnapshot()), "2026-07-12");
    expect(secondWeek).not.toBe(firstWeek);
    expect(secondWeek.intervals.items.find((item) => item.path === "Ranges/visible.md")?.lane)
      .toBe(0);
  });

  it("rebuilds a later week when an earlier interval changes its global lane", () => {
    const initial = createParsedNoteIndexSnapshot({
      "Ranges/blocker.md": "---\nstart: 2026-06-29\nend: 2026-07-03\n---",
      "Ranges/ongoing.md": "---\nstart: 2026-07-01\nend: 2026-07-10\n---",
    }, 1);
    const noteSource = new MutableSnapshotSource(initial);
    const request = monthRequest(RANGE_NOTES_ON);
    const store = new CalendarQueryStore(
      noteSource,
      new MutableSnapshotSource(disabledIcs()),
      request,
    );
    const first = expectMonth(store.getSnapshot());
    const firstWeek = findWeek(first, "2026-07-08");
    expect(firstWeek.intervals.items.find((item) => item.path === "Ranges/ongoing.md")?.lane)
      .toBe(1);
    store.subscribe(() => undefined);

    noteSource.publish(removeIntervalWhileSharingOtherReferences(
      noteSource.getSnapshot(),
      "Ranges/blocker.md",
      2,
    ));

    const secondWeek = findWeek(
      expectMonth(store.getSnapshot()),
      "2026-07-08",
    );
    expect(secondWeek).not.toBe(firstWeek);
    expect(secondWeek.intervals.items.find((item) => item.path === "Ranges/ongoing.md")?.lane)
      .toBe(0);
  });

  it("shares unaffected months and quarters in a year heatmap", () => {
    const initial = createParsedNoteIndexSnapshot({
      "Daily/2026-02-10.md": "before",
      "Monthly/2026-01.md": "January",
      "Monthly/2026-02.md": "February",
      "Quarterly/2026-Q1.md": "Q1",
    }, 1);
    const noteSource = new MutableSnapshotSource(initial);
    const request = yearRequest();
    const store = new CalendarQueryStore(
      noteSource,
      new MutableSnapshotSource(disabledIcs()),
      request,
    );
    const first = expectYear(store.getSnapshot());
    store.subscribe(() => undefined);

    noteSource.publish(createNoteIndexSnapshot({
      ...initial.notes,
      "Daily/2026-02-10.md": parsedEntry(
        "Daily/2026-02-10.md",
        "after with more words",
        2,
      ),
    }, 2));

    const second = expectYear(store.getSnapshot());
    expect(second.quarters[0]).not.toBe(first.quarters[0]);
    expect(second.quarters[0]?.months[0]).toBe(first.quarters[0]?.months[0]);
    expect(second.quarters[0]?.months[1]).not.toBe(first.quarters[0]?.months[1]);
    expect(second.quarters[1]).toBe(first.quarters[1]);
    expect(second.quarters[2]).toBe(first.quarters[2]);
    expect(second.quarters[3]).toBe(first.quarters[3]);
  });

  it("keeps simultaneous stores isolated and releases every source listener", () => {
    const notes = new MutableSnapshotSource(createNoteIndexSnapshot({}, 0));
    const ics = new MutableSnapshotSource(disabledIcs());
    const first = new CalendarQueryStore(notes, ics, monthRequest());
    const second = new CalendarQueryStore(
      notes,
      ics,
      weekRequest({ year: 2027, month: 1, day: 6 }),
    );
    first.getSnapshot();
    second.getSnapshot();
    const firstListener = vi.fn();
    const secondListener = vi.fn();
    const unsubscribeFirst = first.subscribe(firstListener);
    second.subscribe(secondListener);

    expect(notes.listenerCount).toBe(2);
    expect(ics.listenerCount).toBe(2);
    notes.publish(createParsedNoteIndexSnapshot({
      "Daily/2026-07-08.md": "only the committed July request depends on this",
    }, 1));
    expect(firstListener).toHaveBeenCalledOnce();
    expect(secondListener).not.toHaveBeenCalled();

    unsubscribeFirst();
    expect(notes.listenerCount).toBe(1);
    expect(ics.listenerCount).toBe(1);

    first.dispose();
    second.dispose();
    expect(notes.listenerCount).toBe(0);
    expect(ics.listenerCount).toBe(0);
    expect(() => first.getSnapshot()).toThrow(
      "CalendarQueryStore has been disposed",
    );
  });
});

class MutableSnapshotSource<T> {
  private readonly listeners = new Set<() => void>();

  constructor(private snapshot: T) {}

  get listenerCount(): number {
    return this.listeners.size;
  }

  getSnapshot = (): T => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  publish(snapshot: T): void {
    this.snapshot = snapshot;
    for (const listener of [...this.listeners]) listener();
  }
}

function monthRequest(
  rangeNotes: RangeNoteSettings = RANGE_NOTES_OFF,
): MonthCalendarQueryRequest {
  return {
    kind: "month",
    target: { year: 2026, month: 7 },
    options: {
      locale: "en-US",
      weekStartDay: "monday",
      calendarOverlays: [],
      holidayRegions: [],
      heatmap: null,
      daily: { enabled: true, pattern: "'Daily'/yyyy-MM-dd" },
      weekly: { enabled: true, pattern: "'Weekly'/kkkk-WW" },
      rangeNotes,
    },
  };
}

function weekRequest(
  selectedDate: WeekCalendarQueryRequest["selectedDate"] = {
    year: 2026,
    month: 7,
    day: 8,
  },
): WeekCalendarQueryRequest {
  return {
    kind: "week",
    selectedDate,
    options: {
      locale: "en-US",
      weekStartDay: "monday",
      today: selectedDate,
      calendarOverlays: [],
      holidayRegions: [],
      daily: { enabled: true, pattern: "'Daily'/yyyy-MM-dd" },
      weekly: { enabled: true, pattern: "'Weekly'/kkkk-WW" },
      rangeNotes: RANGE_NOTES_OFF,
    },
  };
}

function yearRequest(): YearCalendarQueryRequest {
  return {
    kind: "year",
    year: 2026,
    heatmap: true,
    options: {
      locale: "en-US",
      weekStartDay: "monday",
      statisticDisplayDimension: "word-count",
      statisticValueStep: 200,
      daily: { enabled: true, pattern: "'Daily'/yyyy-MM-dd" },
      monthly: { enabled: true, pattern: "'Monthly'/yyyy-MM" },
      quarterly: { enabled: true, pattern: "'Quarterly'/yyyy-'Q'q" },
    },
  };
}

function parsedEntry(
  path: string,
  content: string,
  revision: number,
): PresentNoteIndexEntry {
  return Object.freeze({
    kind: "parsed",
    revision,
    note: parseNote(path, content),
  });
}

function guardIntervals(snapshot: NoteIndexSnapshot): NoteIndexSnapshot {
  return Object.freeze({
    version: snapshot.version,
    readiness: snapshot.readiness,
    notes: snapshot.notes,
    taskDates: snapshot.taskDates,
    get intervals(): NoteIndexSnapshot["intervals"] {
      throw new Error("Heatmap month dependencies must not read intervals");
    },
  });
}

function removeIntervalWhileSharingOtherReferences(
  snapshot: NoteIndexSnapshot,
  removedPath: string,
  version: number,
): NoteIndexSnapshot {
  const notes = Object.fromEntries(
    Object.entries(snapshot.notes).filter(([path]) => path !== removedPath),
  );
  return Object.freeze({
    version,
    readiness: snapshot.readiness,
    notes: Object.freeze(notes),
    taskDates: snapshot.taskDates,
    intervals: Object.freeze({
      revision: snapshot.intervals.revision + 1,
      items: Object.freeze(snapshot.intervals.items.filter(
        (item) => item.path !== removedPath,
      )),
    }),
  });
}

function taskRef(dateKey: string, path: string): TaskDateRef {
  const task = Object.freeze({
    text: path,
    completed: false,
    dueDate: dateKey,
    scheduledDate: null,
    startDate: null,
    doneDate: null,
    path,
    line: 1,
  });
  return Object.freeze({
    date: Object.freeze({ year: 2026, month: Number(dateKey.slice(5, 7)), day: Number(dateKey.slice(8, 10)) }),
    dateKey,
    dateKinds: Object.freeze(["due" as const]),
    dueDate: Object.freeze({ year: 2026, month: Number(dateKey.slice(5, 7)), day: Number(dateKey.slice(8, 10)) }),
    task,
  });
}

function event(id: string): IcsEventOccurrence {
  return Object.freeze({
    id,
    title: id,
    source: "test.ics",
    sourceLabel: "test.ics",
    isAllDay: true,
    startsOnDate: true,
    endsOnDate: true,
    continuesBefore: false,
    continuesAfter: false,
    timeLabel: null,
    sortTimestamp: 0,
  });
}

function disabledIcs(): IcsEventIndexSnapshot {
  return icsSnapshot(0, "disabled", Object.freeze({}), false);
}

function icsSnapshot(
  version: number,
  state: IcsEventIndexSnapshot["state"],
  eventsByDate: IcsEventIndexSnapshot["eventsByDate"],
  enabled = true,
): IcsEventIndexSnapshot {
  return Object.freeze({
    version,
    contentVersion: version,
    state,
    enabled,
    totalSources: enabled ? 1 : 0,
    loadedSources: state === "ready" ? 1 : 0,
    eventCount: Object.values(eventsByDate).reduce(
      (count, events) => count + events.length,
      0,
    ),
    skippedRecurring: 0,
    skippedInvalid: 0,
    truncatedEvents: 0,
    refreshedAt: null,
    sourceStatuses: Object.freeze([]),
    errors: Object.freeze([]),
    eventsByDate,
  });
}

function expectMonth(snapshot: ReturnType<CalendarQueryStore["getSnapshot"]>) {
  expect(snapshot.kind).toBe("month");
  if (snapshot.kind !== "month") throw new Error("Expected month query");
  return snapshot.query;
}

function expectWeek(snapshot: ReturnType<CalendarQueryStore["getSnapshot"]>) {
  expect(snapshot.kind).toBe("week");
  if (snapshot.kind !== "week") throw new Error("Expected week query");
  return snapshot.query;
}

function expectYear(snapshot: ReturnType<CalendarQueryStore["getSnapshot"]>) {
  expect(snapshot.kind).toBe("year");
  if (snapshot.kind !== "year") throw new Error("Expected year query");
  return snapshot.query;
}

function findDay(query: ReturnType<typeof expectMonth>, dateKey: string) {
  const day = query.weeks.flatMap((week) => week.days).find((candidate) =>
    `${candidate.date.year}-${String(candidate.date.month).padStart(2, "0")}-${String(candidate.date.day).padStart(2, "0")}` === dateKey);
  if (day === undefined) throw new Error(`Missing day ${dateKey}`);
  return day;
}

function findWeek(query: ReturnType<typeof expectMonth>, dateKey: string) {
  const week = query.weeks.find((candidate) => candidate.days.includes(findDay(query, dateKey)));
  if (week === undefined) throw new Error(`Missing week for ${dateKey}`);
  return week;
}
