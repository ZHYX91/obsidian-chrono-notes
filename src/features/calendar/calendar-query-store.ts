import { buildMonthGrid } from "../../core/calendar/month-grid";
import type { IcsEventOccurrence } from "../../core/calendar/ics-calendar";
import { normalizeIntervalNoteFolder } from "../../core/note/interval-note-spec";
import {
  formatLocalDateKey,
  getPeriodAnchor,
  shiftPeriod,
  type LocalDate,
  type PeriodicNoteType,
} from "../../core/periodic/periodic-date";
import { formatPeriodicNotePath } from "../../core/periodic/periodic-note-path";
import type { RangeNoteSettings } from "../../shared/settings";
import { getIntervalNoteScanFolder } from "../intervals/interval-list-setup";
import type {
  NoteIndexSnapshot,
  PresentNoteIndexEntry,
} from "../notes/note-index";
import type {
  IntervalNoteRef,
  TaskDateRef,
} from "../notes/note-index-projections";
import { notifyListeners } from "../notify-listeners";
import type {
  IcsEventIndexSnapshot,
} from "./ics-event-index";
import {
  selectMonthCalendar,
  type MonthCalendarQuery,
  type MonthCalendarQueryOptions,
} from "./month-calendar-query";
import {
  selectWeekCalendar,
  type WeekCalendarQuery,
  type WeekCalendarQueryOptions,
} from "./week-calendar-query";
import {
  selectYearCalendarHeatmap,
  selectYearCalendarOverview,
  type YearCalendarQuery,
  type YearCalendarQueryOptions,
} from "./year-calendar-query";

export interface MonthCalendarQueryRequest {
  readonly kind: "month";
  readonly target: Readonly<{ year: number; month: number }>;
  readonly options: MonthCalendarQueryOptions;
}

export interface WeekCalendarQueryRequest {
  readonly kind: "week";
  readonly selectedDate: LocalDate;
  readonly options: WeekCalendarQueryOptions;
}

export interface YearCalendarQueryRequest {
  readonly kind: "year";
  readonly year: number;
  readonly heatmap: boolean;
  readonly options: YearCalendarQueryOptions;
}

export type CalendarQueryRequest =
  | MonthCalendarQueryRequest
  | WeekCalendarQueryRequest
  | YearCalendarQueryRequest;

export type CalendarQuerySnapshot =
  | Readonly<{ kind: "month"; query: MonthCalendarQuery }>
  | Readonly<{ kind: "week"; query: WeekCalendarQuery }>
  | Readonly<{ kind: "year"; query: YearCalendarQuery }>;

interface SnapshotSource<T> {
  getSnapshot(): T;
  subscribe(listener: () => void): () => void;
}

type NoteEntryReference = PresentNoteIndexEntry | undefined;

interface DayDependency {
  readonly noteEntry: NoteEntryReference;
  readonly icsEvents: readonly IcsEventOccurrence[];
}

interface MonthDependencies {
  readonly kind: "month";
  readonly geometryKey: string;
  readonly dayOptionsKey: string;
  readonly weeklyOptionsKey: string;
  readonly intervalOptionsKey: string;
  readonly days: readonly DayDependency[];
  readonly weeklyEntries: readonly NoteEntryReference[];
  readonly intervalItems: readonly IntervalNoteRef[];
  readonly intervalItemsByWeek: readonly (readonly IntervalNoteRef[])[];
}

interface WeekDependencies {
  readonly kind: "week";
  readonly geometryKey: string;
  readonly dayOptionsKey: string;
  readonly weeklyOptionsKey: string;
  readonly taskOptionsKey: string;
  readonly intervalOptionsKey: string;
  readonly days: readonly DayDependency[];
  readonly weeklyEntry: NoteEntryReference;
  readonly taskBuckets: readonly (readonly TaskDateRef[])[];
  readonly intervalItems: readonly IntervalNoteRef[];
}

interface YearMonthDependencies {
  readonly summaryEntry: NoteEntryReference;
  readonly dailyEntries: readonly NoteEntryReference[];
}

interface YearQuarterDependencies {
  readonly summaryEntry: NoteEntryReference;
  readonly months: readonly YearMonthDependencies[];
}

