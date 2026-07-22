import { describe, expect, it } from "vitest";

import type { IcsEventOccurrence } from "../../src/core/calendar/ics-calendar";
import { selectCalendarDay } from "../../src/features/calendar/calendar-day-query";
import type { IcsEventIndexSnapshot } from "../../src/features/calendar/ics-event-index";
import { createNoteIndexSnapshot } from "../support/note-index-snapshot";

const NOTES = createNoteIndexSnapshot({}, 3);

const OPTIONS = Object.freeze({
  locale: "en-US",
  weekStartDay: "monday" as const,
  calendarOverlays: Object.freeze([]),
  holidayRegions: Object.freeze([]),
  heatmap: null,
  daily: Object.freeze({ enabled: false, pattern: "" }),
});

function occurrence(
  id: string,
  options: Partial<IcsEventOccurrence> = {},
): IcsEventOccurrence {
  return Object.freeze({
    id,
    title: id,
    source: "team.ics",
    sourceLabel: "team.ics",
    isAllDay: true,
    startsOnDate: true,
    endsOnDate: true,
    continuesBefore: false,
    continuesAfter: false,
    timeLabel: null,
    sortTimestamp: 0,
    ...options,
  });
}

function icsSnapshot(
  eventsByDate: IcsEventIndexSnapshot["eventsByDate"],
  overrides: Partial<IcsEventIndexSnapshot> = {},
): IcsEventIndexSnapshot {
  return Object.freeze({
    version: 9,
    contentVersion: 9,
    state: "ready",
    enabled: true,
    totalSources: 1,
    loadedSources: 1,
    eventCount: 4,
    skippedRecurring: 0,
    skippedInvalid: 0,
    truncatedEvents: 0,
    refreshedAt: 123,
    sourceStatuses: Object.freeze([]),
    errors: Object.freeze([]),
    eventsByDate,
    ...overrides,
  });
}

describe("selectCalendarDay", () => {
  it("keeps every indexed ICS event for view-specific presentation", () => {
    const events = Object.freeze([
      occurrence("all-day"),
      occurrence("timed", { isAllDay: false, timeLabel: "09:30", sortTimestamp: 1 }),
      occurrence("continued", { continuesBefore: true, sortTimestamp: 2 }),
      occurrence("fourth", { sortTimestamp: 3 }),
    ]);
    const day = selectCalendarDay(
      { year: 2026, month: 5, day: 6 },
      NOTES,
      icsSnapshot(Object.freeze({ "2026-05-06": events })),
      OPTIONS,
    );

    expect(day.icsEvents).toEqual(events);
    expect(day.noteState).toBe("not-configured");
    expect(Object.isFrozen(day)).toBe(true);
    expect(Object.isFrozen(day.icsEvents)).toBe(true);
  });

  it("keeps previous events while refreshing and removes disabled data", () => {
    const eventsByDate = Object.freeze({
      "2026-05-06": Object.freeze([occurrence("one")]),
    });
    const refreshing = selectCalendarDay(
      { year: 2026, month: 5, day: 6 },
      NOTES,
      icsSnapshot(eventsByDate, { state: "refreshing" }),
      OPTIONS,
    );
    const disabled = selectCalendarDay(
      { year: 2026, month: 5, day: 6 },
      NOTES,
      icsSnapshot(eventsByDate, { state: "disabled", enabled: false }),
      OPTIONS,
    );

    expect(refreshing.icsEvents).toHaveLength(1);
    expect(disabled.icsEvents).toEqual([]);
    expect(Object.isFrozen(disabled.icsEvents)).toBe(true);
  });

  it("combines configured calendar, holiday, work-rest, and complete ICS data", () => {
    const events = Object.freeze([
      occurrence("first"),
      occurrence("second", { sortTimestamp: 1 }),
      occurrence("third", { sortTimestamp: 2 }),
      occurrence("fourth", { sortTimestamp: 3 }),
    ]);
    const options = {
      ...OPTIONS,
      locale: "zh-CN",
      calendarOverlays: ["chinese-lunar" as const],
      holidayRegions: ["cn" as const],
    };
    const holiday = selectCalendarDay(
      { year: 2026, month: 2, day: 17 },
      NOTES,
      icsSnapshot(Object.freeze({ "2026-02-17": events })),
      options,
    );
    const adjustedWorkday = selectCalendarDay(
      { year: 2026, month: 2, day: 28 },
      NOTES,
      icsSnapshot(Object.freeze({})),
      options,
    );

    expect(holiday.calendarOverlays).toHaveLength(1);
    expect(holiday.holidays).toHaveLength(1);
    expect(holiday.workday).toMatchObject({ isWorkday: false });
    expect(holiday.regionalMarker).toMatchObject({ kind: "rest" });
    expect(holiday.icsEvents).toEqual(events);
    expect(adjustedWorkday.holidays).toEqual([]);
    expect(adjustedWorkday.workday).toMatchObject({ isWorkday: true });
    expect(adjustedWorkday.regionalMarker).toMatchObject({ kind: "work" });
    expect(Object.isFrozen(holiday.calendarOverlays)).toBe(true);
    expect(Object.isFrozen(holiday.holidays)).toBe(true);
    expect(Object.isFrozen(holiday.icsEvents)).toBe(true);
  });
});
