import { performance } from "node:perf_hooks";

import { describe, expect, it } from "vitest";

import type { IcsEventOccurrence } from "../src/core/calendar/ics-calendar";
import type {
  NoteSource,
  NoteSourceEvent,
  NoteSourceListener,
} from "../src/core/note/note-source";
import { parseNote } from "../src/core/note/parsed-note";
import { CalendarDecorationCache } from "../src/features/calendar/calendar-decoration-cache";
import {
  CalendarQueryStore,
  type MonthCalendarQueryRequest,
} from "../src/features/calendar/calendar-query-store";
import type { IcsEventIndexSnapshot } from "../src/features/calendar/ics-event-index";
import { selectMonthCalendar } from "../src/features/calendar/month-calendar-query";
import { selectWeekCalendar } from "../src/features/calendar/week-calendar-query";
import {
  selectYearCalendarHeatmap,
  selectYearCalendarOverview,
} from "../src/features/calendar/year-calendar-query";
import { selectIntervalNotes } from "../src/features/intervals/interval-note-query";
import {
  NoteIndex,
  type NoteIndexDiagnostics,
  type NoteIndexSnapshot,
  type NoteIndexTimingDiagnostics,
} from "../src/features/notes/note-index";
import type { RangeNoteSettings } from "../src/shared/settings";
import { createBenchmarkDataset } from "./benchmark-dataset";

declare const __CHRONO_BENCHMARK_NOTE_COUNT__: number;

const RANGE_SETTINGS: RangeNoteSettings = Object.freeze({
  showInCalendar: true,
  folder: "Ranges",
  scanScope: "entire-vault",
  customFolder: "",
  monthViewLimit: 3,
  weekViewLimit: 5,
});

const EMPTY_EVENTS_BY_DATE = Object.freeze({});
const DISABLED_ICS = createIcsSnapshot({
  version: 0,
  contentVersion: 0,
  state: "disabled",
  enabled: false,
  eventsByDate: EMPTY_EVENTS_BY_DATE,
});

describe(`performance baseline (${__CHRONO_BENCHMARK_NOTE_COUNT__} notes)`, () => {
  it("reports deterministic indexing, event batching, query, and heap measurements", async () => {
    const dataset = createBenchmarkDataset(__CHRONO_BENCHMARK_NOTE_COUNT__);
    const initialConcurrency = await measureInitialConcurrencyMatrix();
    const parsableContents = [...dataset.contents.entries()].filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    );
    const heapInitial = sampleHeapUsed();
    const parseTimings = measureChunks(
      parsableContents,
      20,
      ([path, content]) => parseNote(path, content),
    );

    const source = new BenchmarkNoteSource(dataset.contents);
    const timingDiagnostics = createTimingDiagnostics();
    const diagnostics = createDiagnostics(timingDiagnostics);
    const index = new NoteIndex(source, { diagnostics });
    let publishCount = 0;
    const unsubscribePublishCounter = index.subscribe(() => {
      publishCount += 1;
    });
    const indexMs = await measureAsync(() => index.start());
    const initialDiagnostics = snapshotDiagnosticCounters(diagnostics);
    const indexedEntries = Object.keys(index.getSnapshot().notes).length;
    const queryMeasurements = measureCalendarQueries(index.getSnapshot(), index);
    const eventMeasurements = await measureEventStorm(index, source, diagnostics);
    const icsMeasurements = measureIcsQueryTransitions(index);
    const stableDiagnostics = snapshotDiagnosticCounters(diagnostics);
    const heapAfterStable = sampleHeapUsed();

    unsubscribePublishCounter();
    index.stop();
    const stoppedDiagnostics = snapshotDiagnosticCounters(diagnostics);
    const heapAfterStop = sampleHeapUsed();

    const report = Object.freeze({
      noteCount: __CHRONO_BENCHMARK_NOTE_COUNT__,
      contentBytes: dataset.contentBytes,
      readErrors: dataset.errorCount,
      readCount: source.readCount,
      noteIndexNotificationsBeforeStop: publishCount,
      indexedEntries,
      diagnostics: Object.freeze({
        afterInitialIndex: initialDiagnostics,
        afterStableWorkload: stableDiagnostics,
        afterStop: stoppedDiagnostics,
      }),
      heap: Object.freeze({
        measurement: "process.memoryUsage().heapUsed (best-effort GC when exposed)",
        gcAvailable: canRequestGc(),
        initialBytes: heapInitial,
        afterStableBytes: heapAfterStable,
        afterStopBytes: heapAfterStop,
        stableDeltaBytes: heapAfterStable - heapInitial,
        stopDeltaBytes: heapAfterStop - heapAfterStable,
      }),
      milliseconds: Object.freeze({
        parseTotal: round(sum(parseTimings)),
        parseChunk: summarizeTimings(parseTimings),
        initialIndex: round(indexMs),
        noteIndexPhases: summarizeNoteIndexTimings(timingDiagnostics),
        initialConcurrency,
        ...queryMeasurements,
        eventBatch: eventMeasurements.batchTimings,
        eventComplexBatch: round(eventMeasurements.complexBatchMs),
        icsTransitions: icsMeasurements.transitionTimings,
      }),
      eventBatching: eventMeasurements.algorithm,
      icsQueryStore: icsMeasurements.algorithm,
    });

    console.info(`CHRONO_BENCHMARK ${JSON.stringify(report)}`);
    expect(source.initialPathCount).toBe(__CHRONO_BENCHMARK_NOTE_COUNT__);
    expect(initialDiagnostics.reads).toBe(__CHRONO_BENCHMARK_NOTE_COUNT__);
    expect(initialDiagnostics.publishes).toBe(1);
    expect(indexedEntries).toBe(__CHRONO_BENCHMARK_NOTE_COUNT__);
    expect(eventMeasurements.algorithm.maxReadsPerFinalPath).toBe(1);
    // An unknown path intentionally publishes one lightweight "indexing" transition
    // before the final materialized note snapshot. Event reduction must still keep
    // the whole create/modify storm within those two observable publications.
    expect(eventMeasurements.algorithm.maxPublishesPerCreateModifyBatch).toBeLessThanOrEqual(2);
    expect(eventMeasurements.algorithm.allBatchPathsParsed).toBe(true);
    expect(eventMeasurements.algorithm.batchNotificationsMatched).toBe(true);
    expect(eventMeasurements.algorithm.complexBatchReads).toBe(2);
    expect(eventMeasurements.algorithm.complexBatchPublishes).toBeLessThanOrEqual(3);
    expect(eventMeasurements.algorithm.complexReadShapeMatched).toBe(true);
    expect(eventMeasurements.algorithm.complexStateMatched).toBe(true);
    expect(eventMeasurements.algorithm.complexNotificationsMatched).toBe(true);
    expect(icsMeasurements.algorithm.metadataOnlyNotifications).toBe(0);
    expect(icsMeasurements.algorithm.contentChangeNotificationsPerSubscriber).toEqual([1, 1, 1]);
  });
});

