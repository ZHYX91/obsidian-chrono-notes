import {
  buildMonthGrid,
  type MonthGrid,
} from "../../core/calendar/month-grid";
import {
  shiftPeriod,
  toDateTime,
  type LocalDate,
  type WeekStartDay,
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

export interface IntervalWeekSegment extends IntervalNoteItem {
  readonly lane: number;
  readonly colorIndex: number;
  readonly startColumn: number;
  readonly endColumn: number;
  readonly startsBeforeWeek: boolean;
  readonly endsAfterWeek: boolean;
}

export type IntervalHiddenItem = IntervalNoteItem;

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
  if (scopeFolder === "") {
    return Object.freeze({
      snapshotVersion,
      items: EMPTY_INTERVAL_ITEMS,
    });
  }
  const items = scopeFolder === null
    ? intervals.items
    : Object.freeze(intervals.items.filter((item) =>
        isPathInFolder(item.path, scopeFolder)));
  return Object.freeze({
    snapshotVersion,
    items,
  });
}

export function selectIntervalWeekData(
  items: readonly IntervalNoteItem[],
  weekStart: LocalDate,
  maxItems: number,
): IntervalWeekData {
  const weekEnd = shiftPeriod(weekStart, "daily", 6, "monday");
  const window = createDayWindow(weekStart, weekEnd);
  const lanes = allocateIntervalLanes(items, window);
  return buildWeekData(lanes, window, maxItems);
}

export function selectMonthIntervalRows(
  target: Readonly<{ year: number; month: number }>,
  weekStartDay: WeekStartDay,
  snapshot: NoteIndexSnapshot,
  settings: Readonly<RangeNoteSettings>,
): MonthIntervalRows {
  return selectMonthIntervalRowsForGrid(
    buildMonthGrid(target.year, target.month, weekStartDay),
    snapshot,
    settings,
  );
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
              settings.monthViewLimit,
            ),
      });
    })),
  });
}

function isPathInFolder(path: string, folder: string): boolean {
  return path === folder || path.startsWith(`${folder}/`);
}

function buildWeekSegment(
  item: IntervalLaneItem,
  window: DayWindow,
): IntervalWeekSegment {
  return Object.freeze({
    ...item.source,
    lane: item.lane,
    colorIndex: item.colorIndex,
    startColumn: Math.max(
      0,
      Math.floor((item.startDayMillis - window.startMillis) / DAY_MILLIS),
    ),
    endColumn: Math.min(
      6,
      Math.floor((item.endDayMillis - window.startMillis) / DAY_MILLIS),
    ),
    startsBeforeWeek: item.startDayMillis < window.startMillis,
    endsAfterWeek: item.endDayMillis > window.endMillis,
  });
}

interface IntervalLaneItem {
  readonly source: IntervalNoteItem;
  readonly startDayMillis: number;
  readonly endDayMillis: number;
  readonly lane: number;
  readonly colorIndex: number;
}

interface DayWindow {
  readonly startMillis: number;
  readonly endMillis: number;
}

const DAY_MILLIS = 24 * 60 * 60 * 1_000;

function allocateIntervalLanes(
  items: readonly IntervalNoteItem[],
  window: DayWindow,
): readonly IntervalLaneItem[] {
  const laneEnds: number[] = [];
  const result: IntervalLaneItem[] = [];

  for (const item of items) {
    const startDayMillis = toDateTime(item.start.date).toMillis();
    const endDayMillis = toDateTime(item.end.date).toMillis();
    if (startDayMillis > window.endMillis) continue;
    if (endDayMillis < window.startMillis) continue;
    let lane = laneEnds.findIndex((laneEnd) => laneEnd < startDayMillis);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = endDayMillis;
    result.push(Object.freeze({
      source: item,
      startDayMillis,
      endDayMillis,
      lane,
      colorIndex: getIntervalColorIndex(item.path),
    }));
  }
  return Object.freeze(result);
}

function buildWeekData(
  lanes: readonly IntervalLaneItem[],
  window: DayWindow,
  maxLanes: number,
): IntervalWeekData {
  const overlapping = lanes.filter(
    (item) =>
      item.endDayMillis >= window.startMillis &&
      item.startDayMillis <= window.endMillis,
  );
  if (overlapping.length === 0) return EMPTY_WEEK_DATA;

  const limit = Math.max(0, Math.trunc(maxLanes));
  const visible = overlapping.filter((item) => item.lane < limit);
  const hidden = overlapping.filter((item) => item.lane >= limit);
  return Object.freeze({
    items: Object.freeze(visible.map((item) => buildWeekSegment(item, window))),
    visibleLaneCount: visible.reduce((count, item) => Math.max(count, item.lane + 1), 0),
    hiddenCount: hidden.length,
    hiddenItems: Object.freeze(hidden.map((item) => item.source)),
    totalCount: overlapping.length,
  });
}

function createDayWindow(start: LocalDate, end: LocalDate): DayWindow {
  return Object.freeze({
    startMillis: toDateTime(start).toMillis(),
    endMillis: toDateTime(end).toMillis(),
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
