import {
  parseNoteDocument,
  type ParsedNoteDocument,
} from "../../core/document/parse-note-document";
import type {
  NoteSource,
  NoteSourceEvent,
} from "../../core/note/note-source";
import {
  parseNoteFromDocument,
  type ParsedNote,
} from "../../core/note/parsed-note";
import { notifyListeners } from "../notify-listeners";
import {
  EMPTY_INTERVAL_INDEX_SNAPSHOT,
  EMPTY_TASK_DATE_INDEX_SNAPSHOT,
  NoteIndexProjections,
  type IntervalIndexSnapshot,
  type TaskDateIndexSnapshot,
} from "./note-index-projections";

export interface ParsedNoteIndexEntry {
  readonly kind: "parsed";
  readonly revision: number;
  readonly note: ParsedNote;
}

export interface NoteReadFailure {
  readonly name: string;
  readonly message: string;
}

export interface ErrorNoteIndexEntry {
  readonly kind: "error";
  readonly path: string;
  readonly revision: number;
  readonly error: NoteReadFailure;
}

export interface MissingNoteIndexEntry {
  readonly kind: "missing";
  readonly path: string;
}

export type PresentNoteIndexEntry = ParsedNoteIndexEntry | ErrorNoteIndexEntry;
export type NoteIndexEntry = PresentNoteIndexEntry | MissingNoteIndexEntry;
export type NoteIndexReadiness = "indexing" | "ready";

export interface NoteIndexSnapshot {
  readonly version: number;
  readonly readiness: NoteIndexReadiness;
  readonly notes: Readonly<Record<string, PresentNoteIndexEntry>>;
  readonly taskDates: TaskDateIndexSnapshot;
  readonly intervals: IntervalIndexSnapshot;
}

type NoteIndexListener = () => void;

interface InFlightRead {
  readonly publication: ReadPublication;
  readonly lifecycle: number;
  readonly revision: number;
  readonly promise: Promise<void>;
}

interface InitialStaging {
  readonly lifecycle: number;
  readonly entries: Map<string, PresentNoteIndexEntry>;
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
  readonly diagnostics?: NoteIndexDiagnostics;
  readonly diagnosticClock?: () => number;
  /** Schedules the bounded checkpoint used to publish a partially settled live batch. */
  readonly scheduleLiveCommitCheckpoint?: (callback: () => void) => () => void;
  /** Schedules the quiet checkpoint before a live discovery wave becomes ready. */
  readonly scheduleReadinessCheckpoint?: (callback: () => void) => () => void;
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
}

interface PendingLiveCommit {
  readonly path: string;
  readonly revision: number;
  readonly lifecycle: number;
  readonly entry: PresentNoteIndexEntry;
  readonly resolve: () => void;
}

interface LiveReadBatch {
  readonly lifecycle: number;
  pendingReads: number;
  readonly commits: PendingLiveCommit[];
  cancelCheckpoint: (() => void) | null;
  checkpointReached: boolean;
  active: boolean;
}

const INITIAL_SNAPSHOT: NoteIndexSnapshot = Object.freeze({
  version: 0,
  readiness: "indexing",
  notes: Object.freeze({}),
  taskDates: EMPTY_TASK_DATE_INDEX_SNAPSHOT,
  intervals: EMPTY_INTERVAL_INDEX_SNAPSHOT,
});