interface InitialConcurrencyMeasurement {
  readonly concurrency: number;
  readonly notes: number;
  readonly reads: number;
  readonly publishes: number;
  readonly peakActiveReads: number;
  readonly logicalCompletionTicks: number;
  readonly peakInFlightContentBytes: number;
  readonly semanticSummary: ReturnType<typeof summarizeIndexSnapshot>;
  readonly startupMs: number;
  readonly stableHeapDeltaBytes: number;
}

async function measureInitialConcurrencyMatrix(): Promise<
  readonly InitialConcurrencyMeasurement[]
> {
  const noteCount = Math.min(__CHRONO_BENCHMARK_NOTE_COUNT__, 1_024);
  const dataset = createBenchmarkDataset(noteCount);
  const results: InitialConcurrencyMeasurement[] = [];
  let expectedSemantics: ReturnType<typeof describeIndexSemantics> | null = null;

  for (const concurrency of [8, 16, 32] as const) {
    const source = new ConcurrentBenchmarkNoteSource(dataset.contents);
    const diagnostics = createDiagnostics();
    const index = new NoteIndex(source, {
      diagnostics,
      readConcurrency: concurrency,
    });
    const heapBefore = sampleHeapUsed();
    const startupMs = await measureAsync(() => index.start());
    const heapAfter = sampleHeapUsed();
    const snapshot = index.getSnapshot();
    const semantics = describeIndexSemantics(snapshot);
    expectedSemantics ??= semantics;

    expect(semantics).toEqual(expectedSemantics);
    expect(source.readCount).toBe(noteCount);
    expect(source.peakActiveReads).toBe(Math.min(concurrency, noteCount));
    expect(source.logicalCompletionTicks).toBe(Math.ceil(noteCount / concurrency));
    expect(diagnostics.publishes).toBe(1);
    results.push(Object.freeze({
      concurrency,
      notes: noteCount,
      reads: source.readCount,
      publishes: diagnostics.publishes,
      peakActiveReads: source.peakActiveReads,
      logicalCompletionTicks: source.logicalCompletionTicks,
      peakInFlightContentBytes: source.peakInFlightContentBytes,
      semanticSummary: summarizeIndexSnapshot(snapshot),
      startupMs: round(startupMs),
      stableHeapDeltaBytes: heapAfter - heapBefore,
    }));
    index.stop();
    expect(source.activeReadCount).toBe(0);
    expect(source.pendingReadCount).toBe(0);
  }

  for (let index = 1; index < results.length; index += 1) {
    expect(results[index]?.logicalCompletionTicks).toBeLessThanOrEqual(
      results[index - 1]?.logicalCompletionTicks ?? Number.POSITIVE_INFINITY,
    );
  }

  return Object.freeze(results);
}

