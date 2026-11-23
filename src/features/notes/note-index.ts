import { yieldToHost } from "../../shared/yield-to-host";
import {
  parseNoteDocument,
  type ParsedNoteDocument,
} from "../../core/document/parse-note-document";
import type {
  NoteSource,
  NoteSourceEvent,
  NoteSourceFile,
} from "../../core/note/note-source";
import {
  parseNoteFromDocument,
} from "../../core/note/parsed-note";
import { notifyListeners } from "../notify-listeners";
import {
  createIndexedNote,
  type IndexedNote,
} from "./indexed-note";
import {
  type NoteIndexCacheChanges,
  parsePersistedNoteIndexSnapshotIncrementally,
  type NoteIndexCache,
  type PersistedNoteIndexEntry,
  type PersistedNoteIndexSnapshot,
} from "./note-index-cache";
import { NoteIndexCacheWriter } from "./note-index-cache-writer";
import {
  EMPTY_INTERVAL_INDEX_SNAPSHOT,
  EMPTY_TASK_DATE_INDEX_SNAPSHOT,
  NoteIndexProjections,
  type IntervalIndexSnapshot,
  type TaskDateIndexSnapshot,
} from "./note-index-projections";

interface IndexedNoteIndexEntry {
  readonly kind: "parsed";
  readonly revision: number;
  readonly note: IndexedNote;
}

interface NoteReadFailure {
  readonly name: string;
  readonly message: string;
}

interface ErrorNoteIndexEntry {
  readonly kind: "error";
  readonly path: string;
  readonly revision: number;
  readonly error: NoteReadFailure;
}

interface MissingNoteIndexEntry {
  readonly kind: "missing";
  readonly path: string;
}

export type PresentNoteIndexEntry = IndexedNoteIndexEntry | ErrorNoteIndexEntry;
export type NoteIndexEntry = PresentNoteIndexEntry | MissingNoteIndexEntry;
export type NoteIndexReadiness = "indexing" | "ready";

export interface NoteIndexSnapshot {
  readonly version: number;
  readonly readiness: NoteIndexReadiness;
  readonly notes: Readonly<Record<string, PresentNoteIndexEntry>>;
  readonly taskDates: TaskDateIndexSnapshot;
  readonly intervals: IntervalIndexSnapshot;
}

export interface NoteIndexStatus {
  readonly active: boolean;
  readonly readiness: NoteIndexReadiness;
  readonly noteCount: number;
  readonly errorCount: number;
  readonly cacheConfigured: boolean;
}

export interface NoteIndexOperationDiagnostics {
  readonly completedAt: number;
  readonly durationMs: number;
  readonly affectedPathCount: number;
}

export interface NoteIndexDiagnosticsSnapshot {
  readonly pendingUpdateCount: number;
  readonly lastFullIndex: NoteIndexOperationDiagnostics | null;
  readonly lastIncrementalUpdate: NoteIndexOperationDiagnostics | null;
}

type NoteIndexListener = () => void;

interface InFlightRead {
  readonly publication: ReadPublication;
  readonly lifecycle: number;
  readonly revision: number;
  readonly promise: Promise<void>;
}

interface InitialStaging {
  files?: ReadonlyMap<string, NoteSourceFile>;
  readonly lifecycle: number;
  readonly entries: Map<string, PresentNoteIndexEntry>;
  readonly documentFingerprints: Map<string, bigint>;
}

interface InitialReadTask {
  readonly path: string;
  readonly revision: number;
}

interface QueuedRead {
  readonly path: string;
  readonly revision: number;
  readonly lifecycle: number;
  readonly run: () => Promise<ReadWorkResult>;
  readonly skip: () => void;
  readonly resolve: () => void;
  readonly reject: (error: unknown) => void;
  slotHeld: boolean;
}

export interface NoteIndexOptions {
  /** Maximum number of source reads shared by initial and live indexing. */
  readonly readConcurrency?: number;
  /** Main-thread budget before initial indexing yields to a new host task. */
  readonly initialIndexTimeSliceMs?: number;
  readonly initialIndexClock?: () => number;
  readonly yieldInitialIndex?: () => Promise<void>;
  readonly diagnostics?: NoteIndexDiagnostics;
  readonly diagnosticClock?: () => number;
  /** Monotonic clock for lightweight runtime operation durations. */
  readonly operationClock?: () => number;
  /** Wall clock for user-visible completion timestamps. */
  readonly wallClock?: () => number;
  /** Schedules the bounded checkpoint used to publish a partially settled live batch. */
  readonly scheduleLiveCommitCheckpoint?: (callback: () => void) => () => void;
  /** Schedules the quiet checkpoint before a live discovery wave becomes ready. */
  readonly scheduleReadinessCheckpoint?: (callback: () => void) => () => void;
  /** Optional device-local cache for derived index data. */
  readonly cache?: NoteIndexCache;
  /** Schedules a quiet, batched cache write after the index becomes idle. */
  readonly scheduleCacheSave?: (callback: () => void) => () => void;
}

/** Optional mutable counters for deterministic tests and local benchmarks. */
export interface NoteIndexDiagnostics {
  queuedEvents: number;
  eventBatches: number;
  reducedEventPaths: number;
  reads: number;
  documentParses: number;
  parses: number;
  materializations: number;
  publishes: number;
  timings?: NoteIndexTimingDiagnostics;
}

/** Timings are collected only when this optional sink is explicitly supplied. */
export interface NoteIndexTimingDiagnostics {
  listPathsMs: number[];
  readsMs: number[];
  documentParsesMs: number[];
  noteParsesMs: number[];
  initialIndexingMs: number[];
  initialCommitsMs: number[];
  liveCommitsMs: number[];
  snapshotMaterializationsMs: number[];
  listenerNotificationsMs: number[];
}

type NoteIndexDiagnosticCounter = Exclude<keyof NoteIndexDiagnostics, "timings">;

type ReadPublication =
  | { readonly kind: "initial"; readonly staging: InitialStaging }
  | {
    readonly kind: "live";
    readonly forceParse: boolean;
    readonly batch: LiveReadBatch;
  };

interface ReadWorkResult {
  readonly publication: Promise<void>;
}

type PendingEventIntent =
  | Readonly<{
    kind: "read";
    revision: number;
    forceParse: boolean;
  }>
  | Readonly<{
    kind: "missing";
    revision: number;
  }>;

interface ScheduledFlush {
  readonly lifecycle: number;
  publishedRemoval: boolean;
}

interface PendingLiveCommit {
  readonly path: string;
  readonly revision: number;
  readonly lifecycle: number;
  readonly entry: PresentNoteIndexEntry;
  readonly documentFingerprint: bigint | null;
  readonly resolve: () => void;
}

