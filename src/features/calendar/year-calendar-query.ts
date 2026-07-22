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
  selectIndexedPeriodicNote,
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

export interface YearCalendarMonth {
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

export function selectYearCalendarOverview(
  year: number,
  snapshot: NoteIndexSnapshot,
  options: YearCalendarOverviewQueryOptions,
): YearCalendarQuery {
  return buildYearCalendar(year, snapshot, options, null);
}

export function selectYearCalendarHeatmap(
  year: number,
  snapshot: NoteIndexSnapshot,
  options: YearCalendarQueryOptions,
): YearCalendarQuery {
  return buildYearCalendar(year, snapshot, options, options);
}

function buildYearCalendar(
  year: number,
  snapshot: NoteIndexSnapshot,
  options: YearCalendarOverviewQueryOptions,
  heatmapOptions: YearCalendarQueryOptions | null,
): YearCalendarQuery {
  const quarters = Array.from(
    { length: 4 },
    (_, quarterIndex): YearCalendarQuarter => {
      const quarter = quarterIndex + 1;
      const firstMonth = quarterIndex * 3 + 1;
      const quarterDate = Object.freeze({ year, month: firstMonth, day: 1 });
      const months = Array.from(
        { length: 3 },
        (_, monthIndex): YearCalendarMonth => {
          const month = firstMonth + monthIndex;
          const monthDate = Object.freeze({ year, month, day: 1 });
          const heatmapCells = heatmapOptions === null
            ? EMPTY_HEATMAP_CELLS
            : Object.freeze(
                buildMonthGrid(year, month, options.weekStartDay).days.map(
                  (gridDay) =>
                    gridDay.inCurrentMonth
                      ? selectHeatmapDay(
                          gridDay.date,
                          snapshot,
                          heatmapOptions,
                        )
                      : null,
                ),
              );
          return Object.freeze({
            month,
            summary: selectPeriodicSummary(
              monthDate,
              "monthly",
              snapshot,
              options.monthly,
              options,
            ),
            heatmapCells,
          });
        },
      );

      return Object.freeze({
        quarter,
        summary: selectPeriodicSummary(
          quarterDate,
          "quarterly",
          snapshot,
          options.quarterly,
          options,
        ),
        months: Object.freeze(months),
      });
    },
  );

  return Object.freeze({
    year,
    noteSnapshotVersion: snapshot.version,
    quarters: Object.freeze(quarters),
  });
}

function selectPeriodicSummary(
  date: LocalDate,
  noteType: "monthly" | "quarterly",
  snapshot: NoteIndexSnapshot,
  config: PeriodicNoteRule,
  options: Pick<YearCalendarQueryOptions, "locale" | "weekStartDay">,
): YearPeriodicSummary {
  const resolved = selectIndexedPeriodicNote(
    date,
    noteType,
    snapshot,
    options,
    config,
  );
  return Object.freeze({
    ...resolved,
    noteType,
  });
}

function selectHeatmapDay(
  date: LocalDate,
  snapshot: NoteIndexSnapshot,
  options: YearCalendarQueryOptions,
): YearHeatmapDay {
  const resolved = selectIndexedPeriodicNote(
    date,
    "daily",
    snapshot,
    options,
    options.daily,
  );
  return Object.freeze({
    ...resolved,
    heatmap: getHeatmapMetric(
      resolved.statistics,
      options.statisticDisplayDimension,
      options.statisticValueStep,
    ),
  });
}
