import { performance } from "node:perf_hooks";

import { describe, expect, it } from "vitest";

import type {
  NoteSource,
  NoteSourceEvent,
  NoteSourceFile,
  NoteSourceListener,
} from "../src/core/note/note-source";
import {
  NoteIndex,
  type NoteIndexDiagnostics,
  type NoteIndexTimingDiagnostics,
} from "../src/features/notes/note-index";
import { createBenchmarkDataset } from "./benchmark-dataset";

declare const __CHRONO_BENCHMARK_NOTE_COUNT__: number;

const LARGE_VAULT = __CHRONO_BENCHMARK_NOTE_COUNT__ >= 10_000;

describe(`single-file update guardrail (${__CHRONO_BENCHMARK_NOTE_COUNT__} notes)`, () => {
  it("keeps repeated single-file updates within deterministic and loose time budgets", async () => {
    const dataset = createBenchmarkDataset(__CHRONO_BENCHMARK_NOTE_COUNT__);
    const source = new GuardrailNoteSource(dataset.contents);
    const timings = createTimingDiagnostics();
    const diagnostics = createDiagnostics(timings);
    const index = new NoteIndex(source, {
      ...NODE_NOTE_INDEX_RUNTIME,
      diagnostics,
    });
    let notifications = 0;
    const unsubscribe = index.subscribe(() => {
      notifications += 1;
    });
    try {
      await index.start();
      expect(index.getSnapshot().readiness).toBe("ready");

      const path = pickParsablePath(dataset.contents);
      const updateCount = LARGE_VAULT ? 60 : 30;
      const publishesBefore = diagnostics.publishes;
      const materializationsBefore = diagnostics.materializations;
      const notificationsBefore = notifications;
      const heapBefore = sampleHeapUsed();
      const latencies: number[] = [];
      for (let update = 0; update < updateCount; update += 1) {
        source.setContent(path, singleFileUpdateContent(update));
        const started = performance.now();
        source.emit({ type: "modify", path });
        await index.refresh(path);
        latencies.push(performance.now() - started);
      }
      const heapAfter = sampleHeapUsed();
      const publishesDuringStorm = diagnostics.publishes - publishesBefore;
      const materializationsDuringStorm =
        diagnostics.materializations - materializationsBefore;
      const notificationsDuringStorm = notifications - notificationsBefore;

      const latency = summarizeTimings(latencies);
      const materialization = summarizeTimings(timings.snapshotMaterializationsMs);
      const notification = summarizeTimings(timings.listenerNotificationsMs);

      console.info(`CHRONO_BENCHMARK_SINGLE_FILE_UPDATE ${JSON.stringify(Object.freeze({
        noteCount: __CHRONO_BENCHMARK_NOTE_COUNT__,
        updateCount,
        latenciesMs: latency,
        snapshotMaterializationsMs: materialization,
        listenerNotificationsMs: notification,
        heap: Object.freeze({
          gcAvailable: canRequestGc(),
          deltaBytes: heapAfter - heapBefore,
        }),
        perUpdate: Object.freeze({
          reads: source.readCountFor(path) - 1,
          materializations: materializationsDuringStorm,
          publishes: publishesDuringStorm,
          notifications: notificationsDuringStorm,
        }),
      }))}`);

      expect(source.readCountFor(path) - 1).toBe(updateCount);
      expect(materializationsDuringStorm).toBe(updateCount);
      expect(publishesDuringStorm).toBe(updateCount);
      expect(notificationsDuringStorm).toBe(updateCount);

      const latencyBudgetMs = LARGE_VAULT ? 1_000 : 250;
      expect(latency.p95).toBeLessThanOrEqual(latencyBudgetMs);
      expect(materialization.p95).toBeLessThanOrEqual(latencyBudgetMs);
      expect(notification.p95).toBeLessThanOrEqual(LARGE_VAULT ? 500 : 100);
      if (canRequestGc()) {
        expect(heapAfter - heapBefore).toBeLessThanOrEqual(
          LARGE_VAULT ? 512 * 1024 * 1024 : 256 * 1024 * 1024,
        );
      }
    } finally {
      unsubscribe();
      index.stop();
    }
  });
});

const NODE_NOTE_INDEX_RUNTIME = Object.freeze({
  yieldInitialIndex: yieldNodeTask,
  scheduleLiveCommitCheckpoint: scheduleNodeTask,
  scheduleReadinessCheckpoint: scheduleNodeTask,
  scheduleCacheSave: () => () => undefined,
  scheduleBackgroundVerification: scheduleNodeTask,
});

function yieldNodeTask(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function scheduleNodeTask(callback: () => void): () => void {
  const handle = setTimeout(callback, 0);
  return () => clearTimeout(handle);
}

class GuardrailNoteSource implements NoteSource {
  readCount = 0;
  private readonly contents: Map<string, string | Error>;
  private readonly pathReadCounts = new Map<string, number>();
  private readonly listeners = new Set<NoteSourceListener>();

  constructor(contents: ReadonlyMap<string, string | Error>) {
    this.contents = new Map(contents);
  }

  listPaths(): readonly string[] {
    return [...this.contents.keys()];
  }

  listFiles(): readonly NoteSourceFile[] {
    return [...this.contents].map(([path, value]) => Object.freeze({
      path,
      mtime: 1,
      size: typeof value === "string" ? value.length : 0,
    }));
  }

  async read(path: string): Promise<string> {
    this.readCount += 1;
    this.pathReadCounts.set(path, this.readCountFor(path) + 1);
    const value = this.contents.get(path);
    if (value instanceof Error) throw value;
    if (value === undefined) throw new Error(`Missing guardrail note: ${path}`);
    return value;
  }

  subscribe(listener: NoteSourceListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: NoteSourceEvent): void {
    for (const listener of [...this.listeners]) listener(event);
  }

  setContent(path: string, content: string): void {
    this.contents.set(path, content);
  }

  readCountFor(path: string): number {
    return this.pathReadCounts.get(path) ?? 0;
  }
}

function pickParsablePath(
  contents: ReadonlyMap<string, string | Error>,
): string {
  for (const [path, value] of contents) {
    if (typeof value === "string" && !value.startsWith("---")) return path;
  }
  throw new Error("Expected at least one parsable benchmark note.");
}

function singleFileUpdateContent(update: number): string {
  const day = String((update % 28) + 1).padStart(2, "0");
  return [
    "---",
    `kind: guardrail-${update}`,
    "---",
    `Single-file update ${update}`,
    `- [ ] Guardrail task 📅 2026-07-${day}`,
  ].join("\n");
}

function createDiagnostics(
  timings: NoteIndexTimingDiagnostics,
): NoteIndexDiagnostics {
  return {
    queuedEvents: 0,
    eventBatches: 0,
    reducedEventPaths: 0,
    reads: 0,
    documentParses: 0,
    parses: 0,
    materializations: 0,
    publishes: 0,
    timings,
  };
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

interface TimingSummary {
  readonly samples: number;
  readonly p50: number;
  readonly p95: number;
  readonly max: number;
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

function canRequestGc(): boolean {
  return typeof (globalThis as { gc?: unknown }).gc === "function";
}

function sampleHeapUsed(): number {
  requestGcIfAvailable();
  return process.memoryUsage().heapUsed;
}

function requestGcIfAvailable(): void {
  const gc = (globalThis as { gc?: () => void }).gc;
  if (typeof gc === "function") gc();
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