interface LiveReadBatch {
  files?: ReadonlyMap<string, NoteSourceFile>;
  readonly lifecycle: number;
  pendingReads: number;
  readonly commits: PendingLiveCommit[];
  cancelCheckpoint: (() => void) | null;
  checkpointReached: boolean;
  active: boolean;
  readonly startedAt: number;
  readonly affectedPathCount: number;
}

const INITIAL_SNAPSHOT: NoteIndexSnapshot = Object.freeze({
  version: 0,
  readiness: "indexing",
  notes: Object.freeze({}),
  taskDates: EMPTY_TASK_DATE_INDEX_SNAPSHOT,
  intervals: EMPTY_INTERVAL_INDEX_SNAPSHOT,
});

const DEFAULT_READ_CONCURRENCY = 16;
const DEFAULT_INITIAL_INDEX_TIME_SLICE_MS = 8;
const DEFAULT_CACHE_SAVE_DELAY_MS = 2_000;
const EMPTY_PATH_SET: ReadonlySet<string> = Object.freeze(new Set<string>());

/**
 * Single owner for all Vault-derived note query state.
 *
 * Every source event advances a per-path revision. A completed read may commit
 * only while that revision and the index lifecycle are still current. All reads
 * share one bounded scheduler. Initial reads share one publication boundary;
 * live events and completed reads use microtask batches while delete and rename
 * retain immediate removal barriers.
 */
export class NoteIndex {
  private readonly entries = new Map<string, PresentNoteIndexEntry>();
  private readonly documentFingerprints = new Map<string, bigint>();
  private readonly projections = new NoteIndexProjections();
  private readonly revisions = new Map<string, number>();
  private retiredRevision = 0;
  private errorCount = 0;
  private readonly pendingRemovals = new Map<string, null>();
  private removalNotificationPending = false;
  private readonly inFlight = new Map<string, InFlightRead>();
  private readonly readQueue: QueuedRead[] = [];
  private readonly runningReads = new Set<QueuedRead>();
  private readonly pendingEventIntents = new Map<string, PendingEventIntent>();
  private readonly liveReadBatches = new Set<LiveReadBatch>();
  private readonly listeners = new Set<NoteIndexListener>();
  private readonly diagnosticsListeners = new Set<NoteIndexListener>();
  private snapshot = INITIAL_SNAPSHOT;
  private unsubscribeSource: (() => void) | null = null;
  private initialIndexing: Promise<void> | null = null;
  private initialStaging: InitialStaging | null = null;
  private initialKnownPaths: Set<string> | null = null;
  private bufferedStartupEvents: NoteSourceEvent[] | null = null;
  private active = false;
  private lifecycle = 0;
  private activeReadCount = 0;
  private readonly readConcurrency: number;
  private readonly initialIndexTimeSliceMs: number;
  private readonly initialIndexClock: () => number;
  private readonly yieldInitialIndex: () => Promise<void>;
  private readonly diagnostics: NoteIndexDiagnostics | null;
  private readonly diagnosticClock: () => number;
  private readonly operationClock: () => number;
  private readonly wallClock: () => number;
  private readonly scheduleLiveCommitCheckpoint: (callback: () => void) => () => void;
  private readonly scheduleReadinessCheckpoint: (callback: () => void) => () => void;
  private readonly cache: NoteIndexCache | null;
  private readonly fileMetadata = new WeakMap<IndexedNote, NoteSourceFile | null>();
  private readonly cacheWriter: NoteIndexCacheWriter;
  private diagnosticsEnabled: boolean;
  private scheduledEventFlush: ScheduledFlush | null = null;
  private cancelReadinessCheckpoint: (() => void) | null = null;
  private lastFullIndex: NoteIndexOperationDiagnostics | null = null;
  private lastIncrementalUpdate: NoteIndexOperationDiagnostics | null = null;

  constructor(
    private readonly source: NoteSource,
    options: NoteIndexOptions = {},
  ) {
    const readConcurrency = options.readConcurrency ?? DEFAULT_READ_CONCURRENCY;
    if (!Number.isInteger(readConcurrency) || readConcurrency < 1) {
      throw new RangeError("NoteIndex read concurrency must be a positive integer");
    }
    const initialIndexTimeSliceMs = options.initialIndexTimeSliceMs
      ?? DEFAULT_INITIAL_INDEX_TIME_SLICE_MS;
    if (!Number.isFinite(initialIndexTimeSliceMs) || initialIndexTimeSliceMs <= 0) {
      throw new RangeError("NoteIndex initial time slice must be a positive number");
    }
    this.readConcurrency = readConcurrency;
    this.initialIndexTimeSliceMs = initialIndexTimeSliceMs;
    this.initialIndexClock = options.initialIndexClock ?? defaultDiagnosticClock;
    this.yieldInitialIndex = options.yieldInitialIndex ?? yieldToHost;
    this.diagnostics = options.diagnostics ?? null;
    this.diagnosticClock = options.diagnosticClock ?? defaultDiagnosticClock;
    this.operationClock = options.operationClock ?? defaultDiagnosticClock;
    this.wallClock = options.wallClock ?? Date.now;
    this.scheduleLiveCommitCheckpoint = options.scheduleLiveCommitCheckpoint
      ?? scheduleMacrotaskCheckpoint;
    this.scheduleReadinessCheckpoint = options.scheduleReadinessCheckpoint
      ?? scheduleMacrotaskCheckpoint;
    this.cache = options.cache ?? null;
    this.cacheWriter = new NoteIndexCacheWriter({
      cache: this.cache,
      schedule: options.scheduleCacheSave
        ?? ((callback) => scheduleTimeout(callback, DEFAULT_CACHE_SAVE_DELAY_MS)),
      canSchedule: () => this.active && this.source.listFiles !== undefined,
      canSave: () => this.active && this.snapshot.readiness === "ready" && this.isLiveWorkIdle(),
      collect: (paths) => this.collectCacheChanges(paths),
      onError: (error) => reportCacheFailure("save", error),
    });
    this.diagnosticsEnabled = this.diagnostics !== null;
  }

  async start(): Promise<void> {
    if (this.active) {
      if (this.initialIndexing !== null) {
        await this.initialIndexing;
        return;
      }
      this.flushEventIntentsNow();
      await Promise.all([...this.inFlight.values()].map(({ promise }) => promise));
      return;
    }

    const operationStartedAt = this.operationClock();
    this.active = true;
    const startLifecycle = ++this.lifecycle;
    const staging: InitialStaging = {
      lifecycle: startLifecycle,
      entries: new Map(),
      documentFingerprints: new Map(),
    };
    this.initialStaging = staging;
    const initializing = this.startInitialIndex(staging, operationStartedAt);
    if (this.isCurrentLifecycle(startLifecycle)) this.initialIndexing = initializing;
    try {
      await initializing;
    } finally {
      if (this.initialIndexing === initializing) this.initialIndexing = null;
    }
  }

