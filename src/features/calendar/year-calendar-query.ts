import { buildMonthGrid } from "../../core/calendar/month-grid";
import type {
  LocalDate,
  WeekStartDay,
} from "../../core/periodic/periodic-date";
import {
  getHeatmapMetric,
  type HeatmapMetric,
  type StatisticDisplayDimension,
} from "../../core/statistics/heatmap";
import type { NoteIndexSnapshot } from "../notes/note-index";
import {
  resolveIndexedPeriodicNotePath,
  selectIndexedPeriodicNoteAtPath,
  type IndexedPeriodicNote,
  type PeriodicNoteRule,
} from "./indexed-periodic-note";

export interface YearCalendarQueryOptions {
  readonly locale: string;
  readonly weekStartDay: WeekStartDay;
  readonly statisticDisplayDimension: StatisticDisplayDimension;
  readonly statisticValueStep: number;
  readonly daily: PeriodicNoteRule;
  readonly monthly: PeriodicNoteRule;
  readonly quarterly: PeriodicNoteRule;
}

export type YearCalendarOverviewQueryOptions = Pick<
  YearCalendarQueryOptions,
  "locale" | "weekStartDay" | "monthly" | "quarterly"
>;

export interface YearPeriodicSummary extends IndexedPeriodicNote {
  readonly noteType: "monthly" | "quarterly";
}

export interface YearHeatmapDay extends IndexedPeriodicNote {
  readonly heatmap: HeatmapMetric;
}

interface YearCalendarMonth {
  readonly month: number;
  readonly summary: YearPeriodicSummary;
  readonly heatmapCells: readonly (YearHeatmapDay | null)[];
}

export interface YearCalendarQuarter {
  readonly quarter: number;
  readonly summary: YearPeriodicSummary;
  readonly months: readonly YearCalendarMonth[];
}

export interface YearCalendarQuery {
  readonly year: number;
  readonly noteSnapshotVersion: number;
  readonly quarters: readonly YearCalendarQuarter[];
}

const EMPTY_HEATMAP_CELLS = Object.freeze([]) as readonly (
  YearHeatmapDay | null
)[];

export function selectYearCalendar(
  year: number,
  snapshot: NoteIndexSnapshot,
  options: YearCalendarQueryOptions,
): YearCalendarQuery {
  return selectYearCalendarHeatmap(year, snapshot, options);
}

interface YearNoteTarget {
  readonly date: LocalDate;
  readonly path: string | null;
}

interface YearMonthLayout {
  readonly month: number;
  readonly summary: YearNoteTarget;
  readonly cells: readonly (YearNoteTarget | null)[];
}

export interface YearCalendarLayout {
  readonly quarters: readonly {
    readonly quarter: number;
    readonly summary: YearNoteTarget;
    readonly months: readonly YearMonthLayout[];
  }[];
}

export function buildYearCalendarLayout(
  year: number,
  options: YearCalendarOverviewQueryOptions,
  daily?: PeriodicNoteRule,
): YearCalendarLayout {
  function target(
    date: LocalDate,
    type: "daily" | "monthly" | "quarterly",
    rule: PeriodicNoteRule,
  ): YearNoteTarget {
    return { date, path: resolveIndexedPeriodicNotePath(date, type, options, rule) };
  }

  function buildMonth(month: number): YearMonthLayout {
    const date = Object.freeze({ year, month, day: 1 });
    const cells = daily === undefined
      ? []
      : buildMonthGrid(year, month, options.weekStartDay).days.map(
          (day) => day.inCurrentMonth ? target(day.date, "daily", daily) : null,
        );
    return { month, summary: target(date, "monthly", options.monthly), cells };
  }

  const quarters = Array.from({ length: 4 }, (_, quarterIndex) => {
    const firstMonth = quarterIndex * 3 + 1;
    const date = Object.freeze({ year, month: firstMonth, day: 1 });
    return {
      quarter: quarterIndex + 1,
      summary: target(date, "quarterly", options.quarterly),
      months: Array.from({ length: 3 }, (_, offset) => buildMonth(firstMonth + offset)),
    };
  });
  return { quarters };
}

export function selectYearCalendarOverview(
  year: number,
  snapshot: NoteIndexSnapshot,
  options: YearCalendarOverviewQueryOptions,
  layout = buildYearCalendarLayout(year, options),
): YearCalendarQuery {
  return buildYearCalendar(year, snapshot, layout, null);
}

export function selectYearCalendarHeatmap(
  year: number,
  snapshot: NoteIndexSnapshot,
  options: YearCalendarQueryOptions,
  layout = buildYearCalendarLayout(year, options, options.daily),
): YearCalendarQuery {
  return buildYearCalendar(year, snapshot, layout, options);
}

function buildYearCalendar(
  year: number,
  snapshot: NoteIndexSnapshot,
  layout: YearCalendarLayout,
  heatmapOptions: YearCalendarQueryOptions | null,
): YearCalendarQuery {
  function summary(
    target: YearNoteTarget,
    noteType: "monthly" | "quarterly",
  ): YearPeriodicSummary {
    const note = selectIndexedPeriodicNoteAtPath(target.date, target.path, snapshot);
    return Object.freeze({ ...note, noteType });
  }

  function selectMonth(month: YearMonthLayout): YearCalendarMonth {
    const heatmapCells = heatmapOptions === null
      ? EMPTY_HEATMAP_CELLS
      : Object.freeze(month.cells.map((cell) => {
          if (cell === null) return null;
          const note = selectIndexedPeriodicNoteAtPath(cell.date, cell.path, snapshot);
          const heatmap = getHeatmapMetric(
            note.statistics,
            heatmapOptions.statisticDisplayDimension,
            heatmapOptions.statisticValueStep,
          );
          return Object.freeze({ ...note, heatmap });
        }));
    return Object.freeze({
      month: month.month,
      summary: summary(month.summary, "monthly"),
      heatmapCells,
    });
  }

  const quarters = layout.quarters.map((quarter) => Object.freeze({
    quarter: quarter.quarter,
    summary: summary(quarter.summary, "quarterly"),
    months: Object.freeze(quarter.months.map(selectMonth)),
  }));
  return Object.freeze({
    year,
    noteSnapshotVersion: snapshot.version,
    quarters: Object.freeze(quarters),
  });
}