interface YearDependencies {
  readonly kind: "year";
  readonly geometryKey: string;
  readonly monthlyOptionsKey: string;
  readonly quarterlyOptionsKey: string;
  readonly heatmapOptionsKey: string;
  readonly quarters: readonly YearQuarterDependencies[];
}

type CalendarQueryDependencies =
  | MonthDependencies
  | WeekDependencies
  | YearDependencies;

interface EvaluatedQuery {
  readonly dependencies: CalendarQueryDependencies;
  readonly snapshot: CalendarQuerySnapshot;
}

const EMPTY_REFERENCES = Object.freeze([]) as readonly NoteEntryReference[];
const EMPTY_ICS_EVENTS = Object.freeze([]) as readonly IcsEventOccurrence[];
const EMPTY_INTERVAL_ITEMS = Object.freeze([]) as readonly IntervalNoteRef[];
const EMPTY_TASK_BUCKET = Object.freeze([]) as readonly TaskDateRef[];

/**
 * A request-bound derived store for one visible calendar query.
 *
 * Keeping the request immutable means speculative React renders cannot replace
 * the request used by the currently committed subscription. The store owns no
 * Vault facts and forwards source notifications only when this request's actual
 * dependencies change.
 */
export class CalendarQueryStore {
  private readonly listeners = new Set<() => void>();
  private noteSnapshot: NoteIndexSnapshot;
  private icsSnapshot: IcsEventIndexSnapshot;
  private current: EvaluatedQuery | null = null;
  private unsubscribeNotes: (() => void) | null = null;
  private unsubscribeIcs: (() => void) | null = null;
  private disposed = false;

  constructor(
    private readonly noteSource: SnapshotSource<NoteIndexSnapshot>,
    private readonly icsSource: SnapshotSource<IcsEventIndexSnapshot>,
    private readonly request: CalendarQueryRequest,
  ) {
    this.noteSnapshot = noteSource.getSnapshot();
    this.icsSnapshot = icsSource.getSnapshot();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.assertActive();
    this.listeners.add(listener);
    if (this.listeners.size === 1) this.startSourceSubscriptions();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stopSourceSubscriptions();
    };
  };

  getSnapshot = (): CalendarQuerySnapshot => {
    this.assertActive();
    if (this.current === null) {
      this.readLatestSourceSnapshots();
      return this.evaluate().snapshot;
    }
    if (this.listeners.size === 0) {
      if (!this.readLatestSourceSnapshots()) return this.current.snapshot;
      return this.evaluate().snapshot;
    }
    return this.current.snapshot;
  };

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopSourceSubscriptions();
    this.listeners.clear();
    this.current = null;
  }

  private startSourceSubscriptions(): void {
    this.unsubscribeNotes = this.noteSource.subscribe(this.handleSourceChange);
    this.unsubscribeIcs = this.icsSource.subscribe(this.handleSourceChange);
    this.readLatestSourceSnapshots();
    if (this.current !== null) this.evaluate();
  }

  private stopSourceSubscriptions(): void {
    this.unsubscribeNotes?.();
    this.unsubscribeIcs?.();
    this.unsubscribeNotes = null;
    this.unsubscribeIcs = null;
  }

  private readonly handleSourceChange = (): void => {
    if (this.disposed || this.current === null) return;
    if (!this.readLatestSourceSnapshots()) return;
    const previous = this.current.snapshot;
    const next = this.evaluate().snapshot;
    if (next !== previous) notifyListeners(this.listeners);
  };

  private readLatestSourceSnapshots(): boolean {
    const noteSnapshot = this.noteSource.getSnapshot();
    const icsSnapshot = this.icsSource.getSnapshot();
    const changed = noteSnapshot !== this.noteSnapshot || icsSnapshot !== this.icsSnapshot;
    this.noteSnapshot = noteSnapshot;
    this.icsSnapshot = icsSnapshot;
    return changed;
  }

  private evaluate(): EvaluatedQuery {
    const dependencies = collectDependencies(
      this.request,
      this.noteSnapshot,
      this.icsSnapshot,
    );
    if (
      this.current !== null &&
      equalDependencies(this.current.dependencies, dependencies)
    ) {
      return this.current;
    }

    const selected = selectQuery(
      this.request,
      this.noteSnapshot,
      this.icsSnapshot,
    );
    const snapshot = this.current === null
      ? selected
      : shareQuerySnapshot(
          this.current.snapshot,
          selected,
          this.current.dependencies,
          dependencies,
        );
    this.current = Object.freeze({ dependencies, snapshot });
    return this.current;
  }

  private assertActive(): void {
    if (this.disposed) throw new Error("CalendarQueryStore has been disposed");
  }
}