function describeIndexSemantics(snapshot: NoteIndexSnapshot): Readonly<{
  notes: readonly Readonly<{
    path: string;
    entry: NoteIndexSnapshot["notes"][string];
  }>[];
  taskDates: readonly Readonly<{
    dateKey: string;
    items: NonNullable<NoteIndexSnapshot["taskDates"]["byDate"][string]>;
  }>[];
  intervals: NoteIndexSnapshot["intervals"]["items"];
}> {
  return Object.freeze({
    notes: Object.freeze(Object.keys(snapshot.notes).sort().flatMap((path) => {
      const entry = snapshot.notes[path];
      return entry === undefined ? [] : [Object.freeze({ path, entry })];
    })),
    taskDates: Object.freeze(Object.keys(snapshot.taskDates.byDate).sort().flatMap(
      (dateKey) => {
        const items = snapshot.taskDates.byDate[dateKey];
        return items === undefined ? [] : [Object.freeze({ dateKey, items })];
      },
    )),
    intervals: snapshot.intervals.items,
  });
}

function summarizeIndexSnapshot(snapshot: NoteIndexSnapshot): Readonly<{
  notes: number;
  errors: number;
  taskDateBuckets: number;
  taskDateRefs: number;
  intervals: number;
}> {
  const entries = Object.values(snapshot.notes);
  const taskBuckets = Object.values(snapshot.taskDates.byDate);
  return Object.freeze({
    notes: entries.length,
    errors: entries.filter((entry) => entry.kind === "error").length,
    taskDateBuckets: taskBuckets.length,
    taskDateRefs: taskBuckets.reduce((count, tasks) => count + tasks.length, 0),
    intervals: snapshot.intervals.items.length,
  });
}

function measureCalendarQueries(
  snapshot: NoteIndexSnapshot,
  index: NoteIndex,
): Readonly<Record<string, number | TimingSummary>> {
  const decorationCache = new CalendarDecorationCache();
  const week = () => selectWeekCalendar(
    { year: 2026, month: 7, day: 20 },
    snapshot,
    DISABLED_ICS,
    {
      locale: "zh-CN",
      weekStartDay: "monday",
      today: { year: 2026, month: 7, day: 20 },
      calendarOverlays: [],
      holidayRegions: [],
      daily: { enabled: true, pattern: "'Daily'/yyyy-MM-dd" },
      weekly: { enabled: true, pattern: "'Weekly'/kkkk-WW" },
      rangeNotes: RANGE_SETTINGS,
      decorationCache,
    },
  );
  const crossYearWeek = () => selectWeekCalendar(
    { year: 2025, month: 12, day: 31 },
    snapshot,
    DISABLED_ICS,
    {
      locale: "zh-CN",
      weekStartDay: "monday",
      today: { year: 2026, month: 1, day: 1 },
      calendarOverlays: [],
      holidayRegions: [],
      daily: { enabled: true, pattern: "'Daily'/yyyy-MM-dd" },
      weekly: { enabled: true, pattern: "'Weekly'/kkkk-WW" },
      rangeNotes: RANGE_SETTINGS,
      decorationCache,
    },
  );
  const month = () => selectMonthCalendar(
    { year: 2026, month: 7 },
    snapshot,
    DISABLED_ICS,
    {
      locale: "zh-CN",
      weekStartDay: "monday",
      calendarOverlays: [],
      holidayRegions: [],
      heatmap: null,
      daily: { enabled: true, pattern: "'Daily'/yyyy-MM-dd" },
      weekly: { enabled: true, pattern: "'Weekly'/kkkk-WW" },
      rangeNotes: RANGE_SETTINGS,
      decorationCache,
    },
  );
  const monthStoreRequest = createMonthStoreRequest();
  const queryStore = new CalendarQueryStore(
    index,
    new StaticSnapshotSource(DISABLED_ICS),
    monthStoreRequest,
  );
  queryStore.getSnapshot();
  const monthStoreWarm = () => queryStore.getSnapshot();
  const decoratedCache = new CalendarDecorationCache();
  const decoratedMonth = () => selectMonthCalendar(
    { year: 2026, month: 7 },
    snapshot,
    DISABLED_ICS,
    {
      locale: "zh-CN",
      weekStartDay: "monday" as const,
      calendarOverlays: ["chinese-lunar", "ganzhi"] as const,
      holidayRegions: ["cn", "sg"] as const,
      heatmap: null,
      daily: { enabled: true, pattern: "'Daily'/yyyy-MM-dd" },
      weekly: { enabled: true, pattern: "'Weekly'/kkkk-WW" },
      rangeNotes: RANGE_SETTINGS,
      decorationCache: decoratedCache,
    },
  );
  const decoratedMonthColdMs = measure(decoratedMonth);
  const interval = () => selectIntervalNotes(snapshot, RANGE_SETTINGS);
  const yearOverview = () => selectYearCalendarOverview(
    2026,
    snapshot,
    {
      locale: "zh-CN",
      weekStartDay: "monday",
      monthly: { enabled: true, pattern: "'Monthly'/yyyy-MM" },
      quarterly: { enabled: true, pattern: "'Quarterly'/yyyy-'Q'q" },
    },
  );
  const yearHeatmap = () => selectYearCalendarHeatmap(
    2026,
    snapshot,
    {
      locale: "zh-CN",
      weekStartDay: "monday",
      statisticDisplayDimension: "word-count",
      statisticValueStep: 250,
      daily: { enabled: true, pattern: "'Daily'/yyyy-MM-dd" },
      monthly: { enabled: true, pattern: "'Monthly'/yyyy-MM" },
      quarterly: { enabled: true, pattern: "'Quarterly'/yyyy-'Q'q" },
    },
  );

  const measurements = Object.freeze({
    weekQuery: measureOperation(week),
    crossYearWeekQuery: measureOperation(crossYearWeek),
    monthQuery: measureOperation(month),
    monthStoreWarm: measureOperation(monthStoreWarm),
    decoratedMonthCold: round(decoratedMonthColdMs),
    decoratedMonthWarm: measureOperation(decoratedMonth),
    intervalQuery: measureOperation(interval),
    yearOverview: measureOperation(yearOverview),
    yearHeatmap: measureOperation(yearHeatmap),
  });
  queryStore.dispose();
  return measurements;
}

