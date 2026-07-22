import { normalizeIntervalNoteFolder } from "../../core/note/interval-note-spec";
import { getCalendarWeekIdentity } from "../../core/periodic/calendar-week";
import {
  formatLocalDateKey,
  getPeriodAnchor,
  shiftPeriod,
  toDateTime,
  type LocalDate,
  type WeekStartDay,
} from "../../core/periodic/periodic-date";
import type { RangeNoteSettings } from "../../shared/settings";
import type { CalendarOverlay, HolidayRegion } from "../../shared/settings";
import {
  selectIntervalNotes,
  selectIntervalWeekData,
  type IntervalWeekData,
} from "../intervals/interval-note-query";
import type { NoteIndexSnapshot } from "../notes/note-index";
import type {
  TaskDateKind,
  TaskDateRef,
} from "../notes/note-index-projections";
import { selectCalendarDay, type CalendarDay } from "./calendar-day-query";
import type { CalendarDecorationCache } from "./calendar-decoration-cache";
import type { IcsEventIndexSnapshot } from "./ics-event-index";
import {
  selectIndexedPeriodicNote,
  type IndexedPeriodicNote,
  type PeriodicNoteRule,
} from "./indexed-periodic-note";

export type WeekTaskDateKind = TaskDateKind;
export type WeekTaskOverdue = "none" | "warning" | "severe";

export interface WeekCalendarQueryOptions {
  readonly locale: string;
  readonly weekStartDay: WeekStartDay;
  readonly today: LocalDate;
  readonly calendarOverlays: readonly CalendarOverlay[];
  readonly holidayRegions: readonly HolidayRegion[];
  readonly daily: PeriodicNoteRule;
  readonly weekly: PeriodicNoteRule;
  readonly rangeNotes: Readonly<RangeNoteSettings>;
  readonly decorationCache?: CalendarDecorationCache;
}

export interface WeekTaskOccurrence {
  readonly date: LocalDate;
  readonly dateKey: string;
  readonly dateKinds: readonly WeekTaskDateKind[];
  readonly task: TaskDateRef["task"];
  readonly overdue: WeekTaskOverdue;
}

export interface WeekCalendarQuery {
  readonly noteSnapshotVersion: number;
  readonly icsSnapshotVersion: number;
  readonly weekStart: LocalDate;
  readonly weekEnd: LocalDate;
  readonly weekNumber: number;
  readonly weekYear: number;
  readonly days: readonly CalendarDay[];
  readonly weeklyNote: IndexedPeriodicNote;
  readonly tasks: readonly WeekTaskOccurrence[];
  readonly rangeNotesVisible: boolean;
  readonly rangeCreationConfigured: boolean;
  readonly intervals: IntervalWeekData;
}

export function selectWeekCalendar(
  selectedDate: LocalDate,
  noteSnapshot: NoteIndexSnapshot,
  icsSnapshot: IcsEventIndexSnapshot,
  options: WeekCalendarQueryOptions,
): WeekCalendarQuery {
  const weekStart = getPeriodAnchor(
    selectedDate,
    "weekly",
    options.weekStartDay,
  );
  const weekEnd = shiftPeriod(weekStart, "daily", 6, options.weekStartDay);
  const weekIdentity = getCalendarWeekIdentity(weekStart, options.weekStartDay);
  const days = Object.freeze(
    Array.from({ length: 7 }, (_, index) => {
      const date = shiftPeriod(weekStart, "daily", index, options.weekStartDay);
      return selectCalendarDay(date, noteSnapshot, icsSnapshot, {
        ...options,
        heatmap: null,
      });
    }),
  );
  const weeklyNote = selectIndexedPeriodicNote(
    weekStart,
    "weekly",
    noteSnapshot,
    options,
    options.weekly,
  );
  const intervals = options.rangeNotes.showInCalendar
    ? selectIntervalWeekData(
        selectIntervalNotes(noteSnapshot, options.rangeNotes).items,
        weekStart,
        options.rangeNotes.weekViewLimit,
      )
    : selectIntervalWeekData([], weekStart, 0);

  return Object.freeze({
    noteSnapshotVersion: noteSnapshot.version,
    icsSnapshotVersion: icsSnapshot.contentVersion,
    weekStart,
    weekEnd,
    weekNumber: weekIdentity.weekNumber,
    weekYear: weekIdentity.weekYear,
    days,
    weeklyNote,
    tasks: selectWeekTasks(noteSnapshot, weekStart, options.today),
    rangeNotesVisible: options.rangeNotes.showInCalendar,
    rangeCreationConfigured:
      normalizeIntervalNoteFolder(options.rangeNotes.folder).length > 0,
    intervals,
  });
}

function selectWeekTasks(
  snapshot: NoteIndexSnapshot,
  weekStart: LocalDate,
  today: LocalDate,
): readonly WeekTaskOccurrence[] {
  const occurrences: WeekTaskOccurrence[] = [];
  for (let index = 0; index < 7; index += 1) {
    const dateKey = formatLocalDateKey(
      shiftPeriod(weekStart, "daily", index, "monday"),
    );
    for (const ref of snapshot.taskDates.byDate[dateKey] ?? []) {
      occurrences.push(
        Object.freeze({
          date: ref.date,
          dateKey,
          dateKinds: ref.dateKinds,
          task: ref.task,
          overdue: getTaskOverdue(ref.task.completed, ref.dueDate, today),
        }),
      );
    }
  }
  return Object.freeze(occurrences);
}

function getTaskOverdue(
  completed: boolean,
  dueDate: LocalDate | null,
  today: LocalDate,
): WeekTaskOverdue {
  if (completed || dueDate === null) return "none";
  const days = Math.floor(
    toDateTime(today).diff(toDateTime(dueDate), "days").days,
  );
  if (days <= 0) return "none";
  return days >= 3 ? "severe" : "warning";
}