function selectQuery(
  request: CalendarQueryRequest,
  noteSnapshot: NoteIndexSnapshot,
  icsSnapshot: IcsEventIndexSnapshot,
): CalendarQuerySnapshot {
  switch (request.kind) {
    case "month":
      return Object.freeze({
        kind: "month",
        query: selectMonthCalendar(
          request.target,
          noteSnapshot,
          icsSnapshot,
          request.options,
        ),
      });
    case "week":
      return Object.freeze({
        kind: "week",
        query: selectWeekCalendar(
          request.selectedDate,
          noteSnapshot,
          icsSnapshot,
          request.options,
        ),
      });
    case "year": {
      const query = request.heatmap
        ? selectYearCalendarHeatmap(request.year, noteSnapshot, request.options)
        : selectYearCalendarOverview(request.year, noteSnapshot, request.options);
      return Object.freeze({ kind: "year", query });
    }
  }
}

function collectDependencies(
  request: CalendarQueryRequest,
  noteSnapshot: NoteIndexSnapshot,
  icsSnapshot: IcsEventIndexSnapshot,
): CalendarQueryDependencies {
  switch (request.kind) {
    case "month":
      return collectMonthDependencies(request, noteSnapshot, icsSnapshot);
    case "week":
      return collectWeekDependencies(request, noteSnapshot, icsSnapshot);
    case "year":
      return collectYearDependencies(request, noteSnapshot);
  }
}

function collectMonthDependencies(
  request: MonthCalendarQueryRequest,
  noteSnapshot: NoteIndexSnapshot,
  icsSnapshot: IcsEventIndexSnapshot,
): MonthDependencies {
  const { options, target } = request;
  const grid = buildMonthGrid(target.year, target.month, options.weekStartDay);
  const dates = grid.days.map((day) => day.date);
  const weekStarts = grid.weeks.map((week) => {
    const date = week.days[0]?.date;
    if (date === undefined) throw new Error("Month query dependency has an incomplete week");
    return date;
  });
  const visibleStart = dates[0];
  const visibleEnd = dates.at(-1);
  if (visibleStart === undefined || visibleEnd === undefined) {
    throw new Error("Month query dependency has an empty grid");
  }
  const showIntervals = options.heatmap === null &&
    options.rangeNotes.showInCalendar;
  const intervalItems = showIntervals
    ? getVisibleIntervalItems(
        noteSnapshot,
        options.rangeNotes,
        visibleStart,
        visibleEnd,
      )
    : EMPTY_INTERVAL_ITEMS;
  return Object.freeze({
    kind: "month",
    geometryKey: keyOf(target.year, target.month, options.weekStartDay),
    dayOptionsKey: calendarDayOptionsKey(options),
    weeklyOptionsKey: periodicOptionsKey(options, options.weekly),
    intervalOptionsKey: showIntervals
      ? intervalOptionsKey(options.rangeNotes, "month")
      : "hidden",
    days: Object.freeze(dates.map((date) => Object.freeze({
      noteEntry: getPeriodicEntry(
        noteSnapshot,
        date,
        "daily",
        options,
        options.daily,
      ),
      icsEvents: getIcsEvents(icsSnapshot, date),
    }))),
    weeklyEntries: Object.freeze(weekStarts.map((date) => getPeriodicEntry(
      noteSnapshot,
      date,
      "weekly",
      options,
      options.weekly,
    ))),
    intervalItems,
    intervalItemsByWeek: collectIntervalDependenciesByWeek(intervalItems, grid),
  });
}