async function measureEventStorm(
  index: NoteIndex,
  source: BenchmarkNoteSource,
  diagnostics: NoteIndexDiagnostics,
): Promise<Readonly<{
  batchTimings: TimingSummary;
  complexBatchMs: number;
  algorithm: Readonly<{
    batchCount: number;
    pathsPerBatch: number;
    emittedEvents: number;
    maxReadsPerFinalPath: number;
    maxPublishesPerCreateModifyBatch: number;
    complexBatchReads: number;
    complexBatchPublishes: number;
    allBatchPathsParsed: boolean;
    batchNotificationsMatched: boolean;
    complexReadShapeMatched: boolean;
    complexStateMatched: boolean;
    complexNotificationsMatched: boolean;
    notificationsPerSubscriber: readonly number[];
    chainFinalPath: string;
    deleteRecreateFinalPath: string;
  }>;
}>> {
  const batchCount = __CHRONO_BENCHMARK_NOTE_COUNT__ >= 10_000 ? 7 : 5;
  const pathsPerBatch = __CHRONO_BENCHMARK_NOTE_COUNT__ >= 10_000 ? 32 : 12;
  const subscriberNotifications = [0, 0, 0];
  const unsubscribers = subscriberNotifications.map((_, indexPosition) =>
    index.subscribe(() => {
      subscriberNotifications[indexPosition] =
        (subscriberNotifications[indexPosition] ?? 0) + 1;
    }));
  const batchTimings: number[] = [];
  let maxReadsPerFinalPath = 0;
  let maxPublishesPerCreateModifyBatch = 0;
  let allBatchPathsParsed = true;
  let batchNotificationsMatched = true;
  let emittedEvents = 0;

  for (let batch = 0; batch < batchCount; batch += 1) {
    const paths = Array.from(
      { length: pathsPerBatch },
      (_, pathIndex) => `BenchStorm/batch-${batch}-${pathIndex}.md`,
    );
    for (const [pathIndex, path] of paths.entries()) {
      source.setContent(path, benchmarkLiveContent(batch, pathIndex));
    }
    const publishesBefore = diagnostics.publishes;
    const notificationsBefore = [...subscriberNotifications];
    const pathReadsBefore = new Map(paths.map((path) => [path, source.readCountFor(path)]));
    const started = performance.now();
    for (const path of paths) {
      source.emit({ type: "create", path });
      source.emit({ type: "modify", path });
      source.emit({ type: "modify", path });
      source.emit({ type: "modify", path });
      emittedEvents += 4;
    }
    await Promise.all(paths.map((path) => index.refresh(path)));
    batchTimings.push(performance.now() - started);

    const publishDelta = diagnostics.publishes - publishesBefore;
    maxPublishesPerCreateModifyBatch = Math.max(
      maxPublishesPerCreateModifyBatch,
      publishDelta,
    );
    for (const path of paths) {
      const readDelta = source.readCountFor(path) - (pathReadsBefore.get(path) ?? 0);
      maxReadsPerFinalPath = Math.max(maxReadsPerFinalPath, readDelta);
      allBatchPathsParsed &&= index.get(path).kind === "parsed";
    }
    batchNotificationsMatched &&= subscriberNotifications.every(
      (count, position) => count - (notificationsBefore[position] ?? 0) === publishDelta,
    );
  }

  const chainStart = "BenchStorm/batch-0-0.md";
  const chainMiddle = "BenchStorm/chain-B.md";
  const chainFinal = "BenchStorm/chain-C.md";
  const deleteRecreate = "BenchStorm/batch-0-1.md";
  const transientStart = "BenchStorm/transient-A.md";
  const transientFinal = "BenchStorm/transient-B.md";
  const chainContent = source.getContent(chainStart);
  source.deleteContent(chainStart);
  source.setContent(chainFinal, chainContent);
  source.setContent(deleteRecreate, `${source.getContent(deleteRecreate)}\nrecreated`);
  source.deleteContent(transientStart);
  source.deleteContent(transientFinal);
  const complexReadsBefore = diagnostics.reads;
  const complexPublishesBefore = diagnostics.publishes;
  const complexNotificationsBefore = [...subscriberNotifications];
  const chainReadsBefore = source.readCountFor(chainFinal);
  const recreateReadsBefore = source.readCountFor(deleteRecreate);
  const transientReadsBefore = source.readCountFor(transientFinal);
  const complexStarted = performance.now();
  source.emit({ type: "rename", oldPath: chainStart, path: chainMiddle });
  source.emit({ type: "rename", oldPath: chainMiddle, path: chainFinal });
  source.emit({ type: "delete", path: deleteRecreate });
  source.emit({ type: "create", path: deleteRecreate });
  source.emit({ type: "create", path: transientStart });
  source.emit({ type: "modify", path: transientStart });
  source.emit({ type: "rename", oldPath: transientStart, path: transientFinal });
  source.emit({ type: "delete", path: transientFinal });
  emittedEvents += 8;
  await Promise.all([
    index.refresh(chainFinal),
    index.refresh(deleteRecreate),
  ]);
  const complexBatchMs = performance.now() - complexStarted;
  const complexBatchReads = diagnostics.reads - complexReadsBefore;
  const complexBatchPublishes = diagnostics.publishes - complexPublishesBefore;

  const complexReadShapeMatched =
    source.readCountFor(chainFinal) - chainReadsBefore === 1 &&
    source.readCountFor(deleteRecreate) - recreateReadsBefore === 1 &&
    source.readCountFor(transientFinal) - transientReadsBefore === 0;
  const complexStateMatched =
    index.get(chainStart).kind === "missing" &&
    index.get(chainMiddle).kind === "missing" &&
    index.get(chainFinal).kind === "parsed" &&
    index.get(deleteRecreate).kind === "parsed" &&
    index.get(transientStart).kind === "missing" &&
    index.get(transientFinal).kind === "missing";
  const complexNotificationsMatched = subscriberNotifications.every(
    (count, position) =>
      count - (complexNotificationsBefore[position] ?? 0) === complexBatchPublishes,
  );
  for (const unsubscribe of unsubscribers) unsubscribe();

  return Object.freeze({
    batchTimings: summarizeTimings(batchTimings),
    complexBatchMs,
    algorithm: Object.freeze({
      batchCount,
      pathsPerBatch,
      emittedEvents,
      maxReadsPerFinalPath,
      maxPublishesPerCreateModifyBatch,
      complexBatchReads,
      complexBatchPublishes,
      allBatchPathsParsed,
      batchNotificationsMatched,
      complexReadShapeMatched,
      complexStateMatched,
      complexNotificationsMatched,
      notificationsPerSubscriber: Object.freeze([...subscriberNotifications]),
      chainFinalPath: chainFinal,
      deleteRecreateFinalPath: deleteRecreate,
    }),
  });
}