  private async startInitialIndex(staging: InitialStaging, operationStartedAt: number): Promise<void> {
    const startLifecycle = staging.lifecycle;
    this.bufferedStartupEvents = [];
    try {
      this.unsubscribeSource = this.source.subscribe(
        (event) => this.handleSourceEvent(event),
      );
      const cachedSnapshot = this.source.listFiles === undefined
        ? null
        : await this.loadCacheSnapshot(startLifecycle);
      if (!this.isCurrentLifecycle(startLifecycle)) return;
      this.cacheWriter.reset(cachedSnapshot === null || this.cache?.needsFullSave === true);
      const listPathsStarted = this.startDiagnosticTiming();
      let initialPaths: string[];
      let listedFiles: readonly NoteSourceFile[] | null = null;
      try {
        listedFiles = this.source.listFiles?.() ?? null;
        initialPaths = [...new Set(
          listedFiles === null
            ? this.source.listPaths()
            : listedFiles.map((file) => file.path),
        )];
      } finally {
        this.finishDiagnosticTiming("listPathsMs", listPathsStarted);
      }
      if (this.cache !== null && listedFiles !== null) {
        staging.files = new Map(listedFiles.map((file) => [file.path, file]));
      }
      const bufferedEvents = this.bufferedStartupEvents;
      this.bufferedStartupEvents = null;
      const knownPaths = reconcileStartupPaths(initialPaths, bufferedEvents ?? []);
      this.initialKnownPaths = knownPaths;
      const cachedPaths = cachedSnapshot === null || staging.files === undefined
        ? EMPTY_PATH_SET
        : this.restoreCachedEntries(
          cachedSnapshot.entries,
          staging.files,
          knownPaths,
          bufferedEvents ?? [],
          staging,
        );
      if (cachedPaths.size > 0) this.commitInitialStaging(staging, "indexing");
      await this.completeInitialIndexing(
        [...knownPaths].filter((path) => !cachedPaths.has(path)),
        staging,
      );
      if (this.active && this.lifecycle === startLifecycle) {
        this.lastFullIndex = this.completeOperation(
          operationStartedAt,
          knownPaths.size,
        );
      }
      this.publishReadyAfterInitialIndexing(startLifecycle, staging);
      this.notifyDiagnosticsListeners();
      if (this.initialStaging === staging) {
        this.initialStaging = null;
        this.initialKnownPaths = null;
      }
    } catch (error) {
      this.rollbackFailedStart(startLifecycle);
      throw error;
    }
  }

  stop(): void {
    if (!this.active) return;

    this.active = false;
    this.lifecycle += 1;
    this.unsubscribeSource?.();
    this.unsubscribeSource = null;
    this.pendingEventIntents.clear();
    this.scheduledEventFlush = null;
    this.cancelReadinessCheckpoint?.();
    this.cancelReadinessCheckpoint = null;
    this.cacheWriter.reset(false);
    this.cancelLiveReadBatches();
    this.cancelQueuedReads();
    this.releaseRunningReadSlots();
    this.inFlight.clear();
    this.initialStaging?.entries.clear();
    this.initialStaging?.documentFingerprints.clear();
    this.initialStaging = null;
    this.initialIndexing = null;
    this.initialKnownPaths = null;
    this.bufferedStartupEvents = null;
    this.revisions.clear();
    this.retiredRevision = 0;
    this.pendingRemovals.clear();
    this.removalNotificationPending = false;
    const hadPublishedEntries = Object.keys(this.snapshot.notes).length > 0;
    if (hadPublishedEntries || this.entries.size > 0 || this.snapshot.readiness !== "indexing") {
      this.entries.clear();
      this.errorCount = 0;
      this.documentFingerprints.clear();
      this.projections.clear();
      if (hadPublishedEntries) this.publish(true, "indexing");
      else this.publish(false, "indexing");
    }
    this.notifyDiagnosticsListeners();
  }

  getSnapshot(): NoteIndexSnapshot {
    if (this.pendingRemovals.size > 0) this.updateSnapshot(true, this.snapshot.readiness);
    return this.snapshot;
  }

  getStatus(): NoteIndexStatus {
    return Object.freeze({
      active: this.active,
      readiness: this.snapshot.readiness,
      noteCount: this.entries.size,
      errorCount: this.errorCount,
      cacheConfigured: this.cache !== null,
    });
  }

  getDiagnostics(): NoteIndexDiagnosticsSnapshot {
    let pendingUpdateCount = this.pendingEventIntents.size;
    for (const batch of this.liveReadBatches) pendingUpdateCount += batch.pendingReads;
    return Object.freeze({
      pendingUpdateCount,
      lastFullIndex: this.lastFullIndex,
      lastIncrementalUpdate: this.lastIncrementalUpdate,
    });
  }

  async clearCacheWhileStopped(): Promise<void> {
    if (this.active) {
      throw new Error("NoteIndex must be stopped before clearing its cache");
    }
    if (this.cache === null) {
      throw new Error("NoteIndex cache is not configured");
    }
    await this.cacheWriter.clear();
  }

  async persistCacheNow(): Promise<void> {
    if (
      !this.active ||
      this.snapshot.readiness !== "ready" ||
      !this.isLiveWorkIdle()
    ) {
      throw new Error("NoteIndex must be ready and idle before persisting its cache");
    }
    if (this.cache === null || this.source.listFiles === undefined) {
      throw new Error("NoteIndex cache is not configured");
    }
    this.cacheWriter.cancel();
    await this.cacheWriter.save();
  }

  get(path: string): NoteIndexEntry {
    return this.entries.get(path) ?? Object.freeze({ kind: "missing", path });
  }