function collectWeekDependencies(
  request: WeekCalendarQueryRequest,
  noteSnapshot: NoteIndexSnapshot,
  icsSnapshot: IcsEventIndexSnapshot,
): WeekDependencies {
  const { options } = request;
  const weekStart = getPeriodAnchor(
    request.selectedDate,
    "weekly",
    options.weekStartDay,
  );
  const dates = Array.from({ length: 7 }, (_, index) =>
    shiftPeriod(weekStart, "daily", index, options.weekStartDay));
  const weekEnd = dates.at(-1);
  if (weekEnd === undefined) throw new Error("Week query dependency has no end date");
  return Object.freeze({
    kind: "week",
    geometryKey: keyOf(formatLocalDateKey(weekStart), options.weekStartDay),
    dayOptionsKey: calendarDayOptionsKey({ ...options, heatmap: null }),
    weeklyOptionsKey: periodicOptionsKey(options, options.weekly),
    taskOptionsKey: formatLocalDateKey(options.today),
    intervalOptionsKey: intervalOptionsKey(options.rangeNotes, "week"),
    days: Object.freeze(dates.map((date) => Object.freeze({
      noteEntry: getPeriodicEntry(
        noteSnapshot,
        date,
        "daily",
        options,
        options.daily,
      ),
      icsEvents: getIcsEvents(icsSnapshot, date),
    }))),
    weeklyEntry: getPeriodicEntry(
      noteSnapshot,
      weekStart,
      "weekly",
      options,
      options.weekly,
    ),
    taskBuckets: Object.freeze(dates.map((date) =>
      noteSnapshot.taskDates.byDate[formatLocalDateKey(date)] ?? EMPTY_TASK_BUCKET)),
    intervalItems: getVisibleIntervalItems(
      noteSnapshot,
      options.rangeNotes,
      weekStart,
      weekEnd,
    ),
  });
}

function collectYearDependencies(
  request: YearCalendarQueryRequest,
  noteSnapshot: NoteIndexSnapshot,
): YearDependencies {
  const { options, year } = request;
  const quarters = Array.from({ length: 4 }, (_, quarterIndex) => {
    const firstMonth = quarterIndex * 3 + 1;
    const quarterDate = Object.freeze({ year, month: firstMonth, day: 1 });
    const months = Array.from({ length: 3 }, (_, monthIndex) => {
      const month = firstMonth + monthIndex;
      const monthDate = Object.freeze({ year, month, day: 1 });
      const dailyEntries = request.heatmap
        ? buildMonthGrid(year, month, options.weekStartDay).days.flatMap((day) =>
            day.inCurrentMonth
              ? [getPeriodicEntry(
                  noteSnapshot,
                  day.date,
                  "daily",
                  options,
                  options.daily,
                )]
              : [])
        : EMPTY_REFERENCES;
      return Object.freeze({
        summaryEntry: getPeriodicEntry(
          noteSnapshot,
          monthDate,
          "monthly",
          options,
          options.monthly,
        ),
        dailyEntries: dailyEntries === EMPTY_REFERENCES
          ? dailyEntries
          : Object.freeze(dailyEntries),
      });
    });
    return Object.freeze({
      summaryEntry: getPeriodicEntry(
        noteSnapshot,
        quarterDate,
        "quarterly",
        options,
        options.quarterly,
      ),
      months: Object.freeze(months),
    });
  });
  return Object.freeze({
    kind: "year",
    geometryKey: keyOf(year, options.weekStartDay, request.heatmap),
    monthlyOptionsKey: periodicOptionsKey(options, options.monthly),
    quarterlyOptionsKey: periodicOptionsKey(options, options.quarterly),
    heatmapOptionsKey: request.heatmap
      ? keyOf(
          periodicOptionsKey(options, options.daily),
          options.statisticDisplayDimension,
          options.statisticValueStep,
        )
      : "off",
    quarters: Object.freeze(quarters),
  });
}