function measureIcsQueryTransitions(index: NoteIndex): Readonly<{
  transitionTimings: TimingSummary;
  algorithm: Readonly<{
    sourceSubscriptions: number;
    metadataOnlyNotifications: number;
    contentChangeNotificationsPerSubscriber: readonly number[];
    disableNotificationsPerSubscriber: readonly number[];
  }>;
}> {
  const icsSource = new MutableSnapshotSource(DISABLED_ICS);
  const store = new CalendarQueryStore(index, icsSource, createMonthStoreRequest());
  const disabledQuery = store.getSnapshot();
  const notifications = [0, 0, 0];
  const unsubscribers = notifications.map((_, indexPosition) =>
    store.subscribe(() => {
      notifications[indexPosition] = (notifications[indexPosition] ?? 0) + 1;
    }));
  expect(icsSource.listenerCount).toBe(1);
  const transitionTimings: number[] = [];

  transitionTimings.push(measure(() => {
    icsSource.publish(createIcsSnapshot({
      version: 1,
      contentVersion: 0,
      state: "refreshing",
      enabled: true,
      eventsByDate: EMPTY_EVENTS_BY_DATE,
    }));
  }));
  transitionTimings.push(measure(() => {
    icsSource.publish(createIcsSnapshot({
      version: 2,
      contentVersion: 0,
      state: "ready",
      enabled: true,
      eventsByDate: EMPTY_EVENTS_BY_DATE,
    }));
  }));
  expect(store.getSnapshot()).toBe(disabledQuery);
  const metadataOnlyNotifications = sum(notifications);
  expect(metadataOnlyNotifications).toBe(0);

  const visibleBucket = Object.freeze([createBenchmarkIcsEvent("visible")]);
  const visibleEvents = Object.freeze({ "2026-07-20": visibleBucket });
  transitionTimings.push(measure(() => {
    icsSource.publish(createIcsSnapshot({
      version: 3,
      contentVersion: 1,
      state: "ready",
      enabled: true,
      eventsByDate: visibleEvents,
    }));
  }));
  const visibleQuery = store.getSnapshot();
  expect(visibleQuery).not.toBe(disabledQuery);
  const contentChangeNotificationsPerSubscriber = Object.freeze([...notifications]);
  expect(contentChangeNotificationsPerSubscriber).toEqual([1, 1, 1]);

  transitionTimings.push(measure(() => {
    icsSource.publish(createIcsSnapshot({
      version: 4,
      contentVersion: 1,
      state: "refreshing",
      enabled: true,
      eventsByDate: visibleEvents,
    }));
  }));
  transitionTimings.push(measure(() => {
    icsSource.publish(createIcsSnapshot({
      version: 5,
      contentVersion: 1,
      state: "ready",
      enabled: true,
      eventsByDate: visibleEvents,
    }));
  }));
  expect(store.getSnapshot()).toBe(visibleQuery);
  expect(notifications).toEqual([1, 1, 1]);

  transitionTimings.push(measure(() => {
    icsSource.publish(createIcsSnapshot({
      version: 6,
      contentVersion: 2,
      state: "disabled",
      enabled: false,
      eventsByDate: EMPTY_EVENTS_BY_DATE,
    }));
  }));
  const disableNotificationsPerSubscriber = Object.freeze(notifications.map((count) =>
    count - 1));
  expect(disableNotificationsPerSubscriber).toEqual([1, 1, 1]);
  const disabledAgainQuery = store.getSnapshot();
  expect(disabledAgainQuery).not.toBe(visibleQuery);
  expect(disabledAgainQuery.kind).toBe("month");
  if (disabledAgainQuery.kind !== "month") throw new Error("Expected month query");
  expect(disabledAgainQuery.query.icsSnapshotVersion).toBe(2);

  for (const unsubscribe of unsubscribers) unsubscribe();
  expect(icsSource.listenerCount).toBe(0);
  store.dispose();

  return Object.freeze({
    transitionTimings: summarizeTimings(transitionTimings),
    algorithm: Object.freeze({
      sourceSubscriptions: 1,
      metadataOnlyNotifications,
      contentChangeNotificationsPerSubscriber,
      disableNotificationsPerSubscriber,
    }),
  });
}