  subscribe(listener: NoteIndexListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeDiagnostics(listener: NoteIndexListener): () => void {
    this.diagnosticsListeners.add(listener);
    return () => this.diagnosticsListeners.delete(listener);
  }

  private isCurrentLifecycle(lifecycle: number): boolean {
    return this.active && this.lifecycle === lifecycle;
  }

  private async loadCacheSnapshot(lifecycle: number): Promise<PersistedNoteIndexSnapshot | null> {
    if (this.cache === null) return null;
    try {
      await this.cacheWriter.settled();
      if (!this.isCurrentLifecycle(lifecycle)) return null;
      const raw = await this.cache.load();
      if (!this.isCurrentLifecycle(lifecycle)) return null;
      if (raw === null || raw === undefined) return null;
      const parsed = await parsePersistedNoteIndexSnapshotIncrementally(raw, {
        clock: this.initialIndexClock,
        timeSliceMs: this.initialIndexTimeSliceMs,
        yieldToHost: this.yieldInitialIndex,
      });
      if (!this.isCurrentLifecycle(lifecycle)) return null;
      if (parsed !== null) return parsed;
      await this.cacheWriter.clear();
      if (!this.isCurrentLifecycle(lifecycle)) return null;
    } catch (error) {
      reportCacheFailure("load", error);
    }
    return null;
  }

  private restoreCachedEntries(
    cachedEntries: readonly PersistedNoteIndexEntry[],
    files: ReadonlyMap<string, NoteSourceFile>,
    knownPaths: ReadonlySet<string>,
    startupEvents: readonly NoteSourceEvent[],
    staging: InitialStaging,
  ): ReadonlySet<string> {
    const dirtyPaths = collectStartupDirtyPaths(startupEvents);
    const restored = new Set<string>();
    for (const cached of cachedEntries) {
      const current = files.get(cached.file.path);
      if (
        current === undefined ||
        !knownPaths.has(cached.file.path) ||
        dirtyPaths.has(cached.file.path) ||
        current.mtime !== cached.file.mtime ||
        current.size !== cached.file.size
      ) {
        this.cacheWriter.changed(cached.file.path);
        continue;
      }
      this.fileMetadata.set(cached.note, current);
      const revision = this.advanceRevision(cached.file.path);
      staging.entries.set(cached.file.path, Object.freeze({
        kind: "parsed",
        revision,
        note: cached.note,
      }));
      restored.add(cached.file.path);
    }
    return restored;
  }

  /**
   * Rescan a path. Concurrent callers reuse the read already serving the
   * current revision; a later Vault event always creates a newer revision.
   * An explicit refresh after a queued delete applies the missing barrier
   * first, then starts a newer read whose parsed or error result is authoritative.
   */
  refresh(path: string): Promise<void> {
    this.assertActive();
    const pending = this.pendingEventIntents.get(path);
    if (pending !== undefined) {
      this.flushEventIntentsNow();
      if (pending.kind === "read") {
        const pendingRead = this.inFlight.get(path);
        if (
          pendingRead?.lifecycle === this.lifecycle &&
          pendingRead.revision === pending.revision
        ) {
          return pendingRead.promise;
        }
      }
    }
    const current = this.inFlight.get(path);
    if (
      current !== undefined &&
      current.lifecycle === this.lifecycle &&
      current.revision === this.revisions.get(path)
    ) {
      if (current.publication.kind === "initial" && this.initialIndexing !== null) {
        return this.initialIndexing;
      }
      return current.promise;
    }
    if (!this.entries.has(path)) this.markIndexing();
    return this.beginRead(path, this.advanceRevision(path), {
      kind: "live",
      forceParse: false,
      batch: this.createLiveReadBatch(1),
    });
  }

  private handleSourceEvent(event: NoteSourceEvent): void {
    if (!this.active) return;
    this.incrementDiagnostic("queuedEvents");

    if (this.bufferedStartupEvents !== null) {
      this.bufferedStartupEvents.push(event);
      return;
    }

    this.applySourceEvent(event);
  }

  private applySourceEvent(event: NoteSourceEvent): void {
    switch (event.type) {
      case "create": {
        if (this.initialKnownPaths?.has(event.path) === true) break;
        this.initialKnownPaths?.add(event.path);
        const revision = this.advanceRevision(event.path);
        this.invalidateAsyncWork(event.path);
        this.queueReadIntent(event.path, revision, false);
        break;
      }
      case "modify": {
        this.initialKnownPaths?.add(event.path);
        const revision = this.advanceRevision(event.path);
        this.invalidateAsyncWork(event.path);
        this.queueReadIntent(event.path, revision, false);
        break;
      }
      case "rename": {
        if (event.oldPath === event.path) {
          this.initialKnownPaths?.add(event.path);
          const revision = this.advanceRevision(event.path);
          this.invalidateAsyncWork(event.path);
          this.queueReadIntent(event.path, revision, true);
          break;
        }
        const newPathWasUnknown = !this.entries.has(event.path);
        if (newPathWasUnknown) {
          this.cancelReadinessCheckpoint?.();
          this.cancelReadinessCheckpoint = null;
        }
        this.initialKnownPaths?.delete(event.oldPath);
        this.initialKnownPaths?.add(event.path);
        const oldRevision = this.advanceRevision(event.oldPath);
        this.invalidateAsyncWork(event.oldPath);
        this.queueMissingIntent(event.oldPath, oldRevision);
        const removedOldPath = this.removePublishedEntry(
          event.oldPath,
          newPathWasUnknown ? "indexing" : this.snapshot.readiness,
        );
        if (newPathWasUnknown && !removedOldPath) this.markIndexing();
        const newRevision = this.advanceRevision(event.path);
        this.invalidateAsyncWork(event.path);
        this.queueReadIntent(event.path, newRevision, true);
        break;
      }
      case "delete-folder": {
        // Revisions cover live and in-flight reads. During startup there can
        // also be known paths which have not yet been assigned a revision.
        const removed = new Set<string>();
        const prefix = event.path + "/";
        for (const path of this.revisions.keys()) {
          if (path.startsWith(prefix)) removed.add(path);
        }
        if (this.initialKnownPaths !== null) {
          for (const path of this.initialKnownPaths) {
            if (path.startsWith(prefix)) removed.add(path);
          }
        }
        for (const path of removed) this.applySourceEvent({ type: "delete", path });
        break;
      }
      case "delete": {
        this.initialKnownPaths?.delete(event.path);
        const revision = this.advanceRevision(event.path);
        this.invalidateAsyncWork(event.path);
        this.queueMissingIntent(event.path, revision);
        this.removePublishedEntry(event.path);
        break;
      }
    }
  }

  private invalidateAsyncWork(path: string): void {
    this.inFlight.delete(path);
    this.initialStaging?.entries.delete(path);
    this.initialStaging?.documentFingerprints.delete(path);
  }

  private removePublishedEntry(
    path: string,
    readiness: NoteIndexReadiness = this.snapshot.readiness,
  ): boolean {
    this.cacheWriter.changed(path);
    const previous = this.entries.get(path);
    if (previous === undefined) return false;
    this.entries.delete(path);
    if (previous.kind === "error") this.errorCount -= 1;
    this.documentFingerprints.delete(path);
    this.pendingRemovals.set(path, null);
    const flush = this.scheduledEventFlush;
    if (flush === null || !flush.publishedRemoval || readiness !== this.snapshot.readiness) {
      if (flush !== null) flush.publishedRemoval = true;
      this.publish(true, readiness);
    } else {
      // Direct lookups already see the deletion. A synchronous snapshot reader
      // materializes this prefix; ordinary subscribers share the end-of-burst copy.
      this.removalNotificationPending = true;
    }
    return true;
  }

  private queueReadIntent(
    path: string,
    revision: number,
    forceParse: boolean,
  ): void {
    if (!this.entries.has(path)) this.markIndexing();
    const pending = this.pendingEventIntents.get(path);
    this.pendingEventIntents.set(path, {
      kind: "read",
      revision,
      forceParse: forceParse || (pending?.kind === "read" && pending.forceParse),
    });
    this.notifyDiagnosticsListeners();
    this.scheduleEventFlush();
  }

  private queueMissingIntent(path: string, revision: number): void {
    this.pendingEventIntents.set(path, { kind: "missing", revision });
    this.notifyDiagnosticsListeners();
    this.scheduleEventFlush();
  }

  private scheduleEventFlush(): void {
    if (this.scheduledEventFlush !== null) return;
    const scheduled = { lifecycle: this.lifecycle, publishedRemoval: false };
    this.scheduledEventFlush = scheduled;
    queueMicrotask(() => {
      if (this.scheduledEventFlush !== scheduled) return;
      this.scheduledEventFlush = null;
      this.flushEventIntents(scheduled.lifecycle);
    });
  }

  private flushEventIntentsNow(): void {
    if (this.pendingEventIntents.size === 0) return;
    this.scheduledEventFlush = null;
    this.flushEventIntents(this.lifecycle);
  }

  private flushEventIntents(lifecycle: number): void {
    const intents = [...this.pendingEventIntents.entries()];
    this.pendingEventIntents.clear();
    if (this.removalNotificationPending) {
      this.removalNotificationPending = false;
      this.getSnapshot();
      this.notifySnapshotListeners();
    }
    this.notifyDiagnosticsListeners();
    if (!this.active || this.lifecycle !== lifecycle) return;
    this.incrementDiagnostic("eventBatches");
    this.addDiagnostic("reducedEventPaths", intents.length);

    const reads: Array<[
      string,
      Extract<PendingEventIntent, { kind: "read" }>,
    ]> = [];
    for (const [path, intent] of intents) {
      if (!this.canCommit(path, intent.revision, lifecycle)) continue;
      if (intent.kind === "read") {
        reads.push([path, intent]);
      } else {
        // A later file at this path must outrank every obsolete read without
        // keeping a tombstone for every name the Vault has ever contained.
        this.retiredRevision = Math.max(this.retiredRevision, intent.revision);
        this.revisions.delete(path);
      }
    }
    if (reads.length === 0) {
      this.scheduleReadyWhenIdle();
      return;
    }
    const batch = this.createLiveReadBatch(reads.length);
    for (const [path, intent] of reads) {
      void this.beginRead(path, intent.revision, {
        kind: "live",
        forceParse: intent.forceParse,
        batch,
      });
    }
  }

  private async indexInitialPaths(
    paths: readonly string[],
    staging: InitialStaging,
  ): Promise<void> {
    const indexingStarted = this.startDiagnosticTiming();
    const tasks = paths.map((path): InitialReadTask => ({
      path,
      revision: this.advanceRevision(path),
    }));
    let nextTaskIndex = 0;
    let timeSliceStarted = this.initialIndexClock();
    let pendingYield: Promise<void> | null = null;
    const yieldWhenTimeSliceExpires = async (): Promise<void> => {
      if (this.initialIndexClock() - timeSliceStarted < this.initialIndexTimeSliceMs) {
        return;
      }
      if (pendingYield === null) {
        const yielding = (async () => {
          await this.yieldInitialIndex();
          timeSliceStarted = this.initialIndexClock();
        })();
        pendingYield = yielding.finally(() => {
          pendingYield = null;
        });
      }
      await pendingYield;
    };
    const runWorker = async (): Promise<void> => {
      while (nextTaskIndex < tasks.length) {
        const task = tasks[nextTaskIndex];
        nextTaskIndex += 1;
        if (
          task === undefined ||
          !this.canCommit(task.path, task.revision, staging.lifecycle)
        ) {
          continue;
        }
        await this.beginRead(task.path, task.revision, { kind: "initial", staging });
        await yieldWhenTimeSliceExpires();
      }
    };
    const workerCount = Math.min(this.readConcurrency, tasks.length);
    try {
      await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
    } finally {
      this.finishDiagnosticTiming("initialIndexingMs", indexingStarted);
    }
  }

  private async completeInitialIndexing(
    paths: readonly string[],
    staging: InitialStaging,
  ): Promise<void> {
    await this.indexInitialPaths(paths, staging);
    await this.settleStartupWork(staging.lifecycle);
  }

  private publishReadyAfterInitialIndexing(
    lifecycle: number,
    staging: InitialStaging,
  ): void {
    if (!this.active || this.lifecycle !== lifecycle) return;
    this.commitInitialStaging(staging, "ready");
    if (this.snapshot.readiness !== "ready") this.publish(false, "ready");
  }

  private async settleStartupWork(lifecycle: number): Promise<void> {
    while (this.active && this.lifecycle === lifecycle) {
      this.flushEventIntentsNow();
      const currentReads = [...this.inFlight.values()]
        .filter((read) => read.lifecycle === lifecycle)
        .map((read) => read.promise);
      if (currentReads.length > 0) {
        await Promise.all(currentReads);
        continue;
      }

      // Give source events already queued for this turn one final checkpoint
      // before exposing the index as ready.
      await Promise.resolve();
      if (
        this.pendingEventIntents.size === 0 &&
        ![...this.inFlight.values()].some((read) => read.lifecycle === lifecycle)
      ) {
        return;
      }
    }
  }

  private beginRead(
    path: string,
    revision: number,
    publication: ReadPublication,
  ): Promise<void> {
    const lifecycle = this.lifecycle;
    let resolveRead!: () => void;
    let rejectRead!: (error: unknown) => void;
    const promise = new Promise<void>((resolve, reject) => {
      resolveRead = resolve;
      rejectRead = reject;
    }).finally(() => {
      const current = this.inFlight.get(path);
      if (current?.promise === promise) this.inFlight.delete(path);
      this.scheduleReadyWhenIdle();
    });
    this.inFlight.set(path, { publication, lifecycle, revision, promise });
    this.readQueue.push({
      path,
      revision,
      lifecycle,
      run: () => this.readAndCommit(path, revision, lifecycle, publication),
      skip: () => this.skipRead(publication),
      resolve: resolveRead,
      reject: rejectRead,
      slotHeld: false,
    });
    this.drainReadQueue();
    return promise;
  }

  private drainReadQueue(): void {
    while (this.activeReadCount < this.readConcurrency && this.readQueue.length > 0) {
      const queued = this.readQueue.shift();
      if (queued === undefined) return;
      if (!this.canCommit(queued.path, queued.revision, queued.lifecycle)) {
        queued.skip();
        queued.resolve();
        continue;
      }

      this.activeReadCount += 1;
      queued.slotHeld = true;
      this.runningReads.add(queued);
      void queued.run()
        .then(
          ({ publication }) => void publication.then(queued.resolve, queued.reject),
          queued.reject,
        )
        .finally(() => {
          this.runningReads.delete(queued);
          if (queued.slotHeld) {
            queued.slotHeld = false;
            this.activeReadCount -= 1;
          }
          this.drainReadQueue();
          this.scheduleReadyWhenIdle();
        });
    }
  }

  private cancelQueuedReads(): void {
    for (const queued of this.readQueue.splice(0)) {
      queued.skip();
      queued.resolve();
    }
  }

  private releaseRunningReadSlots(): void {
    for (const running of this.runningReads) {
      if (!running.slotHeld) continue;
      running.slotHeld = false;
      this.activeReadCount -= 1;
    }
    // Host reads may settle later. Their lifecycle still rejects publication.
    this.runningReads.clear();
  }

  private async readAndCommit(
    path: string,
    revision: number,
    lifecycle: number,
    publication: ReadPublication,
  ): Promise<ReadWorkResult> {
    if (!this.canCommit(path, revision, lifecycle)) {
      return this.finishRead(publication, null);
    }

    let entry: PresentNoteIndexEntry;
    let documentFingerprint: bigint | null = null;
    try {
      this.incrementDiagnostic("reads");
      const readStarted = this.startDiagnosticTiming();
      const file = this.getReadMetadata(path, publication);
      let content: string;
      try {
        content = await this.source.read(path);
      } finally {
        this.finishDiagnosticTiming("readsMs", readStarted);
      }
      if (!this.canCommit(path, revision, lifecycle)) {
        return this.finishRead(publication, null);
      }
      this.incrementDiagnostic("documentParses");
      const documentParseStarted = this.startDiagnosticTiming();
      let document: ParsedNoteDocument;
      try {
        document = parseNoteDocument(content);
      } finally {
        this.finishDiagnosticTiming("documentParsesMs", documentParseStarted);
      }
      const fingerprint = createParsedNoteDocumentFingerprint(document);
      if (
        publication.kind === "live" &&
        !publication.forceParse &&
        this.isSamePublishedDocument(path, fingerprint)
      ) {
        const previous = this.entries.get(path);
        if (previous?.kind === "parsed") {
          const priorFile = this.fileMetadata.get(previous.note);
          if (priorFile?.mtime !== file?.mtime || priorFile?.size !== file?.size) {
            this.fileMetadata.set(previous.note, file);
            this.cacheWriter.changed(path);
            this.cacheWriter.schedule();
          }
        }
        return this.finishRead(publication, null);
      }
      this.incrementDiagnostic("parses");
      const noteParseStarted = this.startDiagnosticTiming();
      let note: IndexedNote;
      try {
        note = createIndexedNote(parseNoteFromDocument(path, document));
      } finally {
        this.finishDiagnosticTiming("noteParsesMs", noteParseStarted);
      }
      if (file !== null) this.fileMetadata.set(note, file);
      entry = Object.freeze({
        kind: "parsed",
        revision,
        note,
      });
      documentFingerprint = fingerprint;
    } catch (error) {
      if (!this.canCommit(path, revision, lifecycle)) {
        return this.finishRead(publication, null);
      }
      entry = Object.freeze({
        kind: "error",
        path,
        revision,
        error: toReadFailure(error),
      });
      documentFingerprint = null;
    }

    if (publication.kind !== "initial") {
      return this.finishRead(publication, {
        path,
        revision,
        lifecycle,
        entry,
        documentFingerprint,
      });
    }

    if (this.initialStaging === publication.staging) {
      this.cacheWriter.changed(path);
      publication.staging.entries.set(path, entry);
      if (documentFingerprint === null) {
        publication.staging.documentFingerprints.delete(path);
      } else {
        publication.staging.documentFingerprints.set(path, documentFingerprint);
      }
    }
    return { publication: Promise.resolve() };
  }

  private getReadMetadata(path: string, publication: ReadPublication): NoteSourceFile | null {
    if (this.cache === null || this.source.listFiles === undefined) return null;
    try {
      if (publication.kind === "initial") return publication.staging.files?.get(path) ?? null;
      if (this.source.getFileMetadata !== undefined) return this.source.getFileMetadata(path);
      // Compatibility for sources that expose only a full metadata inventory.
      publication.batch.files ??= new Map(this.source.listFiles().map((file) => [file.path, file]));
      return publication.batch.files.get(path) ?? null;
    } catch {
      // A failed stat makes this revision uncacheable. The note is still readable.
      return null;
    }
  }

  private isSamePublishedDocument(path: string, fingerprint: bigint): boolean {
    const current = this.entries.get(path);
    const currentFingerprint = this.documentFingerprints.get(path);
    return current?.kind === "parsed" &&
      current.note.path === path &&
      currentFingerprint === fingerprint;
  }

  private finishRead(
    publication: ReadPublication,
    commit: Omit<PendingLiveCommit, "resolve"> | null,
  ): ReadWorkResult {
    if (publication.kind === "initial") {
      return { publication: Promise.resolve() };
    }
    return {
      publication: this.finishLiveRead(publication.batch, commit),
    };
  }

  private skipRead(publication: ReadPublication): void {
    if (publication.kind !== "initial") {
      void this.finishLiveRead(publication.batch, null);
    }
  }

  private createLiveReadBatch(pendingReads: number): LiveReadBatch {
    const batch: LiveReadBatch = {
      lifecycle: this.lifecycle,
      pendingReads,
      commits: [],
      cancelCheckpoint: null,
      checkpointReached: false,
      active: true,
      startedAt: this.operationClock(),
      affectedPathCount: pendingReads,
    };
    this.liveReadBatches.add(batch);
    this.notifyDiagnosticsListeners();
    return batch;
  }

  private finishLiveRead(
    batch: LiveReadBatch,
    commit: Omit<PendingLiveCommit, "resolve"> | null,
  ): Promise<void> {
    if (!batch.active) return Promise.resolve();
    let publication = Promise.resolve();
    if (commit !== null && this.canCommit(commit.path, commit.revision, commit.lifecycle)) {
      publication = new Promise((resolve) => {
        batch.commits.push({ ...commit, resolve });
      });
    }
    batch.pendingReads -= 1;
    if (batch.pendingReads === 0 && batch.checkpointReached) {
      this.flushLiveReadBatch(batch, true);
    } else if (!batch.checkpointReached && batch.cancelCheckpoint === null) {
      batch.cancelCheckpoint = this.scheduleLiveCommitCheckpoint(() => {
        if (!batch.active) return;
        batch.cancelCheckpoint = null;
        if (batch.pendingReads === 0) {
          this.flushLiveReadBatch(batch, true);
        } else {
          batch.checkpointReached = true;
          this.flushLiveReadBatch(batch, false);
        }
      });
    }
    return publication;
  }

  private flushLiveReadBatch(batch: LiveReadBatch, final: boolean): void {
    const commits = batch.commits.splice(0);
    let hasChanges = false;
    if (this.active && this.lifecycle === batch.lifecycle) {
      const commitStarted = this.startDiagnosticTiming();
      try {
        const projectionChanges: Array<readonly [string, IndexedNote | null]> = [];
        for (const commit of commits) {
          if (!this.canCommit(commit.path, commit.revision, commit.lifecycle)) continue;
          this.cacheWriter.changed(commit.path);
          this.storeEntry(commit.path, commit.entry);
          if (commit.documentFingerprint === null) {
            this.documentFingerprints.delete(commit.path);
          } else {
            this.documentFingerprints.set(commit.path, commit.documentFingerprint);
          }
          projectionChanges.push([
            commit.path,
            commit.entry.kind === "parsed" ? commit.entry.note : null,
          ]);
          hasChanges = true;
        }
        this.projections.replaceBatch(projectionChanges);
      } finally {
        this.finishDiagnosticTiming("liveCommitsMs", commitStarted);
      }
      if (hasChanges) this.publish();
    }
    for (const commit of commits) commit.resolve();
    if (final) {
      batch.active = false;
      this.liveReadBatches.delete(batch);
      if (this.active && this.lifecycle === batch.lifecycle) {
        this.lastIncrementalUpdate = this.completeOperation(
          batch.startedAt,
          batch.affectedPathCount,
        );
      }
      this.notifyDiagnosticsListeners();
      this.scheduleReadyWhenIdle();
    }
  }

  private cancelLiveReadBatches(): void {
    for (const batch of this.liveReadBatches) {
      batch.active = false;
      batch.cancelCheckpoint?.();
      batch.cancelCheckpoint = null;
      for (const commit of batch.commits.splice(0)) commit.resolve();
    }
    this.liveReadBatches.clear();
    this.notifyDiagnosticsListeners();
  }

  private commitInitialStaging(
    staging: InitialStaging,
    readiness: NoteIndexReadiness,
  ): void {
    if (
      !this.active ||
      this.lifecycle !== staging.lifecycle ||
      this.initialStaging !== staging
    ) {
      return;
    }

    const commitStarted = this.startDiagnosticTiming();
    let hasChanges = false;
    try {
      const projectionChanges: Array<readonly [string, IndexedNote | null]> = [];
      for (const [path, entry] of staging.entries) {
        if (this.revisions.get(path) !== entry.revision) continue;
        this.storeEntry(path, entry);
        const fingerprint = staging.documentFingerprints.get(path);
        if (fingerprint === undefined) this.documentFingerprints.delete(path);
        else this.documentFingerprints.set(path, fingerprint);
        projectionChanges.push([
          path,
          entry.kind === "parsed" ? entry.note : null,
        ]);
        hasChanges = true;
      }
      this.projections.replaceBatch(projectionChanges);
      staging.entries.clear();
      staging.documentFingerprints.clear();
    } finally {
      this.finishDiagnosticTiming("initialCommitsMs", commitStarted);
    }
    if (hasChanges) this.publish(true, readiness);
  }

  private canCommit(path: string, revision: number, lifecycle: number): boolean {
    return (
      this.active &&
      this.lifecycle === lifecycle &&
      this.revisions.get(path) === revision
    );
  }

  private rollbackFailedStart(startLifecycle: number): void {
    if (this.lifecycle !== startLifecycle) return;
    this.active = false;
    this.lifecycle += 1;
    const unsubscribe = this.unsubscribeSource;
    this.unsubscribeSource = null;
    try {
      unsubscribe?.();
    } catch (error) {
      try {
        console.error("Chrono Notes: failed to unsubscribe after NoteIndex start failure", error);
      } catch {
        // Preserve the original start failure even if diagnostics also fail.
      }
    }
    this.pendingEventIntents.clear();
    this.scheduledEventFlush = null;
    this.cancelReadinessCheckpoint?.();
    this.cancelReadinessCheckpoint = null;
    this.cacheWriter.reset(false);
    this.cancelLiveReadBatches();
    this.cancelQueuedReads();
    this.releaseRunningReadSlots();
    this.inFlight.clear();
    this.initialStaging?.entries.clear();
    this.initialStaging?.documentFingerprints.clear();
    this.initialStaging = null;
    this.initialIndexing = null;
    this.initialKnownPaths = null;
    this.bufferedStartupEvents = null;
    this.revisions.clear();
    this.retiredRevision = 0;
    this.pendingRemovals.clear();
    this.removalNotificationPending = false;
    this.errorCount = 0;
    const hadPublishedEntries = Object.keys(this.snapshot.notes).length > 0;
    this.entries.clear();
    this.documentFingerprints.clear();
    this.projections.clear();
    if (hadPublishedEntries || this.snapshot.readiness !== "indexing") {
      this.publish(hadPublishedEntries, "indexing");
    }
  }

  private storeEntry(path: string, entry: PresentNoteIndexEntry): void {
    if (this.entries.get(path)?.kind === "error") this.errorCount -= 1;
    if (entry.kind === "error") this.errorCount += 1;
    this.entries.set(path, entry);
    this.pendingRemovals.delete(path);
  }

  private advanceRevision(path: string): number {
    const revision = (this.revisions.get(path) ?? this.retiredRevision) + 1;
    this.revisions.set(path, revision);
    return revision;
  }

  private markIndexing(): void {
    this.cancelReadinessCheckpoint?.();
    this.cancelReadinessCheckpoint = null;
    if (this.snapshot.readiness !== "indexing") this.publish(false, "indexing");
  }

  private scheduleReadyWhenIdle(): void {
    if (
      !this.active ||
      this.snapshot.readiness === "ready" ||
      this.initialStaging !== null ||
      this.cancelReadinessCheckpoint !== null ||
      !this.isLiveWorkIdle()
    ) {
      return;
    }
    const lifecycle = this.lifecycle;
    this.cancelReadinessCheckpoint = this.scheduleReadinessCheckpoint(() => {
      this.cancelReadinessCheckpoint = null;
      if (
        this.active &&
        this.lifecycle === lifecycle &&
        this.initialStaging === null &&
        this.isLiveWorkIdle()
      ) {
        this.publish(false, "ready");
      }
    });
  }

  private isLiveWorkIdle(): boolean {
    return this.pendingEventIntents.size === 0 &&
      this.inFlight.size === 0 &&
      this.readQueue.length === 0 &&
      this.runningReads.size === 0 &&
      this.liveReadBatches.size === 0;
  }

  private publish(
    notesChanged = true,
    readiness: NoteIndexReadiness = this.snapshot.readiness,
  ): void {
    this.removalNotificationPending = false;
    this.updateSnapshot(notesChanged || this.pendingRemovals.size > 0, readiness);
    this.notifySnapshotListeners();
  }

  private updateSnapshot(notesChanged: boolean, readiness: NoteIndexReadiness): void {
    const materializationStarted = this.startDiagnosticTiming();
    if (this.pendingRemovals.size > 0) {
      this.projections.replaceBatch(this.pendingRemovals);
      this.pendingRemovals.clear();
    }
    let notes = this.snapshot.notes;
    if (notesChanged) {
      const materialized: Record<string, PresentNoteIndexEntry> = Object.create(null) as Record<
        string,
        PresentNoteIndexEntry
      >;
      for (const [path, entry] of this.entries) materialized[path] = entry;
      notes = Object.freeze(materialized);
      this.incrementDiagnostic("materializations");
    }
    this.snapshot = Object.freeze({
      version: this.snapshot.version + 1,
      readiness,
      notes,
      taskDates: this.projections.taskDates,
      intervals: this.projections.intervals,
    });
    this.finishDiagnosticTiming(
      "snapshotMaterializationsMs",
      materializationStarted,
    );
  }

  private notifySnapshotListeners(): void {
    this.incrementDiagnostic("publishes");
    const notificationStarted = this.startDiagnosticTiming();
    try {
      notifyListeners(this.listeners);
    } finally {
      this.finishDiagnosticTiming("listenerNotificationsMs", notificationStarted);
    }
    if (this.snapshot.readiness === "ready") this.cacheWriter.schedule();
  }

  private collectCacheChanges(paths?: Iterable<string>): NoteIndexCacheChanges {
    const upserts: PersistedNoteIndexEntry[] = [];
    const deletes: string[] = [];
    for (const path of paths ?? this.entries.keys()) {
      const entry = this.entries.get(path);
      if (entry?.kind === "parsed") {
        const file = this.fileMetadata.get(entry.note);
        if (file != null) {
          upserts.push({ file, note: entry.note });
          continue;
        }
      }
      if (paths !== undefined) deletes.push(path);
    }
    return { upserts, deletes };
  }

  private incrementDiagnostic(counter: NoteIndexDiagnosticCounter): void {
    this.addDiagnostic(counter, 1);
  }

  private addDiagnostic(counter: NoteIndexDiagnosticCounter, amount: number): void {
    if (!this.diagnosticsEnabled || this.diagnostics === null) return;
    try {
      this.diagnostics[counter] += amount;
    } catch {
      this.diagnosticsEnabled = false;
    }
  }

  private startDiagnosticTiming(): number | null {
    if (!this.diagnosticsEnabled || this.diagnostics === null) return null;
    try {
      return this.diagnostics.timings === undefined
        ? null
        : this.diagnosticClock();
    } catch {
      this.diagnosticsEnabled = false;
      return null;
    }
  }

  private finishDiagnosticTiming(
    metric: keyof NoteIndexTimingDiagnostics,
    started: number | null,
  ): void {
    if (
      !this.diagnosticsEnabled ||
      this.diagnostics === null ||
      started === null
    ) {
      return;
    }
    try {
      const timings = this.diagnostics.timings;
      if (timings === undefined) return;
      timings[metric].push(Math.max(0, this.diagnosticClock() - started));
    } catch {
      this.diagnosticsEnabled = false;
    }
  }

  private assertActive(): void {
    if (!this.active) throw new Error("NoteIndex must be started before it can refresh paths");
  }

  private completeOperation(
    startedAt: number,
    affectedPathCount: number,
  ): NoteIndexOperationDiagnostics {
    return Object.freeze({
      completedAt: this.wallClock(),
      durationMs: Math.max(0, this.operationClock() - startedAt),
      affectedPathCount,
    });
  }

  private notifyDiagnosticsListeners(): void {
    notifyListeners(this.diagnosticsListeners);
  }
}

function defaultDiagnosticClock(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function scheduleMacrotaskCheckpoint(callback: () => void): () => void {
  return scheduleTimeout(callback, 0);
}

function scheduleTimeout(callback: () => void, delayMs: number): () => void {
  const handle = window.setTimeout(callback, delayMs);
  return () => window.clearTimeout(handle);
}

function createParsedNoteDocumentFingerprint(document: ParsedNoteDocument): bigint {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  const mix = (value: number): void => {
    first = Math.imul(first ^ value, 0x01000193);
    second = Math.imul(second ^ value, 0x85ebca6b);
  };
  const mixString = (value: string | null): void => {
    if (value === null) {
      mix(0xffffffff);
    } else {
      mix(value.length);
      for (let index = 0; index < value.length; index += 1) {
        mix(value.charCodeAt(index));
      }
    }
    mix(0x7f4a7c15);
  };

  mixString(document.state);
  mixString(document.frontmatterStatus);
  mixString(document.frontmatterText);
  mixString(document.body);
  mix(document.bodyStartLine);
  mix(document.hadBom ? 1 : 0);
  mixString(document.lineEnding);
  first = Math.imul(first ^ (first >>> 16), 0x85ebca6b);
  second = Math.imul(second ^ (second >>> 13), 0xc2b2ae35);
  return (BigInt(first >>> 0) << 32n) | BigInt(second >>> 0);
}

function reconcileStartupPaths(
  listedPaths: readonly string[],
  events: readonly NoteSourceEvent[],
): Set<string> {
  const paths = new Set(listedPaths);
  for (const event of events) {
    switch (event.type) {
      case "create":
      case "modify":
        paths.add(event.path);
        break;
      case "rename":
        paths.delete(event.oldPath);
        paths.add(event.path);
        break;
      case "delete-folder": {
        const prefix = event.path + "/";
        for (const path of paths) if (path.startsWith(prefix)) paths.delete(path);
        break;
      }
      case "delete":
        paths.delete(event.path);
        break;
    }
  }
  return paths;
}

function collectStartupDirtyPaths(events: readonly NoteSourceEvent[]): ReadonlySet<string> {
  const paths = new Set<string>();
  for (const event of events) {
    switch (event.type) {
      case "create":
      case "modify":
      case "delete":
        paths.add(event.path);
        break;
      case "rename":
        paths.add(event.oldPath);
        paths.add(event.path);
        break;
    }
  }
  return paths;
}

function reportCacheFailure(action: "load" | "save", error: unknown): void {
  try {
    console.error(`Chrono Notes: failed to ${action} NoteIndex cache`, error);
  } catch {
    // Cache failures must never make the live index unavailable.
  }
}

function toReadFailure(error: unknown): NoteReadFailure {
  if (error instanceof Error) {
    return Object.freeze({ name: error.name, message: error.message });
  }
  return Object.freeze({ name: "Error", message: String(error) });
}