function getPeriodicEntry(
  snapshot: NoteIndexSnapshot,
  date: LocalDate,
  noteType: PeriodicNoteType,
  context: Readonly<{ locale: string; weekStartDay: "monday" | "sunday" }>,
  rule: Readonly<{ enabled: boolean; pattern: string }>,
): NoteEntryReference {
  if (!rule.enabled || rule.pattern.trim().length === 0) return undefined;
  const path = formatPeriodicNotePath(date, { noteType, pattern: rule.pattern }, context);
  return path === null ? undefined : snapshot.notes[path];
}

function getIcsEvents(
  snapshot: IcsEventIndexSnapshot,
  date: LocalDate,
): readonly IcsEventOccurrence[] {
  if (!snapshot.enabled) return EMPTY_ICS_EVENTS;
  return snapshot.eventsByDate[formatLocalDateKey(date)] ?? EMPTY_ICS_EVENTS;
}

function getVisibleIntervalItems(
  snapshot: NoteIndexSnapshot,
  settings: Readonly<RangeNoteSettings>,
  visibleStart: LocalDate,
  visibleEnd: LocalDate,
): readonly IntervalNoteRef[] {
  if (!settings.showInCalendar) return EMPTY_INTERVAL_ITEMS;
  const folder = getIntervalNoteScanFolder(settings);
  if (folder === "") return EMPTY_INTERVAL_ITEMS;
  const startKey = formatLocalDateKey(visibleStart);
  const endKey = formatLocalDateKey(visibleEnd);
  const items: IntervalNoteRef[] = [];
  for (const item of snapshot.intervals.items) {
    if (item.start.dateKey > endKey) continue;
    if (item.end.dateKey < startKey) continue;
    if (folder !== null && !isPathInFolder(item.path, folder)) continue;
    items.push(item);
  }
  return items.length === 0 ? EMPTY_INTERVAL_ITEMS : Object.freeze(items);
}

function collectIntervalDependenciesByWeek(
  items: readonly IntervalNoteRef[],
  grid: ReturnType<typeof buildMonthGrid>,
): readonly (readonly IntervalNoteRef[])[] {
  return Object.freeze(grid.weeks.map((week) => {
    const weekEnd = week.days.at(-1)?.date;
    if (weekEnd === undefined) {
      throw new Error("Month query dependency has an incomplete week");
    }
    const weekEndKey = formatLocalDateKey(weekEnd);
    let lastRelevantIndex = -1;
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (item !== undefined && item.start.dateKey <= weekEndKey) {
        lastRelevantIndex = index;
      }
    }
    if (lastRelevantIndex < 0) return EMPTY_INTERVAL_ITEMS;

    // Lanes are assigned in the projection's epoch order. An item whose local
    // date is after this week can therefore precede, and change the lane of, a
    // visible item when timestamp offsets reverse local-date order. Track the
    // complete processed prefix rather than only items displayed in the week.
    return Object.freeze(items.slice(0, lastRelevantIndex + 1));
  }));
}

function isPathInFolder(path: string, folder: string): boolean {
  return path === folder || path.startsWith(`${folder}/`);
}

function calendarDayOptionsKey(options: MonthCalendarQueryOptions): string;
function calendarDayOptionsKey(options: WeekCalendarQueryOptions & {
  readonly heatmap: null;
}): string;
function calendarDayOptionsKey(
  options: MonthCalendarQueryOptions | (WeekCalendarQueryOptions & {
    readonly heatmap: null;
  }),
): string {
  return keyOf(
    periodicOptionsKey(options, options.daily),
    options.calendarOverlays,
    options.holidayRegions,
    "heatmap" in options ? options.heatmap : null,
  );
}

function periodicOptionsKey(
  context: Readonly<{ locale: string; weekStartDay: "monday" | "sunday" }>,
  rule: Readonly<{ enabled: boolean; pattern: string }>,
): string {
  return keyOf(context.locale, context.weekStartDay, rule.enabled, rule.pattern);
}

function intervalOptionsKey(
  settings: Readonly<RangeNoteSettings>,
  view: "month" | "week",
): string {
  if (view === "month") {
    return settings.showInCalendar
      ? keyOf("visible", getIntervalNoteScanFolder(settings), settings.monthViewLimit)
      : "hidden";
  }
  const creationConfigured = normalizeIntervalNoteFolder(settings.folder).length > 0;
  return settings.showInCalendar
    ? keyOf(
        "visible",
        creationConfigured,
        getIntervalNoteScanFolder(settings),
        settings.weekViewLimit,
      )
    : keyOf("hidden", creationConfigured);
}