class BenchmarkNoteSource implements NoteSource {
  readCount = 0;
  readonly initialPathCount: number;
  private readonly contents: Map<string, string | Error>;
  private readonly pathReadCounts = new Map<string, number>();
  private readonly listeners = new Set<NoteSourceListener>();

  constructor(contents: ReadonlyMap<string, string | Error>) {
    this.contents = new Map(contents);
    this.initialPathCount = contents.size;
  }

  listPaths(): readonly string[] {
    return [...this.contents.keys()];
  }

  async read(path: string): Promise<string> {
    this.readCount += 1;
    this.pathReadCounts.set(path, this.readCountFor(path) + 1);
    const value = this.contents.get(path);
    if (value instanceof Error) throw value;
    if (value === undefined) throw new Error(`Missing benchmark note: ${path}`);
    return value;
  }

  subscribe(listener: NoteSourceListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: NoteSourceEvent): void {
    for (const listener of [...this.listeners]) listener(event);
  }

  getContent(path: string): string {
    const value = this.contents.get(path);
    if (typeof value !== "string") throw new Error(`Expected benchmark content: ${path}`);
    return value;
  }

  setContent(path: string, content: string): void {
    this.contents.set(path, content);
  }

  deleteContent(path: string): void {
    this.contents.delete(path);
  }