const DEFAULT_READ_CONCURRENCY = 16;

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
  private readonly projections = new NoteIndexProjections();
  private readonly revisions = new Map<string, number>();
  private readonly inFlight = new Map<string, InFlightRead>();
  private readonly readQueue: QueuedRead[] = [];
  private readonly runningReads = new Set<QueuedRead>();
  private readonly pendingEventIntents = new Map<string, PendingEventIntent>();
  private readonly liveReadBatches = new Set<LiveReadBatch>();
  private readonly listeners = new Set<NoteIndexListener>();
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
  private readonly diagnostics: NoteIndexDiagnostics | null;
  private readonly diagnosticClock: () => number;
  private readonly scheduleLiveCommitCheckpoint: (callback: () => void) => () => void;
  private readonly scheduleReadinessCheckpoint: (callback: () => void) => () => void;
  private diagnosticsEnabled: boolean;
  private scheduledEventFlush: ScheduledFlush | null = null;
  private cancelReadinessCheckpoint: (() => void) | null = null;

  constructor(
    private readonly source: NoteSource,
    options: NoteIndexOptions = {},
  ) {
    const readConcurrency = options.readConcurrency ?? DEFAULT_READ_CONCURRENCY;
    if (!Number.isInteger(readConcurrency) || readConcurrency < 1) {
      throw new RangeError("NoteIndex read concurrency must be a positive integer");
    }
    this.readConcurrency = readConcurrency;
    this.diagnostics = options.diagnostics ?? null;
    this.diagnosticClock = options.diagnosticClock ?? defaultDiagnosticClock;
    this.scheduleLiveCommitCheckpoint = options.scheduleLiveCommitCheckpoint
      ?? scheduleMacrotaskCheckpoint;
    this.scheduleReadinessCheckpoint = options.scheduleReadinessCheckpoint
      ?? scheduleMacrotaskCheckpoint;
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

    this.active = true;
    const startLifecycle = ++this.lifecycle;
    const staging: InitialStaging = {
      lifecycle: startLifecycle,
      entries: new Map(),
    };
    this.initialStaging = staging;
    this.bufferedStartupEvents = [];
    try {
      this.unsubscribeSource = this.source.subscribe(
        (event) => this.handleSourceEvent(event),
      );
      const listPathsStarted = this.startDiagnosticTiming();
      let initialPaths: string[];
      try {
        initialPaths = [...new Set(this.source.listPaths())];
      } finally {
        this.finishDiagnosticTiming("listPathsMs", listPathsStarted);
      }
      const bufferedEvents = this.bufferedStartupEvents;
      this.bufferedStartupEvents = null;
      const knownPaths = reconcileStartupPaths(initialPaths, bufferedEvents ?? []);
      this.initialKnownPaths = knownPaths;
      const initialIndexing = this.completeInitialIndexing([...knownPaths], staging);
      this.initialIndexing = initialIndexing;
      try {
        await initialIndexing;
      } finally {
        if (this.initialIndexing === initialIndexing) this.initialIndexing = null;
      }
      this.publishReadyAfterInitialIndexing(startLifecycle, staging);
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
    this.cancelLiveReadBatches();
    this.cancelQueuedReads();
    this.releaseRunningReadSlots();
    this.inFlight.clear();
    this.initialStaging?.entries.clear();
    this.initialStaging = null;
    this.initialKnownPaths = null;
    this.bufferedStartupEvents = null;
    this.revisions.clear();
    if (this.entries.size > 0 || this.snapshot.readiness !== "indexing") {
      const hadPublishedEntries = Object.keys(this.snapshot.notes).length > 0;
      this.entries.clear();
      this.projections.clear();
      if (hadPublishedEntries) this.publish(true, "indexing");
      else this.publish(false, "indexing");
    }
  }

  getSnapshot(): NoteIndexSnapshot {
    return this.snapshot;
  }

  get(path: string): NoteIndexEntry {
    return this.snapshot.notes[path] ?? Object.freeze({ kind: "missing", path });
  }

  subscribe(listener: NoteIndexListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
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
  }

  private removePublishedEntry(
    path: string,
    readiness: NoteIndexReadiness = this.snapshot.readiness,
  ): boolean {
    if (this.entries.delete(path)) {
      this.projections.replace(path, null);
      this.publish(true, readiness);
      return true;
    }
    return false;
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
    this.scheduleEventFlush();
  }

  private queueMissingIntent(path: string, revision: number): void {
    this.pendingEventIntents.set(path, { kind: "missing", revision });
    this.scheduleEventFlush();
  }

  private scheduleEventFlush(): void {
    if (this.scheduledEventFlush !== null) return;
    const scheduled = { lifecycle: this.lifecycle };
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
    if (!this.active || this.lifecycle !== lifecycle) return;
    this.incrementDiagnostic("eventBatches");
    this.addDiagnostic("reducedEventPaths", intents.length);

    const reads: Array<[
      string,
      Extract<PendingEventIntent, { kind: "read" }>,
    ]> = [];
    for (const [path, intent] of intents) {
      if (
        intent.kind === "read" &&
        this.canCommit(path, intent.revision, lifecycle)
      ) {
        reads.push([path, intent]);
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
    try {
      this.incrementDiagnostic("reads");
      const readStarted = this.startDiagnosticTiming();
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
      if (
        publication.kind === "live" &&
        !publication.forceParse &&
        this.isSamePublishedDocument(path, document)
      ) {
        return this.finishRead(publication, null);
      }
      this.incrementDiagnostic("parses");
      const noteParseStarted = this.startDiagnosticTiming();
      let note: ParsedNote;
      try {
        note = parseNoteFromDocument(path, document);
      } finally {
        this.finishDiagnosticTiming("noteParsesMs", noteParseStarted);
      }
      entry = Object.freeze({
        kind: "parsed",
        revision,
        note,
      });
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
    }

    if (publication.kind === "live") {
      return this.finishRead(publication, { path, revision, lifecycle, entry });
    }

    if (this.initialStaging === publication.staging) {
      publication.staging.entries.set(path, entry);
    }
    return { publication: Promise.resolve() };
  }

  private isSamePublishedDocument(path: string, document: ParsedNoteDocument): boolean {
    const current = this.entries.get(path);
    return current?.kind === "parsed" &&
      current.note.path === path &&
      areParsedNoteDocumentsEqual(current.note.document, document);
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
    if (publication.kind === "live") void this.finishLiveRead(publication.batch, null);
  }

  private createLiveReadBatch(pendingReads: number): LiveReadBatch {
    const batch: LiveReadBatch = {
      lifecycle: this.lifecycle,
      pendingReads,
      commits: [],
      cancelCheckpoint: null,
      checkpointReached: false,
      active: true,
    };
    this.liveReadBatches.add(batch);
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
        const projectionChanges: Array<readonly [string, ParsedNote | null]> = [];
        for (const commit of commits) {
          if (!this.canCommit(commit.path, commit.revision, commit.lifecycle)) continue;
          this.entries.set(commit.path, commit.entry);
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
      const projectionChanges: Array<readonly [string, ParsedNote | null]> = [];
      for (const [path, entry] of staging.entries) {
        if (this.revisions.get(path) !== entry.revision) continue;
        this.entries.set(path, entry);
        projectionChanges.push([
          path,
          entry.kind === "parsed" ? entry.note : null,
        ]);
        hasChanges = true;
      }
      this.projections.replaceBatch(projectionChanges);
      staging.entries.clear();
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
    this.cancelLiveReadBatches();
    this.cancelQueuedReads();
    this.releaseRunningReadSlots();
    this.inFlight.clear();
    this.initialStaging?.entries.clear();
    this.initialStaging = null;
    this.initialIndexing = null;
    this.initialKnownPaths = null;
    this.bufferedStartupEvents = null;
    this.revisions.clear();
    const hadPublishedEntries = this.entries.size > 0;
    this.entries.clear();
    this.projections.clear();
    if (hadPublishedEntries || this.snapshot.readiness !== "indexing") {
      this.publish(hadPublishedEntries, "indexing");
    }
  }

  private advanceRevision(path: string): number {
    const revision = (this.revisions.get(path) ?? 0) + 1;
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
    const materializationStarted = this.startDiagnosticTiming();
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
    this.incrementDiagnostic("publishes");
    const notificationStarted = this.startDiagnosticTiming();
    try {
      notifyListeners(this.listeners);
    } finally {
      this.finishDiagnosticTiming("listenerNotificationsMs", notificationStarted);
    }
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
}

function defaultDiagnosticClock(): number {
  return globalThis.performance?.now() ?? Date.now();
}

function scheduleMacrotaskCheckpoint(callback: () => void): () => void {
  const handle = globalThis.setTimeout(callback, 0);
  return () => globalThis.clearTimeout(handle);
}

function areParsedNoteDocumentsEqual(
  left: ParsedNoteDocument,
  right: ParsedNoteDocument,
): boolean {
  return left.state === right.state &&
    left.frontmatterStatus === right.frontmatterStatus &&
    left.frontmatterText === right.frontmatterText &&
    left.body === right.body &&
    left.bodyStartLine === right.bodyStartLine &&
    left.hadBom === right.hadBom &&
    left.lineEnding === right.lineEnding;
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
      case "delete":
        paths.delete(event.path);
        break;
    }
  }
  return paths;
}

function toReadFailure(error: unknown): NoteReadFailure {
  if (error instanceof Error) {
    return Object.freeze({ name: error.name, message: error.message });
  }
  return Object.freeze({ name: "Error", message: String(error) });
}