function keyOf(...parts: readonly unknown[]): string {
  return JSON.stringify(parts);
}

function equalDependencies(
  left: CalendarQueryDependencies,
  right: CalendarQueryDependencies,
): boolean {
  if (left.kind !== right.kind) return false;
  switch (left.kind) {
    case "month":
      return right.kind === "month" &&
        left.geometryKey === right.geometryKey &&
        left.dayOptionsKey === right.dayOptionsKey &&
        left.weeklyOptionsKey === right.weeklyOptionsKey &&
        left.intervalOptionsKey === right.intervalOptionsKey &&
        equalDayDependencies(left.days, right.days) &&
        equalReferences(left.weeklyEntries, right.weeklyEntries) &&
        equalReferences(left.intervalItems, right.intervalItems) &&
        equalNestedReferences(left.intervalItemsByWeek, right.intervalItemsByWeek);
    case "week":
      return right.kind === "week" &&
        left.geometryKey === right.geometryKey &&
        left.dayOptionsKey === right.dayOptionsKey &&
        left.weeklyOptionsKey === right.weeklyOptionsKey &&
        left.taskOptionsKey === right.taskOptionsKey &&
        left.intervalOptionsKey === right.intervalOptionsKey &&
        equalDayDependencies(left.days, right.days) &&
        left.weeklyEntry === right.weeklyEntry &&
        equalReferences(left.taskBuckets, right.taskBuckets) &&
        equalReferences(left.intervalItems, right.intervalItems);
    case "year":
      return right.kind === "year" && equalYearDependencies(left, right);
  }
}

function equalDayDependencies(
  left: readonly DayDependency[],
  right: readonly DayDependency[],
): boolean {
  return left.length === right.length && left.every((value, index) => {
    const candidate = right[index];
    return candidate !== undefined &&
      value.noteEntry === candidate.noteEntry &&
      value.icsEvents === candidate.icsEvents;
  });
}

function equalReferences<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length &&
    left.every((value, index) => value === right[index]);
}

function equalNestedReferences<T>(left: readonly (readonly T[])[], right: readonly (readonly T[])[]): boolean {
  return left.length === right.length &&
    left.every((value, index) => {
      const candidate = right[index];
      return candidate !== undefined && equalReferences(value, candidate);
    });
}

function equalYearDependencies(
  left: YearDependencies,
  right: YearDependencies,
): boolean {
  return left.geometryKey === right.geometryKey &&
    left.monthlyOptionsKey === right.monthlyOptionsKey &&
    left.quarterlyOptionsKey === right.quarterlyOptionsKey &&
    left.heatmapOptionsKey === right.heatmapOptionsKey &&
    left.quarters.length === right.quarters.length &&
    left.quarters.every((quarter, quarterIndex) => {
      const candidate = right.quarters[quarterIndex];
      return candidate !== undefined &&
        equalYearQuarterDependencies(quarter, candidate, left, right);
    });
}

function equalYearQuarterDependencies(
  left: YearQuarterDependencies,
  right: YearQuarterDependencies,
  leftRoot: YearDependencies,
  rightRoot: YearDependencies,
): boolean {
  return leftRoot.quarterlyOptionsKey === rightRoot.quarterlyOptionsKey &&
    left.summaryEntry === right.summaryEntry &&
    left.months.length === right.months.length &&
    left.months.every((month, monthIndex) => {
      const candidate = right.months[monthIndex];
      return candidate !== undefined &&
        equalYearMonthDependencies(month, candidate, leftRoot, rightRoot);
    });
}

function equalYearMonthDependencies(
  left: YearMonthDependencies,
  right: YearMonthDependencies,
  leftRoot: YearDependencies,
  rightRoot: YearDependencies,
): boolean {
  return leftRoot.monthlyOptionsKey === rightRoot.monthlyOptionsKey &&
    leftRoot.heatmapOptionsKey === rightRoot.heatmapOptionsKey &&
    left.summaryEntry === right.summaryEntry &&
    equalReferences(left.dailyEntries, right.dailyEntries);
}

