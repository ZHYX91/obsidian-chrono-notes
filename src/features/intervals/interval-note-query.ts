import type { MonthGrid } from "../../core/calendar/month-grid";
import {
  compareLocalDate,
  shiftPeriod,
  toDateTime,
  type LocalDate,
} from "../../core/periodic/periodic-date";
import type { RangeNoteSettings } from "../../shared/settings";
import type { NoteIndexSnapshot } from "../notes/note-index";
import type {
  IntervalIndexSnapshot,
  IntervalNoteRef,
} from "../notes/note-index-projections";
import { getIntervalNoteScanFolder } from "./interval-list-setup";

export type IntervalNoteItem = IntervalNoteRef;

export interface IntervalNoteQuery {
  readonly snapshotVersion: number;
  readonly items: readonly IntervalNoteItem[];
}

interface IntervalWeekSegment extends IntervalNoteItem {
  readonly lane: number;
  readonly colorIndex: number;
  readonly startColumn: number;
  readonly endColumn: number;
  readonly startsBeforeWeek: boolean;
  readonly endsAfterWeek: boolean;
}

type IntervalHiddenItem = IntervalNoteItem;

export interface IntervalWeekData {
  readonly items: readonly IntervalWeekSegment[];
  readonly visibleLaneCount: number;
  readonly hiddenCount: number;
  readonly hiddenItems: readonly IntervalHiddenItem[];
  readonly totalCount: number;
}

export interface MonthIntervalRows {
  readonly snapshotVersion: number;
  readonly rows: readonly Readonly<{
    weekStart: LocalDate;
    data: IntervalWeekData;
  }>[];
}

const EMPTY_WEEK_DATA: IntervalWeekData = Object.freeze({
  items: Object.freeze([]),
  visibleLaneCount: 0,
  hiddenCount: 0,
  hiddenItems: Object.freeze([]),
  totalCount: 0,
});

const EMPTY_INTERVAL_ITEMS = Object.freeze([]) as readonly IntervalNoteItem[];

export function selectIntervalNotes(
  snapshot: NoteIndexSnapshot,
  settings: Readonly<RangeNoteSettings>,
): IntervalNoteQuery {
  return selectIntervalNotesFromProjection(
    snapshot.intervals,
    settings,
    snapshot.version,
  );
}

export function selectIntervalNotesFromProjection(
  intervals: IntervalIndexSnapshot,
  settings: Readonly<RangeNoteSettings>,
  snapshotVersion = intervals.revision,
): IntervalNoteQuery {
  const scopeFolder = getIntervalNoteScanFolder(settings);
  const items = scopeFolder === null
    ? intervals.items
    : Object.freeze(intervals.items.filter((item) =>
        isIntervalNoteInScope(item, scopeFolder)));
  return Object.freeze({
    snapshotVersion,
    items: items.length === 0 ? EMPTY_INTERVAL_ITEMS : items,
  });
}

/** The same visibility predicate is used by queries and their cache dependencies. */
export function isIntervalNoteInScope(
  item: Pick<IntervalNoteRef, "path" | "recognition">,
  scopeFolder: string | null,
): boolean {
  return item.recognition === "explicit" || scopeFolder === null ||
    (scopeFolder !== "" && isPathInFolder(item.path, scopeFolder));
}

export function selectIntervalWeekData(
  items: readonly IntervalNoteItem[],
  weekStart: LocalDate,
  maxItems: number,
): IntervalWeekData {
  const weekEnd = shiftPeriod(weekStart, "daily", 6, "monday");
  const window = createDayWindow(weekStart, weekEnd);
  const lanes = allocateIntervalLanes(items, window, maxItems);
  return buildWeekData(lanes, window);
}

