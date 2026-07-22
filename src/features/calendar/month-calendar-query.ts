import { buildMonthGrid } from "../../core/calendar/month-grid";
import type {
  LocalDate,
  WeekStartDay,
} from "../../core/periodic/periodic-date";
import type { StatisticDisplayDimension } from "../../core/statistics/heatmap";
import type {
  CalendarOverlay,
  HolidayRegion,
  RangeNoteSettings,
} from "../../shared/settings";
import {
  selectMonthIntervalRowsForGrid,
  type IntervalWeekData,
} from "../intervals/interval-note-query";
import type { NoteIndexSnapshot } from "../notes/note-index";
import { selectCalendarDay, type CalendarDay } from "./calendar-day-query";
import type { CalendarDecorationCache } from "./calendar-decoration-cache";
import type { IcsEventIndexSnapshot } from "./ics-event-index";
import {
  selectIndexedPeriodicNote,
  type IndexedPeriodicNote,
  type PeriodicNoteRule,
} from "./indexed-periodic-note";

export interface MonthCalendarQueryOptions {
  readonly locale: string;
  readonly weekStartDay: WeekStartDay;
  readonly calendarOverlays: readonly CalendarOverlay[];
  readonly holidayRegions: readonly HolidayRegion[];
  readonly heatmap: Readonly<{
    dimension: StatisticDisplayDimension;
    valueStep: number;
  }> | null;
  readonly daily: PeriodicNoteRule;
  readonly weekly: PeriodicNoteRule;
  readonly rangeNotes: Readonly<RangeNoteSettings>;
  readonly decorationCache?: CalendarDecorationCache;
}

export interface MonthCalendarDay extends CalendarDay {
  readonly inCurrentMonth: boolean;
}

export interface MonthCalendarWeek {
  readonly weekStart: LocalDate;
  readonly weekNumber: number;
  readonly weekYear: number;
  readonly weeklyNote: IndexedPeriodicNote;
  readonly days: readonly MonthCalendarDay[];
  readonly intervals: IntervalWeekData;
}

export interface MonthCalendarQuery {
  readonly year: number;
  readonly month: number;
  readonly noteSnapshotVersion: number;
  readonly icsSnapshotVersion: number;
  readonly weeks: readonly MonthCalendarWeek[];
}

export function selectMonthCalendar(
  target: Readonly<{ year: number; month: number }>,
  noteSnapshot: NoteIndexSnapshot,
  icsSnapshot: IcsEventIndexSnapshot,
  options: MonthCalendarQueryOptions,
): MonthCalendarQuery {
  const grid = buildMonthGrid(target.year, target.month, options.weekStartDay);
  const rangeNotes = options.heatmap === null
    ? options.rangeNotes
    : { ...options.rangeNotes, showInCalendar: false };
  const intervalRows = selectMonthIntervalRowsForGrid(
    grid,
    noteSnapshot,
    rangeNotes,
  );
  const weeks = grid.weeks.map((week, weekIndex): MonthCalendarWeek => {
    const weekStart = week.days[0]?.date;
    const intervals = intervalRows.rows[weekIndex]?.data;
    if (weekStart === undefined || intervals === undefined) {
      throw new Error("Month calendar query received an incomplete week grid");
    }
    const days = week.days.map(
      (gridDay): MonthCalendarDay =>
        Object.freeze({
          ...gridDay,
          ...selectCalendarDay(
            gridDay.date,
            noteSnapshot,
            icsSnapshot,
            options,
          ),
        }),
    );
    return Object.freeze({
      weekStart,
      weekNumber: week.weekNumber,
      weekYear: week.weekYear,
      weeklyNote: selectIndexedPeriodicNote(
        weekStart,
        "weekly",
        noteSnapshot,
        options,
        options.weekly,
      ),
      days: Object.freeze(days),
      intervals,
    });
  });

  return Object.freeze({
    year: target.year,
    month: target.month,
    noteSnapshotVersion: noteSnapshot.version,
    icsSnapshotVersion: icsSnapshot.contentVersion,
    weeks: Object.freeze(weeks),
  });
}