function shareQuerySnapshot(
  previous: CalendarQuerySnapshot,
  next: CalendarQuerySnapshot,
  previousDependencies: CalendarQueryDependencies,
  nextDependencies: CalendarQueryDependencies,
): CalendarQuerySnapshot {
  if (
    previous.kind === "month" &&
    next.kind === "month" &&
    previousDependencies.kind === "month" &&
    nextDependencies.kind === "month"
  ) {
    return Object.freeze({
      kind: "month",
      query: shareMonthQuery(
        previous.query,
        next.query,
        previousDependencies,
        nextDependencies,
      ),
    });
  }
  if (
    previous.kind === "week" &&
    next.kind === "week" &&
    previousDependencies.kind === "week" &&
    nextDependencies.kind === "week"
  ) {
    return Object.freeze({
      kind: "week",
      query: shareWeekQuery(
        previous.query,
        next.query,
        previousDependencies,
        nextDependencies,
      ),
    });
  }
  if (
    previous.kind === "year" &&
    next.kind === "year" &&
    previousDependencies.kind === "year" &&
    nextDependencies.kind === "year"
  ) {
    return Object.freeze({
      kind: "year",
      query: shareYearQuery(
        previous.query,
        next.query,
        previousDependencies,
        nextDependencies,
      ),
    });
  }
  return next;
}

function shareMonthQuery(
  previous: MonthCalendarQuery,
  next: MonthCalendarQuery,
  previousDependencies: MonthDependencies,
  nextDependencies: MonthDependencies,
): MonthCalendarQuery {
  if (previousDependencies.geometryKey !== nextDependencies.geometryKey) return next;
  const canShareDays = previousDependencies.dayOptionsKey === nextDependencies.dayOptionsKey;
  const canShareWeekly =
    previousDependencies.weeklyOptionsKey === nextDependencies.weeklyOptionsKey;
  const canShareIntervalOptions =
    previousDependencies.intervalOptionsKey === nextDependencies.intervalOptionsKey;
  let dayOffset = 0;
  const weeks = next.weeks.map((week, weekIndex) => {
    const oldWeek = previous.weeks[weekIndex];
    if (oldWeek === undefined) {
      dayOffset += week.days.length;
      return week;
    }
    const days = week.days.map((day, dayIndex) => {
      const dependencyIndex = dayOffset + dayIndex;
      return canShareDays &&
        equalDayDependency(
          previousDependencies.days[dependencyIndex],
          nextDependencies.days[dependencyIndex],
        )
        ? oldWeek.days[dayIndex] ?? day
        : day;
    });
    dayOffset += week.days.length;
    const weeklyNote = canShareWeekly &&
      previousDependencies.weeklyEntries[weekIndex] ===
        nextDependencies.weeklyEntries[weekIndex]
      ? oldWeek.weeklyNote
      : week.weeklyNote;
    const intervals = canShareIntervalOptions &&
      equalReferences(
        previousDependencies.intervalItemsByWeek[weekIndex] ?? EMPTY_INTERVAL_ITEMS,
        nextDependencies.intervalItemsByWeek[weekIndex] ?? EMPTY_INTERVAL_ITEMS,
      )
      ? oldWeek.intervals
      : week.intervals;
    const frozenDays = allSameReferences(days, oldWeek.days)
      ? oldWeek.days
      : Object.freeze(days);
    if (
      frozenDays === oldWeek.days &&
      weeklyNote === oldWeek.weeklyNote &&
      intervals === oldWeek.intervals
    ) {
      return oldWeek;
    }
    return Object.freeze({ ...week, days: frozenDays, weeklyNote, intervals });
  });
  return Object.freeze({
    ...next,
    weeks: allSameReferences(weeks, previous.weeks)
      ? previous.weeks
      : Object.freeze(weeks),
  });
}