export function selectMonthIntervalRowsForGrid(
  grid: MonthGrid,
  snapshot: NoteIndexSnapshot,
  settings: Readonly<RangeNoteSettings>,
): MonthIntervalRows {
  const firstWeek = grid.weeks[0];
  const lastWeek = grid.weeks.at(-1);
  const visibleStart = firstWeek?.days[0]?.date;
  const visibleEnd = lastWeek?.days.at(-1)?.date;
  if (visibleStart === undefined || visibleEnd === undefined) {
    throw new Error("Month grid is missing its visible date range");
  }
  const lanes = settings.showInCalendar
    ? allocateIntervalLanes(
        selectIntervalNotes(snapshot, settings).items,
        createDayWindow(visibleStart, visibleEnd),
        settings.monthViewLimit,
      )
    : null;
  return Object.freeze({
    snapshotVersion: snapshot.version,
    rows: Object.freeze(grid.weeks.map((week) => {
      const weekStart = week.days[0]?.date;
      const weekEnd = week.days.at(-1)?.date;
      if (weekStart === undefined || weekEnd === undefined) {
        throw new Error("Month week is missing its visible date range");
      }
      return Object.freeze({
        weekStart,
        data: lanes === null
          ? EMPTY_WEEK_DATA
          : buildWeekData(
              lanes,
              createDayWindow(weekStart, weekEnd),
            ),
      });
    })),
  });
}

function isPathInFolder(path: string, folder: string): boolean {
  return path === folder || path.startsWith(`${folder}/`);
}

interface IntervalLaneItem {
  readonly source: IntervalNoteItem;
  readonly lane: number | null;
}

interface DayWindow {
  readonly start: LocalDate;
  readonly end: LocalDate;
  readonly startMillis: number;
}

const DAY_MILLIS = 24 * 60 * 60 * 1_000;

function createDayWindow(start: LocalDate, end: LocalDate): DayWindow {
  return { start, end, startMillis: toDateTime(start).toMillis() };
}

function overlapsWindow(item: IntervalNoteItem, window: DayWindow): boolean {
  return compareLocalDate(item.end.date, window.start) >= 0 &&
    compareLocalDate(item.start.date, window.end) <= 0;
}

function allocateIntervalLanes(
  items: readonly IntervalNoteItem[],
  window: DayWindow,
  maxLanes: number,
): readonly IntervalLaneItem[] {
  const limit = Math.max(0, Math.trunc(maxLanes));
  const laneEnds: LocalDate[] = [];
  const result: IntervalLaneItem[] = [];
  for (const item of items) {
    if (!overlapsWindow(item, window)) continue;
    // A hidden lane can never influence the first free visible lane. Preserve
    // input order, including offset timestamps whose civil dates run backwards.
    const free = laneEnds.findIndex((end) => compareLocalDate(end, item.start.date) < 0);
    const lane = free >= 0 ? free : laneEnds.length;
    if (lane < limit) {
      laneEnds[lane] = item.end.date;
      result.push({ source: item, lane });
    } else {
      result.push({ source: item, lane: null });
    }
  }
  return result;
}

function buildWeekData(lanes: readonly IntervalLaneItem[], window: DayWindow): IntervalWeekData {
  const visible: IntervalWeekSegment[] = [];
  const hidden: IntervalNoteItem[] = [];
  let visibleLaneCount = 0;
  for (const { source, lane } of lanes) {
    if (!overlapsWindow(source, window)) continue;
    if (lane === null) {
      hidden.push(source);
      continue;
    }
    visibleLaneCount = Math.max(visibleLaneCount, lane + 1);
    const startColumn = (toDateTime(source.start.date).toMillis() - window.startMillis) / DAY_MILLIS;
    const endColumn = (toDateTime(source.end.date).toMillis() - window.startMillis) / DAY_MILLIS;
    visible.push(Object.freeze({
      ...source, lane, colorIndex: getIntervalColorIndex(source.path),
      startColumn: Math.max(0, startColumn),
      endColumn: Math.min(6, endColumn),
      startsBeforeWeek: startColumn < 0,
      endsAfterWeek: endColumn > 6,
    }));
  }
  if (visible.length === 0 && hidden.length === 0) return EMPTY_WEEK_DATA;
  return Object.freeze({
    items: Object.freeze(visible),
    visibleLaneCount,
    hiddenCount: hidden.length,
    hiddenItems: Object.freeze(hidden),
    totalCount: visible.length + hidden.length,
  });
}

function getIntervalColorIndex(path: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < path.length; index += 1) {
    hash ^= path.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0) % 8;
}