  readCountFor(path: string): number {
    return this.pathReadCounts.get(path) ?? 0;
  }
}

class ConcurrentBenchmarkNoteSource implements NoteSource {
  readCount = 0;
  peakActiveReads = 0;
  logicalCompletionTicks = 0;
  peakInFlightContentBytes = 0;
  private activeReads = 0;
  private activeContentBytes = 0;
  private readonly contentBytesByPath: ReadonlyMap<string, number>;
  private readonly pendingReadResolutions: Array<() => void> = [];
  private releaseScheduled = false;

  constructor(private readonly contents: ReadonlyMap<string, string | Error>) {
    this.contentBytesByPath = new Map([...contents].map(([path, value]) => [
      path,
      typeof value === "string" ? new TextEncoder().encode(value).byteLength : 0,
    ]));
  }

  get activeReadCount(): number {
    return this.activeReads;
  }

  get pendingReadCount(): number {
    return this.pendingReadResolutions.length;
  }

  listPaths(): readonly string[] {
    return [...this.contents.keys()];
  }

  async read(path: string): Promise<string> {
    this.readCount += 1;
    this.activeReads += 1;
    const contentBytes = this.contentBytesByPath.get(path) ?? 0;
    this.activeContentBytes += contentBytes;
    this.peakActiveReads = Math.max(this.peakActiveReads, this.activeReads);
    this.peakInFlightContentBytes = Math.max(
      this.peakInFlightContentBytes,
      this.activeContentBytes,
    );
    try {
      await new Promise<void>((resolve) => {
        this.pendingReadResolutions.push(resolve);
        this.scheduleRelease();
      });
      const value = this.contents.get(path);
      if (value instanceof Error) throw value;
      if (value === undefined) throw new Error(`Missing benchmark note: ${path}`);
      return value;
    } finally {
      this.activeReads -= 1;
      this.activeContentBytes -= contentBytes;
    }
  }

  subscribe(): () => void {
    return () => undefined;
  }

  private scheduleRelease(): void {
    if (this.releaseScheduled) return;
    this.releaseScheduled = true;
    setImmediate(() => {
      this.releaseScheduled = false;
      this.logicalCompletionTicks += 1;
      const resolutions = this.pendingReadResolutions.splice(0);
      for (const resolve of resolutions) resolve();
    });
  }
}

class StaticSnapshotSource<T> {
  constructor(private readonly snapshot: T) {}

  getSnapshot = (): T => this.snapshot;

  subscribe = (): (() => void) => () => undefined;
}

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

interface TimingSummary {
  readonly samples: number;
  readonly p50: number;
  readonly p95: number;
  readonly max: number;
}

function createMonthStoreRequest(): MonthCalendarQueryRequest {
  return Object.freeze({
    kind: "month",
    target: Object.freeze({ year: 2026, month: 7 }),
    options: Object.freeze({
      locale: "zh-CN",
      weekStartDay: "monday" as const,
      calendarOverlays: Object.freeze([]),
      holidayRegions: Object.freeze([]),
      heatmap: null,
      daily: Object.freeze({ enabled: true, pattern: "'Daily'/yyyy-MM-dd" }),
      weekly: Object.freeze({ enabled: true, pattern: "'Weekly'/kkkk-WW" }),
      rangeNotes: RANGE_SETTINGS,
    }),
  });
}

function createIcsSnapshot(options: Readonly<{
  version: number;
  contentVersion: number;
  state: IcsEventIndexSnapshot["state"];
  enabled: boolean;
  eventsByDate: IcsEventIndexSnapshot["eventsByDate"];
}>): IcsEventIndexSnapshot {
  return Object.freeze({
    ...options,
    totalSources: options.enabled ? 1 : 0,
    loadedSources: options.state === "ready" ? 1 : 0,
    eventCount: Object.values(options.eventsByDate).reduce(
      (count, events) => count + events.length,
      0,
    ),
    skippedRecurring: 0,
    skippedInvalid: 0,
    truncatedEvents: 0,
    refreshedAt: null,
    sourceStatuses: Object.freeze([]),
    errors: Object.freeze([]),
  });
}

function createBenchmarkIcsEvent(id: string): IcsEventOccurrence {
  return Object.freeze({
    id,
    title: `Benchmark ${id}`,
    source: "benchmark.ics",
    sourceLabel: "benchmark.ics",
    isAllDay: true,
    startsOnDate: true,
    endsOnDate: true,
    continuesBefore: false,
    continuesAfter: false,
    timeLabel: null,
    sortTimestamp: 0,
  });
}