function shareWeekQuery(
  previous: WeekCalendarQuery,
  next: WeekCalendarQuery,
  previousDependencies: WeekDependencies,
  nextDependencies: WeekDependencies,
): WeekCalendarQuery {
  if (previousDependencies.geometryKey !== nextDependencies.geometryKey) return next;
  const canShareDays = previousDependencies.dayOptionsKey === nextDependencies.dayOptionsKey;
  const days = next.days.map((day, index) =>
    canShareDays && equalDayDependency(
      previousDependencies.days[index],
      nextDependencies.days[index],
    )
      ? previous.days[index] ?? day
      : day);
  const weeklyNote =
    previousDependencies.weeklyOptionsKey === nextDependencies.weeklyOptionsKey &&
    previousDependencies.weeklyEntry === nextDependencies.weeklyEntry
      ? previous.weeklyNote
      : next.weeklyNote;
  const tasks =
    previousDependencies.taskOptionsKey === nextDependencies.taskOptionsKey &&
    equalReferences(previousDependencies.taskBuckets, nextDependencies.taskBuckets)
      ? previous.tasks
      : next.tasks;
  const intervals =
    previousDependencies.intervalOptionsKey === nextDependencies.intervalOptionsKey &&
    equalReferences(previousDependencies.intervalItems, nextDependencies.intervalItems)
      ? previous.intervals
      : next.intervals;
  return Object.freeze({
    ...next,
    days: allSameReferences(days, previous.days)
      ? previous.days
      : Object.freeze(days),
    weeklyNote,
    tasks,
    intervals,
  });
}

function shareYearQuery(
  previous: YearCalendarQuery,
  next: YearCalendarQuery,
  previousDependencies: YearDependencies,
  nextDependencies: YearDependencies,
): YearCalendarQuery {
  if (previousDependencies.geometryKey !== nextDependencies.geometryKey) return next;
  const quarters = next.quarters.map((quarter, quarterIndex) => {
    const oldQuarter = previous.quarters[quarterIndex];
    const oldDependency = previousDependencies.quarters[quarterIndex];
    const dependency = nextDependencies.quarters[quarterIndex];
    if (oldQuarter === undefined || oldDependency === undefined || dependency === undefined) {
      return quarter;
    }
    const months = quarter.months.map((month, monthIndex) => {
      const oldMonth = oldQuarter.months[monthIndex];
      const oldMonthDependency = oldDependency.months[monthIndex];
      const monthDependency = dependency.months[monthIndex];
      if (
        oldMonth === undefined ||
        oldMonthDependency === undefined ||
        monthDependency === undefined
      ) {
        return month;
      }
      if (equalYearMonthDependencies(
        oldMonthDependency,
        monthDependency,
        previousDependencies,
        nextDependencies,
      )) {
        return oldMonth;
      }
      const summary =
        previousDependencies.monthlyOptionsKey === nextDependencies.monthlyOptionsKey &&
        oldMonthDependency.summaryEntry === monthDependency.summaryEntry
          ? oldMonth.summary
          : month.summary;
      return summary === month.summary
        ? month
        : Object.freeze({ ...month, summary });
    });
    const summary =
      previousDependencies.quarterlyOptionsKey === nextDependencies.quarterlyOptionsKey &&
      oldDependency.summaryEntry === dependency.summaryEntry
        ? oldQuarter.summary
        : quarter.summary;
    const frozenMonths = allSameReferences(months, oldQuarter.months)
      ? oldQuarter.months
      : Object.freeze(months);
    if (summary === oldQuarter.summary && frozenMonths === oldQuarter.months) {
      return oldQuarter;
    }
    return Object.freeze({ ...quarter, summary, months: frozenMonths });
  });
  return Object.freeze({
    ...next,
    quarters: allSameReferences(quarters, previous.quarters)
      ? previous.quarters
      : Object.freeze(quarters),
  });
}

function equalDayDependency(
  left: DayDependency | undefined,
  right: DayDependency | undefined,
): boolean {
  return left !== undefined && right !== undefined &&
    left.noteEntry === right.noteEntry &&
    left.icsEvents === right.icsEvents;
}

function allSameReferences<T>(next: readonly T[], previous: readonly T[]): boolean {
  return next.length === previous.length &&
    next.every((value, index) => value === previous[index]);
}
