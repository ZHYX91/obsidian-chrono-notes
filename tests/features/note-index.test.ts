import { describe, expect, it, vi } from "vitest";

import type {
  NoteSource,
  NoteSourceEvent,
  NoteSourceListener,
} from "../../src/core/note/note-source";
import {
  selectIntervalNotes,
  selectIntervalWeekData,
} from "../../src/features/intervals/interval-note-query";
import {
  NoteIndex,
  type NoteIndexDiagnostics,
  type NoteIndexTimingDiagnostics,
} from "../../src/features/notes/note-index";

class Deferred<T> {
  readonly promise: Promise<T>;
  private resolvePromise!: (value: T) => void;
  private rejectPromise!: (reason: unknown) => void;

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolvePromise = resolve;
      this.rejectPromise = reject;
    });
  }

  resolve(value: T): void {
    this.resolvePromise(value);
  }

  reject(reason: unknown): void {
    this.rejectPromise(reason);
  }
}

class FakeNoteSource implements NoteSource {
  readonly read = vi.fn<(path: string) => Promise<string>>();
  paths: string[] = [];
  private readonly listeners = new Set<NoteSourceListener>();

  listPaths(): readonly string[] {
    return [...this.paths];
  }

  subscribe(listener: NoteSourceListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: NoteSourceEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  get listenerCount(): number {
    return this.listeners.size;
  }
}

function createDiagnostics(): NoteIndexDiagnostics {
  return {
    queuedEvents: 0,
    eventBatches: 0,
    reducedEventPaths: 0,
    reads: 0,
    documentParses: 0,
    parses: 0,
    materializations: 0,
    publishes: 0,
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

describe("NoteIndex", () => {
  it("rolls back a subscribe failure so start can be retried", async () => {
    const source = new FakeNoteSource();
    source.paths = ["Daily/retry.md"];
    source.read.mockResolvedValue("retry");
    const subscribe = source.subscribe.bind(source);
    vi.spyOn(source, "subscribe")
      .mockImplementationOnce(() => {
        throw new Error("subscribe failed");
      })
      .mockImplementation((listener) => subscribe(listener));
    const index = new NoteIndex(source);

    await expect(index.start()).rejects.toThrow("subscribe failed");
    expect(source.listenerCount).toBe(0);
    await expect(index.start()).resolves.toBeUndefined();

    expect(source.listenerCount).toBe(1);
    expect(index.get("Daily/retry.md")).toMatchObject({ kind: "parsed" });
  });

  it("unsubscribes and rolls back a list failure so start can be retried", async () => {
    const source = new FakeNoteSource();
    source.paths = ["Daily/retry.md"];
    source.read.mockResolvedValue("retry");
    const listPaths = source.listPaths.bind(source);
    vi.spyOn(source, "listPaths")
      .mockImplementationOnce(() => {
        throw new Error("list failed");
      })
      .mockImplementation(() => listPaths());
    const index = new NoteIndex(source);

    await expect(index.start()).rejects.toThrow("list failed");
    expect(source.listenerCount).toBe(0);
    expect(index.getSnapshot()).toEqual({
      version: 0,
      readiness: "indexing",
      notes: {},
      taskDates: { revision: 0, byDate: {} },
      intervals: { revision: 0, items: [] },
    });
    await expect(index.start()).resolves.toBeUndefined();

    expect(source.listenerCount).toBe(1);
    expect(index.get("Daily/retry.md")).toMatchObject({ kind: "parsed" });
  });

  it("indexes the initial source and exposes parsed notes through an immutable snapshot", async () => {
    const source = new FakeNoteSource();
    source.paths = ["Daily/2026-07-14.md"];
    source.read.mockResolvedValue("---\ntags: [daily]\n---\nHello");
    const index = new NoteIndex(source);

    await index.start();

    const snapshot = index.getSnapshot();
    expect(snapshot.version).toBe(1);
    expect(snapshot.notes["Daily/2026-07-14.md"]).toMatchObject({
      kind: "parsed",
      revision: 1,
      note: {
        path: "Daily/2026-07-14.md",
        state: "has-body",
      },
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.notes)).toBe(true);
    expect(Object.isFrozen(snapshot.notes["Daily/2026-07-14.md"])).toBe(true);
    const entry = snapshot.notes["Daily/2026-07-14.md"];
    expect(entry?.kind).toBe("parsed");
    if (entry?.kind !== "parsed") throw new Error("expected a parsed note");
    expect(Object.isFrozen(entry.note)).toBe(true);
  });

  it("collects phase timings only when an explicit timing sink is supplied", async () => {
    const source = new FakeNoteSource();
    source.paths = ["Daily/today.md"];
    source.read.mockResolvedValueOnce("initial").mockResolvedValueOnce("modified");
    const timings = createTimingDiagnostics();
    const diagnostics = { ...createDiagnostics(), timings };
    let tick = 0;
    const index = new NoteIndex(source, {
      diagnostics,
      diagnosticClock: () => tick++,
    });

    await index.start();
    source.emit({ type: "modify", path: "Daily/today.md" });
    await index.refresh("Daily/today.md");

    expect(timings).toMatchObject({
      listPathsMs: [1],
      readsMs: [1, 1],
      documentParsesMs: [1, 1],
      noteParsesMs: [1, 1],
      initialCommitsMs: [1],
      liveCommitsMs: [1],
      snapshotMaterializationsMs: [1, 1],
      listenerNotificationsMs: [1, 1],
    });
    expect(timings.initialIndexingMs).toHaveLength(1);
    expect(timings.initialIndexingMs[0]).toBeGreaterThan(1);

    const noTimingSource = new FakeNoteSource();
    noTimingSource.paths = ["Daily/quiet.md"];
    noTimingSource.read.mockResolvedValue("quiet");
    const diagnosticClock = vi.fn(() => 0);
    await new NoteIndex(noTimingSource, {
      diagnostics: createDiagnostics(),
      diagnosticClock,
    }).start();
    expect(diagnosticClock).not.toHaveBeenCalled();
  });

  it("keeps indexing correct when the diagnostic clock throws", async () => {
    const source = new FakeNoteSource();
    source.paths = ["Daily/today.md"];
    source.read.mockResolvedValue("content");
    const listener = vi.fn();
    const diagnosticClock = vi.fn(() => {
      throw new Error("diagnostic clock failed");
    });
    const index = new NoteIndex(source, {
      diagnostics: { ...createDiagnostics(), timings: createTimingDiagnostics() },
      diagnosticClock,
    });
    index.subscribe(listener);

    await index.start();

    expect(index.get("Daily/today.md")).toMatchObject({
      kind: "parsed",
      note: { document: { body: "content" } },
    });
    expect(index.getSnapshot().version).toBe(1);
    expect(listener).toHaveBeenCalledOnce();
    expect(diagnosticClock).toHaveBeenCalledOnce();
  });

  it("publishes and resolves refresh when a timing array rejects writes", async () => {
    const source = new FakeNoteSource();
    source.paths = ["Daily/today.md"];
    source.read.mockResolvedValueOnce("initial").mockResolvedValueOnce("modified");
    const timings = createTimingDiagnostics();
    timings.liveCommitsMs = Object.freeze([]) as unknown as number[];
    let tick = 0;
    const index = new NoteIndex(source, {
      diagnostics: { ...createDiagnostics(), timings },
      diagnosticClock: () => tick++,
    });
    await index.start();
    const listener = vi.fn();
    index.subscribe(listener);

    source.emit({ type: "modify", path: "Daily/today.md" });
    await index.refresh("Daily/today.md");

    expect(index.get("Daily/today.md")).toMatchObject({
      kind: "parsed",
      note: { document: { body: "modified" } },
    });
    expect(index.getSnapshot().version).toBe(2);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("publishes the complete initial index once after every unique path settles", async () => {
    const source = new FakeNoteSource();
    const firstRead = new Deferred<string>();
    const secondRead = new Deferred<string>();
    source.paths = ["Daily/first.md", "Daily/second.md", "Daily/first.md"];
    source.read.mockImplementation((path) => (
      path === "Daily/first.md" ? firstRead.promise : secondRead.promise
    ));
    const index = new NoteIndex(source);
    const listener = vi.fn();
    index.subscribe(listener);

    const starting = index.start();
    expect(source.read).toHaveBeenCalledTimes(2);

    firstRead.resolve("first");
    await firstRead.promise;
    await Promise.resolve();
    expect(index.getSnapshot()).toEqual({
      version: 0,
      readiness: "indexing",
      notes: {},
      taskDates: { revision: 0, byDate: {} },
      intervals: { revision: 0, items: [] },
    });
    expect(listener).not.toHaveBeenCalled();

    secondRead.reject(new Error("unreadable"));
    await starting;
    expect(index.getSnapshot()).toMatchObject({
      version: 1,
      notes: {
        "Daily/first.md": { kind: "parsed", note: { document: { body: "first" } } },
        "Daily/second.md": {
          kind: "error",
          revision: 1,
          error: { name: "Error", message: "unreadable" },
        },
      },
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("limits the default initial read pool to sixteen concurrent paths", async () => {
    const source = new FakeNoteSource();
    source.paths = Array.from({ length: 17 }, (_, index) => `Daily/${index}.md`);
    const reads = new Map(source.paths.map((path) => [path, new Deferred<string>()]));
    let activeReads = 0;
    let peakActiveReads = 0;
    source.read.mockImplementation((path) => {
      const read = reads.get(path);
      if (read === undefined) throw new Error(`unexpected path ${path}`);
      activeReads += 1;
      peakActiveReads = Math.max(peakActiveReads, activeReads);
      return read.promise.finally(() => {
        activeReads -= 1;
      });
    });
    const index = new NoteIndex(source);

    const starting = index.start();
    expect(source.read).toHaveBeenCalledTimes(16);
    expect(peakActiveReads).toBe(16);

    reads.get("Daily/0.md")?.resolve("first");
    await vi.waitFor(() => expect(source.read).toHaveBeenCalledTimes(17));
    for (const [path, read] of reads) read.resolve(path);
    await starting;

    expect(peakActiveReads).toBe(16);
    expect(Object.keys(index.getSnapshot().notes)).toHaveLength(17);
  });

  it("coalesces one thousand startup creates into the baseline and waits for them", async () => {
    const source = new FakeNoteSource();
    source.paths = Array.from({ length: 1_000 }, (_, index) => `Daily/${index}.md`);
    const gate = new Deferred<string>();
    let activeReads = 0;
    let peakActiveReads = 0;
    source.read.mockImplementation(async (path) => {
      activeReads += 1;
      peakActiveReads = Math.max(peakActiveReads, activeReads);
      try {
        await gate.promise;
        return path;
      } finally {
        activeReads -= 1;
      }
    });
    const index = new NoteIndex(source);
    let ready = false;

    const starting = index.start().then(() => {
      ready = true;
    });
    for (const path of source.paths) source.emit({ type: "create", path });
    await Promise.resolve();

    expect(ready).toBe(false);
    expect(source.read).toHaveBeenCalledTimes(16);
    expect(peakActiveReads).toBe(16);

    gate.resolve("ready");
    await starting;

    expect(source.read).toHaveBeenCalledTimes(1_000);
    expect(new Set(source.read.mock.calls.map(([path]) => path))).toEqual(
      new Set(source.paths),
    );
    expect(peakActiveReads).toBe(16);
    expect(Object.keys(index.getSnapshot().notes)).toHaveLength(1_000);
  });

  it("does not become ready before a nonbaseline startup create is indexed", async () => {
    const source = new FakeNoteSource();
    const read = new Deferred<string>();
    source.read.mockReturnValue(read.promise);
    const index = new NoteIndex(source);
    let ready = false;

    const starting = index.start().then(() => {
      ready = true;
    });
    source.emit({ type: "create", path: "Daily/discovered.md" });
    await vi.waitFor(() => expect(source.read).toHaveBeenCalledOnce());

    expect(ready).toBe(false);
    expect(index.get("Daily/discovered.md").kind).toBe("missing");

    read.resolve("discovered during startup");
    await starting;

    expect(index.get("Daily/discovered.md")).toMatchObject({
      kind: "parsed",
      note: { document: { body: "discovered during startup" } },
    });
  });

  it("reconciles buffered startup create, modify, rename, and delete events", async () => {
    const source = new FakeNoteSource();
    source.paths = ["Daily/deleted.md", "Daily/renamed.md", "Daily/modified.md"];
    const contents = new Map([
      ["Daily/final.md", "renamed"],
      ["Daily/modified.md", "modified"],
      ["Daily/created.md", "created"],
    ]);
    source.read.mockImplementation(async (path) => {
      const content = contents.get(path);
      if (content === undefined) throw new Error(`unexpected read for ${path}`);
      return content;
    });
    const subscribe = source.subscribe.bind(source);
    vi.spyOn(source, "subscribe").mockImplementation((listener) => {
      const unsubscribe = subscribe(listener);
      source.emit({ type: "delete", path: "Daily/deleted.md" });
      source.emit({
        type: "rename",
        oldPath: "Daily/renamed.md",
        path: "Daily/final.md",
      });
      source.emit({ type: "modify", path: "Daily/modified.md" });
      source.emit({ type: "create", path: "Daily/created.md" });
      return unsubscribe;
    });
    const index = new NoteIndex(source);

    await index.start();

    expect(source.read.mock.calls.map(([path]) => path).sort()).toEqual([
      "Daily/created.md",
      "Daily/final.md",
      "Daily/modified.md",
    ]);
    expect(Object.keys(index.getSnapshot().notes).sort()).toEqual([
      "Daily/created.md",
      "Daily/final.md",
      "Daily/modified.md",
    ]);
    expect(index.get("Daily/deleted.md").kind).toBe("missing");
    expect(index.get("Daily/renamed.md").kind).toBe("missing");
  });

  it("shares the read concurrency limit with a large live event batch", async () => {
    const source = new FakeNoteSource();
    const gate = new Deferred<string>();
    let activeReads = 0;
    let peakActiveReads = 0;
    source.read.mockImplementation(async (path) => {
      activeReads += 1;
      peakActiveReads = Math.max(peakActiveReads, activeReads);
      try {
        await gate.promise;
        return path;
      } finally {
        activeReads -= 1;
      }
    });
    const index = new NoteIndex(source, { readConcurrency: 4 });
    await index.start();
    const paths = Array.from({ length: 64 }, (_, index) => `Daily/live-${index}.md`);

    for (const path of paths) source.emit({ type: "create", path });
    await Promise.resolve();

    expect(source.read).toHaveBeenCalledTimes(4);
    expect(peakActiveReads).toBe(4);

    const settling = index.start();
    gate.resolve("ready");
    await settling;

    expect(source.read).toHaveBeenCalledTimes(64);
    expect(peakActiveReads).toBe(4);
    expect(Object.keys(index.getSnapshot().notes)).toHaveLength(64);
  });

  it.each([4, 5, 8, 64])(
    "publishes one fast %i-path live batch across a four-slot scheduler",
    async (pathCount) => {
      const source = new FakeNoteSource();
      source.read.mockImplementation(async (path) => path);
      const diagnostics = createDiagnostics();
      const checkpoints: Array<{
        callback: () => void;
        cancelled: boolean;
      }> = [];
      const index = new NoteIndex(source, {
        diagnostics,
        readConcurrency: 4,
        scheduleLiveCommitCheckpoint: (callback) => {
          const checkpoint = { callback, cancelled: false };
          checkpoints.push(checkpoint);
          return () => {
            checkpoint.cancelled = true;
          };
        },
      });
      await index.start();
      Object.assign(diagnostics, createDiagnostics());
      const paths = Array.from(
        { length: pathCount },
        (_, pathIndex) => `Daily/batch-${pathIndex}.md`,
      );
      for (const path of paths) source.emit({ type: "create", path });
      const refreshes = paths.map((path) => index.refresh(path));

      await vi.waitFor(() => expect(source.read).toHaveBeenCalledTimes(pathCount));
      expect(diagnostics.publishes).toBe(1);
      expect(checkpoints).toHaveLength(1);
      checkpoints[0]?.callback();
      await Promise.all(refreshes);

      expect(diagnostics.publishes).toBe(2);
      expect(Object.keys(index.getSnapshot().notes)).toHaveLength(pathCount);
    },
  );

  it("skips a queued initial path invalidated by a live event", async () => {
    const source = new FakeNoteSource();
    const blockedRead = new Deferred<string>();
    const liveRead = new Deferred<string>();
    source.paths = ["Daily/blocked.md", "Daily/queued.md"];
    source.read.mockImplementation((path) => (
      path === "Daily/blocked.md" ? blockedRead.promise : liveRead.promise
    ));
    const index = new NoteIndex(source, { initialReadConcurrency: 1 });

    const starting = index.start();
    expect(source.read.mock.calls.map(([path]) => path)).toEqual(["Daily/blocked.md"]);

    source.emit({ type: "modify", path: "Daily/queued.md" });
    await Promise.resolve();
    expect(source.read.mock.calls.map(([path]) => path)).toEqual(["Daily/blocked.md"]);

    blockedRead.resolve("initial blocker");
    await vi.waitFor(() => expect(source.read).toHaveBeenCalledTimes(2));
    liveRead.resolve("current live revision");
    await vi.waitFor(() => {
      expect(index.get("Daily/queued.md")).toMatchObject({
        kind: "parsed",
        revision: 2,
        note: { document: { body: "current live revision" } },
      });
    });

    await starting;
    expect(source.read).toHaveBeenCalledTimes(2);
    expect(Object.keys(index.getSnapshot().notes).sort()).toEqual([
      "Daily/blocked.md",
      "Daily/queued.md",
    ]);
  });

  it.each(["create", "modify"] as const)(
    "does not expose completed initial entries when a different-path %s publishes",
    async (eventType) => {
      const source = new FakeNoteSource();
      const firstRead = new Deferred<string>();
      const secondRead = new Deferred<string>();
      const liveRead = new Deferred<string>();
      source.paths = ["Daily/first.md", "Daily/second.md"];
      source.read.mockImplementation((path) => {
        if (path === "Daily/first.md") return firstRead.promise;
        if (path === "Daily/second.md") return secondRead.promise;
        return liveRead.promise;
      });
      const index = new NoteIndex(source);
      const listener = vi.fn();
      index.subscribe(listener);

      const starting = index.start();
      firstRead.resolve("first initial");
      await firstRead.promise;
      await Promise.resolve();

      source.emit({ type: eventType, path: "Daily/live.md" });
      liveRead.resolve("live");
      await vi.waitFor(() => expect(index.getSnapshot().version).toBe(1));
      expect(Object.keys(index.getSnapshot().notes)).toEqual(["Daily/live.md"]);
      expect(listener).toHaveBeenCalledTimes(1);

      secondRead.resolve("second initial");
      await starting;
      expect(Object.keys(index.getSnapshot().notes).sort()).toEqual([
        "Daily/first.md",
        "Daily/live.md",
        "Daily/second.md",
      ]);
      expect(index.getSnapshot().version).toBe(2);
      expect(listener).toHaveBeenCalledTimes(2);
    },
  );

  it("keeps the initial batch private until startup live work is ready", async () => {
    const source = new FakeNoteSource();
    const firstRead = new Deferred<string>();
    const secondRead = new Deferred<string>();
    const liveRead = new Deferred<string>();
    source.paths = ["Daily/first.md", "Daily/second.md"];
    source.read.mockImplementation((path) => {
      if (path === "Daily/first.md") return firstRead.promise;
      if (path === "Daily/second.md") return secondRead.promise;
      return liveRead.promise;
    });
    const index = new NoteIndex(source);

    let ready = false;
    const starting = index.start().then(() => {
      ready = true;
    });
    source.emit({ type: "create", path: "Daily/live.md" });
    firstRead.resolve("first initial");
    secondRead.resolve("second initial");
    await Promise.resolve();

    expect(Object.keys(index.getSnapshot().notes)).toEqual([]);
    expect(index.getSnapshot().readiness).toBe("indexing");
    expect(index.getSnapshot().version).toBe(0);
    expect(ready).toBe(false);

    liveRead.resolve("live");
    await starting;
    expect(Object.keys(index.getSnapshot().notes).sort()).toEqual([
      "Daily/first.md",
      "Daily/live.md",
      "Daily/second.md",
    ]);
  });

  it("publishes notes, task dates, and intervals from one atomic initial/live boundary", async () => {
    const source = new FakeNoteSource();
    const stagedRead = new Deferred<string>();
    const blockedRead = new Deferred<string>();
    const liveRead = new Deferred<string>();
    source.paths = ["Ranges/staged.md", "Daily/blocked.md"];
    source.read.mockImplementation((path) => {
      if (path === "Ranges/staged.md") return stagedRead.promise;
      if (path === "Daily/blocked.md") return blockedRead.promise;
      return liveRead.promise;
    });
    const index = new NoteIndex(source);

    const starting = index.start();
    stagedRead.resolve([
      "---",
      "start: 2026-01-01",
      "end: 2026-01-03",
      "---",
      "- [ ] staged 📅 2026-01-02",
    ].join("\n"));
    await stagedRead.promise;
    await Promise.resolve();

    source.emit({ type: "create", path: "Ranges/live.md" });
    liveRead.resolve([
      "---",
      "start: 2026-02-01",
      "end: 2026-02-03",
      "---",
      "- [ ] live 📅 2026-02-02",
    ].join("\n"));
    await vi.waitFor(() => expect(index.getSnapshot().version).toBe(1));
    const liveSnapshot = index.getSnapshot();
    expect(Object.keys(liveSnapshot.notes)).toEqual(["Ranges/live.md"]);
    expect(Object.keys(liveSnapshot.taskDates.byDate)).toEqual(["2026-02-02"]);
    expect(liveSnapshot.intervals.items.map((item) => item.path))
      .toEqual(["Ranges/live.md"]);

    blockedRead.resolve("blocked initial");
    await starting;
    const completeSnapshot = index.getSnapshot();
    expect(Object.keys(completeSnapshot.notes).sort()).toEqual([
      "Daily/blocked.md",
      "Ranges/live.md",
      "Ranges/staged.md",
    ]);
    expect(Object.keys(completeSnapshot.taskDates.byDate).sort()).toEqual([
      "2026-01-02",
      "2026-02-02",
    ]);
    expect(completeSnapshot.intervals.items.map((item) => item.path)).toEqual([
      "Ranges/staged.md",
      "Ranges/live.md",
    ]);
  });

  it("discards an initial result that returns before a pending same-path live read", async () => {
    const source = new FakeNoteSource();
    const initialRead = new Deferred<string>();
    const liveRead = new Deferred<string>();
    source.paths = ["Daily/today.md"];
    source.read.mockReturnValueOnce(initialRead.promise).mockReturnValueOnce(liveRead.promise);
    const index = new NoteIndex(source);

    let ready = false;
    const starting = index.start().then(() => {
      ready = true;
    });
    source.emit({ type: "modify", path: "Daily/today.md" });
    initialRead.resolve("stale initial");
    await vi.waitFor(() => expect(source.read).toHaveBeenCalledTimes(2));

    expect(index.getSnapshot()).toEqual({
      version: 0,
      readiness: "indexing",
      notes: {},
      taskDates: { revision: 0, byDate: {} },
      intervals: { revision: 0, items: [] },
    });
    expect(ready).toBe(false);

    liveRead.resolve("current live");
    await starting;
    expect(index.get("Daily/today.md")).toMatchObject({
      kind: "parsed",
      revision: 2,
      note: { document: { body: "current live" } },
    });
    expect(index.getSnapshot().version).toBe(2);
  });

  it("does not expose staged entries when a live entry is deleted during initial indexing", async () => {
    const source = new FakeNoteSource();
    const stagedRead = new Deferred<string>();
    const blockedRead = new Deferred<string>();
    source.paths = ["Daily/staged.md", "Daily/blocked.md"];
    source.read.mockImplementation((path) => {
      if (path === "Daily/staged.md") return stagedRead.promise;
      if (path === "Daily/blocked.md") return blockedRead.promise;
      return Promise.resolve("live");
    });
    const index = new NoteIndex(source);

    const starting = index.start();
    stagedRead.resolve("staged");
    await stagedRead.promise;
    await Promise.resolve();
    source.emit({ type: "create", path: "Daily/live.md" });
    await vi.waitFor(() => expect(index.getSnapshot().version).toBe(1));
    expect(Object.keys(index.getSnapshot().notes)).toEqual(["Daily/live.md"]);

    source.emit({ type: "delete", path: "Daily/live.md" });
    expect(index.getSnapshot()).toEqual({
      version: 2,
      readiness: "indexing",
      notes: {},
      taskDates: { revision: 0, byDate: {} },
      intervals: { revision: 0, items: [] },
    });

    blockedRead.resolve("blocked");
    await starting;
    expect(Object.keys(index.getSnapshot().notes).sort()).toEqual([
      "Daily/blocked.md",
      "Daily/staged.md",
    ]);
  });

  it("keeps initial read failures staged until the complete initial batch commits", async () => {
    const source = new FakeNoteSource();
    const failedRead = new Deferred<string>();
    const blockedRead = new Deferred<string>();
    source.paths = ["Daily/failed.md", "Daily/blocked.md"];
    source.read.mockImplementation((path) => {
      if (path === "Daily/failed.md") return failedRead.promise;
      if (path === "Daily/blocked.md") return blockedRead.promise;
      return Promise.resolve("live");
    });
    const index = new NoteIndex(source);

    const starting = index.start();
    failedRead.reject(new Error("initial failure"));
    await expect(failedRead.promise).rejects.toThrow("initial failure");
    await Promise.resolve();

    source.emit({ type: "create", path: "Daily/live.md" });
    await vi.waitFor(() => expect(index.getSnapshot().version).toBe(1));
    expect(Object.keys(index.getSnapshot().notes)).toEqual(["Daily/live.md"]);

    blockedRead.resolve("blocked initial");
    await starting;
    expect(index.get("Daily/failed.md")).toMatchObject({
      kind: "error",
      revision: 1,
      error: { message: "initial failure" },
    });
    expect(Object.keys(index.getSnapshot().notes).sort()).toEqual([
      "Daily/blocked.md",
      "Daily/failed.md",
      "Daily/live.md",
    ]);
  });

  it("publishes a live read failure without exposing staged initial entries", async () => {
    const source = new FakeNoteSource();
    const stagedRead = new Deferred<string>();
    const blockedRead = new Deferred<string>();
    source.paths = ["Daily/staged.md", "Daily/blocked.md"];
    source.read.mockImplementation((path) => {
      if (path === "Daily/staged.md") return stagedRead.promise;
      if (path === "Daily/blocked.md") return blockedRead.promise;
      return Promise.reject(new Error("live failure"));
    });
    const index = new NoteIndex(source);

    const starting = index.start();
    stagedRead.resolve("staged");
    await stagedRead.promise;
    await Promise.resolve();
    source.emit({ type: "modify", path: "Daily/live.md" });

    await vi.waitFor(() => expect(index.getSnapshot().version).toBe(1));
    expect(Object.keys(index.getSnapshot().notes)).toEqual(["Daily/live.md"]);
    expect(index.get("Daily/live.md")).toMatchObject({
      kind: "error",
      revision: 1,
      error: { message: "live failure" },
    });

    blockedRead.resolve("blocked");
    await starting;
    expect(Object.keys(index.getSnapshot().notes).sort()).toEqual([
      "Daily/blocked.md",
      "Daily/live.md",
      "Daily/staged.md",
    ]);
  });

  it("invalidates a completed staged entry when it is deleted before initial commit", async () => {
    const source = new FakeNoteSource();
    const deletedRead = new Deferred<string>();
    const blockedRead = new Deferred<string>();
    source.paths = ["Daily/deleted.md", "Daily/blocked.md"];
    source.read.mockImplementation((path) => (
      path === "Daily/deleted.md" ? deletedRead.promise : blockedRead.promise
    ));
    const index = new NoteIndex(source);
    const listener = vi.fn();
    index.subscribe(listener);

    const starting = index.start();
    deletedRead.resolve("staged then deleted");
    await deletedRead.promise;
    await Promise.resolve();
    source.emit({ type: "delete", path: "Daily/deleted.md" });

    expect(index.getSnapshot()).toEqual({
      version: 0,
      readiness: "indexing",
      notes: {},
      taskDates: { revision: 0, byDate: {} },
      intervals: { revision: 0, items: [] },
    });
    expect(listener).not.toHaveBeenCalled();

    blockedRead.resolve("survives");
    await starting;
    expect(Object.keys(index.getSnapshot().notes)).toEqual(["Daily/blocked.md"]);
    expect(index.get("Daily/deleted.md").kind).toBe("missing");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not leak staged entries when a completed initial path is renamed", async () => {
    const source = new FakeNoteSource();
    const renamedRead = new Deferred<string>();
    const blockedRead = new Deferred<string>();
    const liveRead = new Deferred<string>();
    source.paths = ["Daily/old.md", "Daily/blocked.md"];
    source.read.mockImplementation((path) => {
      if (path === "Daily/old.md") return renamedRead.promise;
      if (path === "Daily/blocked.md") return blockedRead.promise;
      return liveRead.promise;
    });
    const index = new NoteIndex(source);

    const starting = index.start();
    renamedRead.resolve("old staged content");
    await renamedRead.promise;
    await Promise.resolve();
    source.emit({ type: "rename", oldPath: "Daily/old.md", path: "Daily/new.md" });
    liveRead.resolve("renamed live content");

    await vi.waitFor(() => expect(index.getSnapshot().version).toBe(1));
    expect(Object.keys(index.getSnapshot().notes)).toEqual(["Daily/new.md"]);

    blockedRead.resolve("blocked initial");
    await starting;
    expect(Object.keys(index.getSnapshot().notes).sort()).toEqual([
      "Daily/blocked.md",
      "Daily/new.md",
    ]);
    expect(index.get("Daily/old.md").kind).toBe("missing");
  });

  it("discards a completed staged revision when the same path is modified", async () => {
    const source = new FakeNoteSource();
    const initialRead = new Deferred<string>();
    const blockedRead = new Deferred<string>();
    const modifiedRead = new Deferred<string>();
    let todayReadCount = 0;
    source.paths = ["Daily/today.md", "Daily/blocked.md"];
    source.read.mockImplementation((path) => {
      if (path === "Daily/blocked.md") return blockedRead.promise;
      todayReadCount += 1;
      return todayReadCount === 1 ? initialRead.promise : modifiedRead.promise;
    });
    const index = new NoteIndex(source);

    const starting = index.start();
    initialRead.resolve("staged revision");
    await initialRead.promise;
    await Promise.resolve();
    source.emit({ type: "modify", path: "Daily/today.md" });
    modifiedRead.resolve("live revision");

    await vi.waitFor(() => {
      expect(index.get("Daily/today.md")).toMatchObject({
        kind: "parsed",
        revision: 2,
        note: { document: { body: "live revision" } },
      });
    });
    expect(Object.keys(index.getSnapshot().notes)).toEqual(["Daily/today.md"]);

    blockedRead.resolve("blocked initial");
    await starting;
    expect(index.get("Daily/today.md")).toMatchObject({
      kind: "parsed",
      revision: 2,
      note: { document: { body: "live revision" } },
    });
    expect(Object.keys(index.getSnapshot().notes).sort()).toEqual([
      "Daily/blocked.md",
      "Daily/today.md",
    ]);
  });

  it("isolates subscriber failures during fire-and-forget source events", async () => {
    const source = new FakeNoteSource();
    source.read.mockResolvedValue("updated");
    const index = new NoteIndex(source);
    await index.start();
    const listenerError = new Error("broken subscriber");
    const reportError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failingListener = vi.fn(() => {
      throw listenerError;
    });
    const remainingListener = vi.fn();
    index.subscribe(failingListener);
    index.subscribe(remainingListener);

    source.emit({ type: "modify", path: "Daily/today.md" });

    await vi.waitFor(() => {
      expect(index.get("Daily/today.md")).toMatchObject({
        kind: "parsed",
        note: { document: { body: "updated" } },
      });
    });
    expect(failingListener).toHaveBeenCalledTimes(3);
    expect(remainingListener).toHaveBeenCalledTimes(3);
    expect(reportError).toHaveBeenCalledWith(
      "Chrono Notes: listener notification failed",
      listenerError,
    );
    reportError.mockRestore();
  });

  it("keeps concurrent start and refresh calls inside the initial publication boundary", async () => {
    const source = new FakeNoteSource();
    const firstRead = new Deferred<string>();
    const secondRead = new Deferred<string>();
    source.paths = ["Daily/first.md", "Daily/second.md"];
    source.read.mockImplementation((path) => (
      path === "Daily/first.md" ? firstRead.promise : secondRead.promise
    ));
    const index = new NoteIndex(source);
    const listener = vi.fn();
    index.subscribe(listener);

    const firstStart = index.start();
    const secondStart = index.start();
    const refresh = index.refresh("Daily/first.md");
    expect(source.read).toHaveBeenCalledTimes(2);

    firstRead.resolve("first");
    await firstRead.promise;
    await Promise.resolve();
    expect(index.getSnapshot().version).toBe(0);

    secondRead.resolve("second");
    await Promise.all([firstStart, secondStart, refresh]);
    expect(index.getSnapshot().version).toBe(1);
    expect(Object.keys(index.getSnapshot().notes)).toHaveLength(2);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not let an initial read overwrite or republish a newer source event", async () => {
    const source = new FakeNoteSource();
    const initialRead = new Deferred<string>();
    const modifiedRead = new Deferred<string>();
    source.paths = ["Daily/today.md"];
    source.read.mockReturnValueOnce(initialRead.promise).mockReturnValueOnce(modifiedRead.promise);
    const index = new NoteIndex(source);
    const listener = vi.fn();
    index.subscribe(listener);

    const starting = index.start();
    source.emit({ type: "modify", path: "Daily/today.md" });
    modifiedRead.resolve("new revision");
    await vi.waitFor(() => {
      expect(index.get("Daily/today.md")).toMatchObject({
        kind: "parsed",
        revision: 2,
        note: { document: { body: "new revision" } },
      });
    });

    initialRead.resolve("stale initial revision");
    await starting;
    expect(index.get("Daily/today.md")).toMatchObject({
      kind: "parsed",
      revision: 2,
      note: { document: { body: "new revision" } },
    });
    expect(index.getSnapshot().version).toBe(2);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("discards unpublished initial work when stopped before the batch completes", async () => {
    const source = new FakeNoteSource();
    const firstRead = new Deferred<string>();
    const secondRead = new Deferred<string>();
    source.paths = ["Daily/first.md", "Daily/second.md"];
    source.read.mockImplementation((path) => (
      path === "Daily/first.md" ? firstRead.promise : secondRead.promise
    ));
    const index = new NoteIndex(source);
    const listener = vi.fn();
    index.subscribe(listener);

    const starting = index.start();
    firstRead.resolve("first");
    await firstRead.promise;
    await Promise.resolve();
    index.stop();

    secondRead.resolve("too late");
    await starting;
    expect(index.getSnapshot()).toEqual({
      version: 0,
      readiness: "indexing",
      notes: {},
      taskDates: { revision: 0, byDate: {} },
      intervals: { revision: 0, items: [] },
    });
    expect(index.get("Daily/first.md").kind).toBe("missing");
    expect(index.get("Daily/second.md").kind).toBe("missing");
    expect(listener).not.toHaveBeenCalled();
  });

  it("does not revive an old lifecycle after start, stop, and start", async () => {
    const source = new FakeNoteSource();
    const oldRead = new Deferred<string>();
    const newRead = new Deferred<string>();
    source.paths = ["Daily/old.md", "Daily/old-queued.md"];
    source.read.mockImplementation((path) => {
      if (path === "Daily/old.md") return oldRead.promise;
      if (path === "Daily/new.md") return newRead.promise;
      throw new Error(`unexpected read for ${path}`);
    });
    const index = new NoteIndex(source, { initialReadConcurrency: 1 });
    const listener = vi.fn();
    index.subscribe(listener);

    const oldStart = index.start();
    expect(source.read.mock.calls.map(([path]) => path)).toEqual(["Daily/old.md"]);
    index.stop();
    source.paths = ["Daily/new.md"];
    const newStart = index.start();
    expect(source.read.mock.calls.map(([path]) => path)).toEqual([
      "Daily/old.md",
      "Daily/new.md",
    ]);

    oldRead.resolve("old lifecycle");
    await oldStart;
    source.emit({ type: "create", path: "Daily/new.md" });
    await Promise.resolve();
    expect(source.read.mock.calls.map(([path]) => path)).toEqual([
      "Daily/old.md",
      "Daily/new.md",
    ]);

    newRead.resolve("new lifecycle");
    await newStart;
    expect(Object.keys(index.getSnapshot().notes)).toEqual(["Daily/new.md"]);
    expect(index.getSnapshot().version).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("releases per-path revisions when a stopped index is started again", async () => {
    const source = new FakeNoteSource();
    source.paths = ["Daily/reused.md"];
    source.read.mockResolvedValue("same path in a new lifecycle");
    const index = new NoteIndex(source);

    await index.start();
    expect(index.getSnapshot().notes["Daily/reused.md"]?.revision).toBe(1);

    index.stop();
    await index.start();

    expect(index.getSnapshot().notes["Daily/reused.md"]?.revision).toBe(1);
    index.stop();
  });

  it("reuses an in-flight read for concurrent refreshes of the same revision", async () => {
    const source = new FakeNoteSource();
    const read = new Deferred<string>();
    source.read.mockReturnValue(read.promise);
    const index = new NoteIndex(source);
    await index.start();

    const first = index.refresh("Daily/today.md");
    const second = index.refresh("Daily/today.md");

    expect(source.read).toHaveBeenCalledTimes(1);
    read.resolve("new content");
    await Promise.all([first, second]);
    expect(index.get("Daily/today.md")).toMatchObject({
      kind: "parsed",
      note: { state: "has-body" },
    });
  });

  it("reduces create and modify events for one path to one live read", async () => {
    const source = new FakeNoteSource();
    source.read.mockResolvedValue("latest content");
    const diagnostics = createDiagnostics();
    const index = new NoteIndex(source, { diagnostics });
    await index.start();

    source.emit({ type: "create", path: "Daily/today.md" });
    source.emit({ type: "modify", path: "Daily/today.md" });

    expect(source.read).not.toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(index.get("Daily/today.md")).toMatchObject({
        kind: "parsed",
        revision: 2,
        note: { document: { body: "latest content" } },
      });
    });
    expect(diagnostics).toEqual({
      queuedEvents: 2,
      eventBatches: 1,
      reducedEventPaths: 1,
      reads: 1,
      documentParses: 1,
      parses: 1,
      materializations: 1,
      publishes: 4,
    });
  });

  it("reduces create followed by delete to no read while restoring readiness", async () => {
    const source = new FakeNoteSource();
    source.read.mockResolvedValue("must not be read");
    const diagnostics = createDiagnostics();
    const readinessCheckpoints: Array<() => void> = [];
    const index = new NoteIndex(source, {
      diagnostics,
      scheduleReadinessCheckpoint: (callback) => {
        readinessCheckpoints.push(callback);
        return () => undefined;
      },
    });
    await index.start();
    const initialSnapshot = index.getSnapshot();
    Object.assign(diagnostics, createDiagnostics());

    source.emit({ type: "create", path: "Daily/transient.md" });
    source.emit({ type: "delete", path: "Daily/transient.md" });
    await Promise.resolve();
    await Promise.resolve();

    expect(source.read).not.toHaveBeenCalled();
    expect(index.getSnapshot().readiness).toBe("indexing");
    expect(index.getSnapshot().notes).toBe(initialSnapshot.notes);
    expect(readinessCheckpoints).toHaveLength(1);
    readinessCheckpoints[0]?.();
    expect(index.getSnapshot().readiness).toBe("ready");
    expect(diagnostics).toEqual({
      queuedEvents: 2,
      eventBatches: 1,
      reducedEventPaths: 1,
      reads: 0,
      documentParses: 0,
      parses: 0,
      materializations: 0,
      publishes: 2,
    });
  });

  it("publishes a delete barrier before one final recreate read", async () => {
    const source = new FakeNoteSource();
    let content = "before";
    source.paths = ["Daily/today.md"];
    source.read.mockImplementation(async () => content);
    const diagnostics = createDiagnostics();
    const index = new NoteIndex(source, { diagnostics });
    await index.start();
    const listener = vi.fn();
    index.subscribe(listener);
    content = "after";

    source.emit({ type: "delete", path: "Daily/today.md" });
    expect(index.get("Daily/today.md").kind).toBe("missing");
    expect(index.getSnapshot().version).toBe(2);
    expect(listener).toHaveBeenCalledTimes(1);
    source.emit({ type: "create", path: "Daily/today.md" });

    await vi.waitFor(() => {
      expect(index.get("Daily/today.md")).toMatchObject({
        kind: "parsed",
        revision: 3,
        note: { document: { body: "after" } },
      });
    });
    expect(source.read).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalledTimes(4);
    expect(diagnostics.queuedEvents).toBe(2);
    expect(diagnostics.publishes).toBe(5);
  });

  it("keeps chained rename barriers and reads only the final path", async () => {
    const source = new FakeNoteSource();
    const contents = new Map<string, string>([["Daily/A.md", "same content"]]);
    source.paths = ["Daily/A.md"];
    source.read.mockImplementation(async (path) => {
      const content = contents.get(path);
      if (content === undefined) throw new Error(`missing ${path}`);
      return content;
    });
    const diagnostics = createDiagnostics();
    const index = new NoteIndex(source, { diagnostics });
    await index.start();
    const listener = vi.fn();
    index.subscribe(listener);
    source.read.mockClear();
    contents.delete("Daily/A.md");
    contents.set("Daily/C.md", "same content");

    source.emit({ type: "rename", oldPath: "Daily/A.md", path: "Daily/B.md" });
    expect(index.get("Daily/A.md").kind).toBe("missing");
    expect(index.getSnapshot().version).toBe(2);
    source.emit({ type: "rename", oldPath: "Daily/B.md", path: "Daily/C.md" });
    expect(source.read).not.toHaveBeenCalled();

    await vi.waitFor(() => expect(index.get("Daily/C.md").kind).toBe("parsed"));
    expect(source.read.mock.calls.map(([path]) => path)).toEqual(["Daily/C.md"]);
    expect(index.get("Daily/B.md").kind).toBe("missing");
    expect(listener).toHaveBeenCalledTimes(3);
    expect(diagnostics.parses).toBe(2);
  });

  it("retains forced parsing when a rename target is modified in the same batch", async () => {
    const source = new FakeNoteSource();
    source.paths = ["Daily/A.md", "Daily/B.md"];
    source.read.mockResolvedValue("identical content");
    const diagnostics = createDiagnostics();
    const index = new NoteIndex(source, { diagnostics });
    await index.start();
    const previousTarget = index.getSnapshot().notes["Daily/B.md"];
    source.read.mockClear();

    source.emit({ type: "rename", oldPath: "Daily/A.md", path: "Daily/B.md" });
    source.emit({ type: "modify", path: "Daily/B.md" });

    await vi.waitFor(() => {
      expect(index.getSnapshot().notes["Daily/B.md"]).not.toBe(previousTarget);
    });
    expect(source.read.mock.calls.map(([path]) => path)).toEqual(["Daily/B.md"]);
    expect(index.get("Daily/A.md").kind).toBe("missing");
    expect(diagnostics.parses).toBe(3);
  });

  it("cancels a pending rename-target read when that target is deleted", async () => {
    const source = new FakeNoteSource();
    source.paths = ["Daily/A.md"];
    source.read.mockResolvedValue("content");
    const index = new NoteIndex(source);
    await index.start();
    const listener = vi.fn();
    index.subscribe(listener);
    source.read.mockClear();

    source.emit({ type: "rename", oldPath: "Daily/A.md", path: "Daily/B.md" });
    source.emit({ type: "delete", path: "Daily/B.md" });
    await Promise.resolve();
    await Promise.resolve();

    expect(source.read).not.toHaveBeenCalled();
    expect(index.get("Daily/A.md").kind).toBe("missing");
    expect(index.get("Daily/B.md").kind).toBe("missing");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("reduces a temporary-path file swap to one read per final path", async () => {
    const source = new FakeNoteSource();
    const contents = new Map<string, string>([
      ["Daily/A.md", "A content"],
      ["Daily/B.md", "B content"],
    ]);
    source.paths = [...contents.keys()];
    source.read.mockImplementation(async (path) => {
      const content = contents.get(path);
      if (content === undefined) throw new Error(`missing ${path}`);
      return content;
    });
    const index = new NoteIndex(source);
    await index.start();
    const listener = vi.fn();
    index.subscribe(listener);
    source.read.mockClear();
    contents.set("Daily/A.md", "B content");
    contents.set("Daily/B.md", "A content");

    source.emit({ type: "rename", oldPath: "Daily/A.md", path: "Daily/temp.md" });
    expect(index.get("Daily/A.md").kind).toBe("missing");
    source.emit({ type: "rename", oldPath: "Daily/B.md", path: "Daily/A.md" });
    expect(index.get("Daily/B.md").kind).toBe("missing");
    source.emit({ type: "rename", oldPath: "Daily/temp.md", path: "Daily/B.md" });

    await vi.waitFor(() => {
      expect(index.get("Daily/A.md")).toMatchObject({
        kind: "parsed",
        note: { document: { body: "B content" } },
      });
      expect(index.get("Daily/B.md")).toMatchObject({
        kind: "parsed",
        note: { document: { body: "A content" } },
      });
    });
    expect(source.read.mock.calls.map(([path]) => path).sort()).toEqual([
      "Daily/A.md",
      "Daily/B.md",
    ]);
    expect(index.get("Daily/temp.md").kind).toBe("missing");
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it("publishes live reads completed together once without waiting for a slow path", async () => {
    const source = new FakeNoteSource();
    const reads = new Map([
      ["Daily/fast-a.md", new Deferred<string>()],
      ["Daily/fast-b.md", new Deferred<string>()],
      ["Daily/slow.md", new Deferred<string>()],
    ]);
    source.read.mockImplementation((path) => {
      const read = reads.get(path);
      if (read === undefined) throw new Error(`unexpected path ${path}`);
      return read.promise;
    });
    const diagnostics = createDiagnostics();
    const index = new NoteIndex(source, { diagnostics });
    await index.start();
    const firstListener = vi.fn();
    const secondListener = vi.fn();
    index.subscribe(firstListener);
    index.subscribe(secondListener);

    source.emit({ type: "create", path: "Daily/fast-a.md" });
    source.emit({ type: "create", path: "Daily/fast-b.md" });
    source.emit({ type: "create", path: "Daily/slow.md" });
    await Promise.resolve();
    expect(source.read).toHaveBeenCalledTimes(3);

    reads.get("Daily/fast-a.md")?.resolve("fast a");
    reads.get("Daily/fast-b.md")?.resolve("fast b");
    await vi.waitFor(() => {
      expect(Object.keys(index.getSnapshot().notes).sort()).toEqual([
        "Daily/fast-a.md",
        "Daily/fast-b.md",
      ]);
    });
    expect(index.getSnapshot().version).toBe(3);
    expect(firstListener).toHaveBeenCalledTimes(2);
    expect(secondListener).toHaveBeenCalledTimes(2);

    reads.get("Daily/slow.md")?.resolve("slow");
    await vi.waitFor(() => expect(index.get("Daily/slow.md").kind).toBe("parsed"));
    await vi.waitFor(() => expect(index.getSnapshot().readiness).toBe("ready"));
    expect(index.getSnapshot().version).toBe(5);
    expect(firstListener).toHaveBeenCalledTimes(4);
    expect(secondListener).toHaveBeenCalledTimes(4);
    expect(diagnostics.materializations).toBe(2);
    expect(diagnostics.publishes).toBe(5);
  });

  it("joins a pending event read and resolves refresh after publication", async () => {
    const source = new FakeNoteSource();
    const read = new Deferred<string>();
    source.read.mockReturnValue(read.promise);
    const index = new NoteIndex(source);
    await index.start();
    const listener = vi.fn();
    index.subscribe(listener);

    source.emit({ type: "modify", path: "Daily/today.md" });
    const refreshing = index.refresh("Daily/today.md");
    expect(source.read).toHaveBeenCalledTimes(1);
    read.resolve("published content");
    await refreshing;

    expect(index.get("Daily/today.md")).toMatchObject({
      kind: "parsed",
      note: { document: { body: "published content" } },
    });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("lets an explicit refresh supersede a queued missing intent", async () => {
    const source = new FakeNoteSource();
    source.paths = ["Daily/today.md"];
    source.read
      .mockResolvedValueOnce("existing")
      .mockRejectedValueOnce(new Error("still missing"));
    const index = new NoteIndex(source);
    await index.start();

    source.emit({ type: "delete", path: "Daily/today.md" });
    const refreshing = index.refresh("Daily/today.md");
    expect(index.get("Daily/today.md").kind).toBe("missing");
    await refreshing;

    expect(index.get("Daily/today.md")).toMatchObject({
      kind: "error",
      path: "Daily/today.md",
      error: { message: "still missing" },
    });
    expect(source.read).toHaveBeenCalledTimes(2);
  });

  it("publishes the missing barrier before a successful explicit reread", async () => {
    const source = new FakeNoteSource();
    source.paths = ["Daily/today.md"];
    source.read
      .mockResolvedValueOnce("existing")
      .mockResolvedValueOnce("recreated");
    const index = new NoteIndex(source);
    await index.start();
    const observedKinds: string[] = [];
    index.subscribe(() => {
      observedKinds.push(index.get("Daily/today.md").kind);
    });

    source.emit({ type: "delete", path: "Daily/today.md" });
    await index.refresh("Daily/today.md");

    expect(observedKinds).toEqual(["missing", "missing", "parsed"]);
    expect(index.get("Daily/today.md")).toMatchObject({
      kind: "parsed",
      note: { document: { body: "recreated" } },
    });
  });

  it("keeps every public identity stable for a no-op modify", async () => {
    const source = new FakeNoteSource();
    let content = [
      "---",
      "start: 2026-07-20",
      "end: 2026-07-21",
      "---",
      "- [ ] unchanged 📅 2026-07-20",
    ].join("\n");
    source.paths = ["Ranges/unchanged.md"];
    source.read.mockImplementation(async () => content);
    const diagnostics = createDiagnostics();
    const index = new NoteIndex(source, { diagnostics });
    await index.start();
    const listener = vi.fn();
    index.subscribe(listener);
    const before = index.getSnapshot();
    const beforeEntry = before.notes["Ranges/unchanged.md"];
    content = content
      .replace("---\n", "---  \n")
      .replace("\n---\n", "\n...  \n");

    source.emit({ type: "modify", path: "Ranges/unchanged.md" });
    await index.refresh("Ranges/unchanged.md");

    const after = index.getSnapshot();
    expect(after).toBe(before);
    expect(after.notes).toBe(before.notes);
    expect(after.notes["Ranges/unchanged.md"]).toBe(beforeEntry);
    expect(after.taskDates).toBe(before.taskDates);
    expect(after.intervals).toBe(before.intervals);
    expect(listener).not.toHaveBeenCalled();
    expect(diagnostics).toEqual({
      queuedEvents: 1,
      eventBatches: 1,
      reducedEventPaths: 1,
      reads: 2,
      documentParses: 2,
      parses: 1,
      materializations: 1,
      publishes: 1,
    });
  });

  it("treats line-ending changes as a full canonical document change", async () => {
    const source = new FakeNoteSource();
    let content = "first\nsecond";
    source.paths = ["Daily/today.md"];
    source.read.mockImplementation(async () => content);
    const diagnostics = createDiagnostics();
    const index = new NoteIndex(source, { diagnostics });
    await index.start();
    const before = index.getSnapshot();
    content = "first\r\nsecond";

    source.emit({ type: "modify", path: "Daily/today.md" });
    await index.refresh("Daily/today.md");

    expect(index.getSnapshot()).not.toBe(before);
    expect(index.getSnapshot().notes["Daily/today.md"]).toMatchObject({
      kind: "parsed",
      note: { document: { body: "first\nsecond", lineEnding: "crlf" } },
    });
    expect(diagnostics.parses).toBe(2);
    expect(diagnostics.publishes).toBe(2);
  });

  it("fully parses a successful read when recovering from an error", async () => {
    const source = new FakeNoteSource();
    source.paths = ["Daily/today.md"];
    source.read
      .mockRejectedValueOnce(new Error("temporarily unavailable"))
      .mockResolvedValueOnce("recovered");
    const diagnostics = createDiagnostics();
    const index = new NoteIndex(source, { diagnostics });
    await index.start();
    expect(index.get("Daily/today.md").kind).toBe("error");

    source.emit({ type: "modify", path: "Daily/today.md" });
    await index.refresh("Daily/today.md");

    expect(index.get("Daily/today.md")).toMatchObject({
      kind: "parsed",
      note: { document: { body: "recovered" } },
    });
    expect(diagnostics).toMatchObject({
      reads: 2,
      documentParses: 1,
      parses: 1,
      materializations: 2,
      publishes: 2,
    });
  });

  it("never lets an older asynchronous result overwrite a newer revision", async () => {
    const source = new FakeNoteSource();
    const oldRead = new Deferred<string>();
    const newRead = new Deferred<string>();
    source.read.mockReturnValueOnce(oldRead.promise).mockReturnValueOnce(newRead.promise);
    const index = new NoteIndex(source);
    await index.start();

    source.emit({ type: "create", path: "Daily/today.md" });
    await Promise.resolve();
    source.emit({ type: "modify", path: "Daily/today.md" });
    await Promise.resolve();
    expect(source.read).toHaveBeenCalledTimes(2);

    newRead.resolve([
      "---",
      "start: 2026-08-01",
      "end: 2026-08-03",
      "---",
      "- [x] new revision",
      "- [ ] remaining",
    ].join("\n"));
    await vi.waitFor(() => {
      expect(index.get("Daily/today.md")).toMatchObject({
        kind: "parsed",
        revision: 2,
        note: {
          document: { body: "- [x] new revision\n- [ ] remaining" },
          interval: {
            start: { dateKey: "2026-08-01" },
            end: { dateKey: "2026-08-03" },
          },
          tasks: [{ completed: true }, { completed: false }],
          statistics: {
            taskTotal: 2,
            taskCompleted: 1,
            taskCompletionRate: 50,
          },
        },
      });
    });

    oldRead.resolve("---\nstart: 2025-01-01\nend: 2025-01-20\n---\n- [ ] stale revision");
    await oldRead.promise;
    await Promise.resolve();
    expect(index.get("Daily/today.md")).toMatchObject({
      kind: "parsed",
      revision: 2,
      note: {
        document: { body: "- [x] new revision\n- [ ] remaining" },
        interval: {
          start: { dateKey: "2026-08-01" },
          end: { dateKey: "2026-08-03" },
        },
        statistics: { taskTotal: 2, taskCompleted: 1 },
      },
    });
  });

  it("converges after create, modify, rename, and delete events", async () => {
    const source = new FakeNoteSource();
    const contents = new Map<string, string>();
    source.read.mockImplementation(async (path) => {
      const content = contents.get(path);
      if (content === undefined) throw new Error(`missing ${path}`);
      return content;
    });
    const index = new NoteIndex(source);
    await index.start();

    contents.set("Daily/old.md", "created");
    source.emit({ type: "create", path: "Daily/old.md" });
    await vi.waitFor(() => expect(index.get("Daily/old.md").kind).toBe("parsed"));

    contents.set("Daily/old.md", "modified");
    source.emit({ type: "modify", path: "Daily/old.md" });
    await vi.waitFor(() => {
      expect(index.get("Daily/old.md")).toMatchObject({
        kind: "parsed",
        note: { document: { body: "modified" } },
      });
    });

    contents.delete("Daily/old.md");
    contents.set("Daily/new.md", "renamed");
    source.emit({ type: "rename", oldPath: "Daily/old.md", path: "Daily/new.md" });
    expect(index.get("Daily/old.md").kind).toBe("missing");
    await vi.waitFor(() => expect(index.get("Daily/new.md").kind).toBe("parsed"));

    contents.delete("Daily/new.md");
    source.emit({ type: "delete", path: "Daily/new.md" });
    expect(index.get("Daily/new.md").kind).toBe("missing");
  });

  it("atomically replaces task and interval contributions across live events", async () => {
    const source = new FakeNoteSource();
    const contents = new Map<string, string>();
    source.read.mockImplementation(async (path) => {
      const content = contents.get(path);
      if (content === undefined) throw new Error(`missing ${path}`);
      return content;
    });
    const index = new NoteIndex(source);
    await index.start();
    const originalContent = [
      "---",
      "start: 2026-01-01",
      "end: 2026-01-07",
      "---",
      "- [ ] Ship 📅 2026-01-05 ⏳ 2026-01-05",
    ].join("\n");

    contents.set("Ranges/old.md", originalContent);
    source.emit({ type: "create", path: "Ranges/old.md" });
    await vi.waitFor(() => {
      const snapshot = index.getSnapshot();
      expect(snapshot.notes["Ranges/old.md"]?.kind).toBe("parsed");
      expect(snapshot.taskDates.byDate["2026-01-05"]?.[0]).toMatchObject({
        dateKinds: ["due", "scheduled"],
        task: { path: "Ranges/old.md" },
      });
      expect(snapshot.intervals.items).toMatchObject([
        { path: "Ranges/old.md", title: "old" },
      ]);
    });
    const createdSnapshot = index.getSnapshot();
    const oldColor = selectIntervalWeekData(
      createdSnapshot.intervals.items,
      { year: 2025, month: 12, day: 29 },
      2,
    ).items[0]?.colorIndex;

    contents.set("Ranges/old.md", originalContent
      .replaceAll("2026-01-05", "2026-01-06"));
    source.emit({ type: "modify", path: "Ranges/old.md" });
    await vi.waitFor(() => {
      const snapshot = index.getSnapshot();
      expect(snapshot.taskDates.byDate["2026-01-05"]).toBeUndefined();
      expect(snapshot.taskDates.byDate["2026-01-06"]?.[0]?.dateKinds)
        .toEqual(["due", "scheduled"]);
    });

    contents.delete("Ranges/old.md");
    source.emit({ type: "modify", path: "Ranges/old.md" });
    await vi.waitFor(() => {
      const snapshot = index.getSnapshot();
      expect(snapshot.notes["Ranges/old.md"]?.kind).toBe("error");
      expect(snapshot.taskDates.byDate).toEqual({});
      expect(snapshot.intervals.items).toEqual([]);
    });

    contents.set("Ranges/old.md", originalContent);
    source.emit({ type: "modify", path: "Ranges/old.md" });
    await vi.waitFor(() => {
      expect(index.getSnapshot().intervals.items).toHaveLength(1);
    });
    contents.delete("Ranges/old.md");
    contents.set("Archive/new-range.md", originalContent);
    source.emit({
      type: "rename",
      oldPath: "Ranges/old.md",
      path: "Archive/new-range.md",
    });
    expect(index.getSnapshot().taskDates.byDate).toEqual({});
    expect(index.getSnapshot().intervals.items).toEqual([]);
    await vi.waitFor(() => {
      const snapshot = index.getSnapshot();
      expect(snapshot.taskDates.byDate["2026-01-05"]?.[0]?.task.path)
        .toBe("Archive/new-range.md");
      expect(snapshot.intervals.items).toMatchObject([
        { path: "Archive/new-range.md", title: "new-range" },
      ]);
    });

    const renamedSnapshot = index.getSnapshot();
    expect(selectIntervalNotes(renamedSnapshot, {
      showInCalendar: true,
      folder: "Ranges",
      scanScope: "range-folder",
      customFolder: "",
      monthViewLimit: 2,
      weekViewLimit: 2,
    }).items).toEqual([]);
    const newColor = selectIntervalWeekData(
      renamedSnapshot.intervals.items,
      { year: 2025, month: 12, day: 29 },
      2,
    ).items[0]?.colorIndex;
    expect(newColor).not.toBe(oldColor);

    contents.delete("Archive/new-range.md");
    source.emit({ type: "delete", path: "Archive/new-range.md" });
    expect(index.getSnapshot().taskDates.byDate).toEqual({});
    expect(index.getSnapshot().intervals.items).toEqual([]);
  });

  it("publishes an explicit error instead of retaining stale parsed data", async () => {
    const source = new FakeNoteSource();
    source.read.mockResolvedValueOnce("healthy").mockRejectedValueOnce(new Error("disk failure"));
    const index = new NoteIndex(source);
    await index.start();

    await index.refresh("Daily/today.md");
    const beforeFailure = index.getSnapshot();
    source.emit({ type: "modify", path: "Daily/today.md" });

    await vi.waitFor(() => {
      expect(index.get("Daily/today.md")).toMatchObject({
        kind: "error",
        revision: 2,
        error: { message: "disk failure" },
      });
    });
    expect(beforeFailure.notes["Daily/today.md"]).toMatchObject({ kind: "parsed" });
  });

  it("invalidates a pending read immediately when the note is deleted", async () => {
    const source = new FakeNoteSource();
    const read = new Deferred<string>();
    source.read.mockReturnValue(read.promise);
    const index = new NoteIndex(source);
    await index.start();

    source.emit({ type: "create", path: "Daily/today.md" });
    await Promise.resolve();
    source.emit({ type: "delete", path: "Daily/today.md" });
    expect(index.get("Daily/today.md").kind).toBe("missing");

    read.resolve("too late");
    await read.promise;
    await Promise.resolve();
    expect(index.get("Daily/today.md").kind).toBe("missing");
  });

  it("stops listening and rejects late work after stop", async () => {
    const source = new FakeNoteSource();
    const read = new Deferred<string>();
    source.read.mockReturnValue(read.promise);
    const index = new NoteIndex(source);
    await index.start();

    source.emit({ type: "create", path: "Daily/today.md" });
    await Promise.resolve();
    index.stop();
    read.resolve("too late");
    await read.promise;
    await Promise.resolve();

    expect(index.get("Daily/today.md").kind).toBe("missing");
    source.emit({ type: "create", path: "Daily/ignored.md" });
    expect(source.read).toHaveBeenCalledTimes(1);
  });

  it("clears queued events and completed unpublished work on stop", async () => {
    const queuedSource = new FakeNoteSource();
    queuedSource.read.mockResolvedValue("queued");
    const queuedDiagnostics = createDiagnostics();
    const queuedIndex = new NoteIndex(queuedSource, { diagnostics: queuedDiagnostics });
    await queuedIndex.start();

    queuedSource.emit({ type: "create", path: "Daily/queued.md" });
    queuedIndex.stop();
    await Promise.resolve();
    await Promise.resolve();
    expect(queuedSource.read).not.toHaveBeenCalled();
    expect(queuedIndex.getSnapshot().version).toBe(2);

    const completedSource = new FakeNoteSource();
    const completedRead = new Deferred<string>();
    completedSource.read.mockReturnValue(completedRead.promise);
    const completedDiagnostics = createDiagnostics();
    const completedIndex = new NoteIndex(completedSource, {
      diagnostics: completedDiagnostics,
    });
    await completedIndex.start();
    completedSource.emit({ type: "create", path: "Daily/completed.md" });
    await Promise.resolve();
    completedRead.resolve("completed but not published");
    await Promise.resolve();
    completedIndex.stop();
    await Promise.resolve();

    expect(completedIndex.getSnapshot().version).toBe(2);
    expect(completedIndex.get("Daily/completed.md").kind).toBe("missing");
    expect(completedDiagnostics).toMatchObject({
      queuedEvents: 1,
      reads: 1,
      materializations: 0,
      publishes: 2,
    });
  });

  it("clears published projections on stop without mutating the previous snapshot", async () => {
    const source = new FakeNoteSource();
    source.paths = ["Ranges/project.md"];
    source.read.mockResolvedValue([
      "---",
      "start: 2026-01-01",
      "end: 2026-01-07",
      "---",
      "- [ ] Ship 📅 2026-01-05",
    ].join("\n"));
    const index = new NoteIndex(source);
    await index.start();
    const beforeStop = index.getSnapshot();

    index.stop();

    expect(index.getSnapshot()).toMatchObject({
      version: 2,
      notes: {},
      taskDates: { revision: 2, byDate: {} },
      intervals: { revision: 2, items: [] },
    });
    expect(beforeStop.taskDates.byDate["2026-01-05"]?.[0]?.task.path)
      .toBe("Ranges/project.md");
    expect(beforeStop.intervals.items.map((item) => item.path))
      .toEqual(["Ranges/project.md"]);
  });
});