function benchmarkLiveContent(batch: number, pathIndex: number): string {
  return [
    "---",
    `batch: ${batch}`,
    `sequence: ${pathIndex}`,
    "---",
    `Benchmark live note ${batch}-${pathIndex}`,
    `- [ ] Batched task 📅 2026-07-${String((pathIndex % 28) + 1).padStart(2, "0")}`,
  ].join("\n");
}

function createDiagnostics(
  timings?: NoteIndexTimingDiagnostics,
): NoteIndexDiagnostics {
  const diagnostics: NoteIndexDiagnostics = {
    queuedEvents: 0,
    eventBatches: 0,
    reducedEventPaths: 0,
    reads: 0,
    documentParses: 0,
    parses: 0,
    materializations: 0,
    publishes: 0,
  };
  if (timings !== undefined) diagnostics.timings = timings;
  return diagnostics;
}

function createTimingDiagnostics(): NoteIndexTimingDiagnostics {
  return {
    listPathsMs: [],
    readsMs: [],
    documentParsesMs: [],
    noteParsesMs: [],
    initialIndexingMs: [],
    initialCommitsMs: [],
    liveCommitsMs: [],
    snapshotMaterializationsMs: [],
    listenerNotificationsMs: [],
  };
}

function snapshotDiagnosticCounters(
  diagnostics: NoteIndexDiagnostics,
): Readonly<Omit<NoteIndexDiagnostics, "timings">> {
  return Object.freeze({
    queuedEvents: diagnostics.queuedEvents,
    eventBatches: diagnostics.eventBatches,
    reducedEventPaths: diagnostics.reducedEventPaths,
    reads: diagnostics.reads,
    documentParses: diagnostics.documentParses,
    parses: diagnostics.parses,
    materializations: diagnostics.materializations,
    publishes: diagnostics.publishes,
  });
}

function summarizeNoteIndexTimings(
  timings: NoteIndexTimingDiagnostics,
): Readonly<Record<keyof NoteIndexTimingDiagnostics, TimingSummary>> {
  return Object.freeze({
    listPathsMs: summarizeTimings(timings.listPathsMs),
    readsMs: summarizeTimings(timings.readsMs),
    documentParsesMs: summarizeTimings(timings.documentParsesMs),
    noteParsesMs: summarizeTimings(timings.noteParsesMs),
    initialIndexingMs: summarizeTimings(timings.initialIndexingMs),
    initialCommitsMs: summarizeTimings(timings.initialCommitsMs),
    liveCommitsMs: summarizeTimings(timings.liveCommitsMs),
    snapshotMaterializationsMs: summarizeTimings(
      timings.snapshotMaterializationsMs,
    ),
    listenerNotificationsMs: summarizeTimings(timings.listenerNotificationsMs),
  });
}

function measure(operation: () => unknown): number {
  const start = performance.now();
  operation();
  return performance.now() - start;
}

async function measureAsync(operation: () => Promise<unknown>): Promise<number> {
  const start = performance.now();
  await operation();
  return performance.now() - start;
}

function measureOperation(operation: () => unknown, sampleCount = 11): TimingSummary {
  operation();
  return summarizeTimings(Array.from({ length: sampleCount }, () => measure(operation)));
}

function measureChunks<T>(
  items: readonly T[],
  targetChunkCount: number,
  operation: (item: T) => unknown,
): readonly number[] {
  const chunkSize = Math.max(1, Math.ceil(items.length / targetChunkCount));
  const timings: number[] = [];
  for (let start = 0; start < items.length; start += chunkSize) {
    const chunk = items.slice(start, start + chunkSize);
    timings.push(measure(() => {
      for (const item of chunk) operation(item);
    }));
  }
  return timings;
}

function summarizeTimings(samples: readonly number[]): TimingSummary {
  if (samples.length === 0) {
    return Object.freeze({ samples: 0, p50: 0, p95: 0, max: 0 });
  }
  const sorted = [...samples].sort((left, right) => left - right);
  return Object.freeze({
    samples: sorted.length,
    p50: round(percentile(sorted, 0.5)),
    p95: round(percentile(sorted, 0.95)),
    max: round(sorted.at(-1) ?? 0),
  });
}

function percentile(sorted: readonly number[], quantile: number): number {
  const position = Math.max(0, (sorted.length - 1) * quantile);
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lower = sorted[lowerIndex] ?? 0;
  const upper = sorted[upperIndex] ?? lower;
  return lower + (upper - lower) * (position - lowerIndex);
}

function sampleHeapUsed(): number {
  requestGcIfAvailable();
  return process.memoryUsage().heapUsed;
}

function canRequestGc(): boolean {
  return typeof (globalThis as { gc?: unknown }).gc === "function";
}

function requestGcIfAvailable(): void {
  const gc = (globalThis as { gc?: () => void }).gc;
  if (typeof gc === "function") gc();
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
