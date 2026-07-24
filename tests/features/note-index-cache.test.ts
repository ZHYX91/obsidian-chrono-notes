import { describe, expect, it, vi } from "vitest";

import type {
  NoteSource,
  NoteSourceEvent,
  NoteSourceFile,
  NoteSourceListener,
} from "../../src/core/note/note-source";
import { parseNote } from "../../src/core/note/parsed-note";
import { createIndexedNote } from "../../src/features/notes/indexed-note";
import { NoteIndex } from "../../src/features/notes/note-index";
import {
  createPersistedNoteIndexSnapshot,
  parsePersistedNoteIndexSnapshot,
  type NoteIndexCache,
  type PersistedNoteIndexSnapshot,
} from "../../src/features/notes/note-index-cache";

class Deferred<T> {
  readonly promise: Promise<T>;
  private resolvePromise!: (value: T) => void;

  constructor() {
    this.promise = new Promise<T>((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  resolve(value: T): void {
    this.resolvePromise(value);
  }
}

class MetadataNoteSource implements NoteSource {
  readonly read = vi.fn<(path: string) => Promise<string>>();
  files: NoteSourceFile[] = [];
  private readonly listeners = new Set<NoteSourceListener>();

  listPaths(): readonly string[] {
    return this.files.map((file) => file.path);
  }

  listFiles(): readonly NoteSourceFile[] {
    return this.files;
  }

  subscribe(listener: NoteSourceListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: NoteSourceEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}

class MemoryNoteIndexCache implements NoteIndexCache {
  readonly load = vi.fn(async (): Promise<unknown> => this.value);
  readonly save = vi.fn(async (snapshot: PersistedNoteIndexSnapshot) => {
    this.value = snapshot;
  });
  readonly clear = vi.fn(async () => {
    this.value = null;
  });

  constructor(public value: unknown) {}
}

const FILE = Object.freeze({
  path: "Daily/2026-07-24.md",
  mtime: 1_721_779_200_000,
  size: 3,
});

function cached(content: string, file: NoteSourceFile = FILE): PersistedNoteIndexSnapshot {
  return createPersistedNoteIndexSnapshot([
    Object.freeze({
      file,
      note: createIndexedNote(parseNote(file.path, content)),
    }),
  ]);
}

describe("persistent NoteIndex cache", () => {
  it("restores a matching derived entry before background verification settles", async () => {
    const source = new MetadataNoteSource();
    source.files = [FILE];
    const verification = new Deferred<string>();
    source.read.mockReturnValue(verification.promise);
    const cache = new MemoryNoteIndexCache(cached("old"));
    const index = new NoteIndex(source, { cache });

    await index.start();

    expect(index.getSnapshot().readiness).toBe("ready");
    expect(index.get(FILE.path)).toMatchObject({
      kind: "parsed",
      note: { preview: "old" },
    });
    expect(source.read).not.toHaveBeenCalled();
    const warmVersion = index.getSnapshot().version;

    await vi.waitFor(() => expect(source.read).toHaveBeenCalledTimes(1));
    verification.resolve("old");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(index.getSnapshot().version).toBe(warmVersion);
    index.stop();
  });

  it("lets background verification repair same-metadata external edits", async () => {
    const source = new MetadataNoteSource();
    source.files = [FILE];
    const verification = new Deferred<string>();
    source.read.mockReturnValue(verification.promise);
    const index = new NoteIndex(source, {
      cache: new MemoryNoteIndexCache(cached("old")),
    });

    await index.start();
    expect(index.get(FILE.path)).toMatchObject({
      kind: "parsed",
      note: { preview: "old" },
    });

    await vi.waitFor(() => expect(source.read).toHaveBeenCalledTimes(1));
    verification.resolve("new");
    await vi.waitFor(() => {
      expect(index.get(FILE.path)).toMatchObject({
        kind: "parsed",
        note: { preview: "new" },
      });
    });
    index.stop();
  });

  it("reads changed metadata before exposing ready", async () => {
    const source = new MetadataNoteSource();
    source.files = [{ ...FILE, mtime: FILE.mtime + 1 }];
    source.read.mockResolvedValue("new");
    const index = new NoteIndex(source, {
      cache: new MemoryNoteIndexCache(cached("old")),
    });

    await index.start();

    expect(source.read).toHaveBeenCalledTimes(1);
    expect(index.get(FILE.path)).toMatchObject({
      kind: "parsed",
      note: { preview: "new" },
    });
    index.stop();
  });

  it("clears a malformed snapshot and falls back to a complete scan", async () => {
    const source = new MetadataNoteSource();
    source.files = [FILE];
    source.read.mockResolvedValue("fresh");
    const cache = new MemoryNoteIndexCache({ schema: 1, entries: [{ broken: true }] });
    const index = new NoteIndex(source, { cache });

    await index.start();

    expect(cache.clear).toHaveBeenCalledTimes(1);
    expect(source.read).toHaveBeenCalledTimes(1);
    expect(index.get(FILE.path)).toMatchObject({
      kind: "parsed",
      note: { preview: "fresh" },
    });
    index.stop();
  });

  it("falls back to a complete scan when cache loading fails", async () => {
    const source = new MetadataNoteSource();
    source.files = [FILE];
    source.read.mockResolvedValue("fresh");
    const cache = new MemoryNoteIndexCache(null);
    cache.load.mockRejectedValueOnce(new Error("storage unavailable"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const index = new NoteIndex(source, { cache });

    await index.start();

    expect(source.read).toHaveBeenCalledTimes(1);
    expect(index.get(FILE.path)).toMatchObject({
      kind: "parsed",
      note: { preview: "fresh" },
    });
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
    index.stop();
  });

  it("does not reuse a cached path modified while the cache is loading", async () => {
    const source = new MetadataNoteSource();
    source.files = [FILE];
    source.read.mockResolvedValue("modified");
    const loading = new Deferred<unknown>();
    const cache = new MemoryNoteIndexCache(null);
    cache.load.mockReturnValueOnce(loading.promise);
    const index = new NoteIndex(source, { cache });

    const starting = index.start();
    await vi.waitFor(() => expect(cache.load).toHaveBeenCalledTimes(1));
    source.emit({ type: "modify", path: FILE.path });
    loading.resolve(cached("old"));
    await starting;

    expect(source.read).toHaveBeenCalledTimes(1);
    expect(index.get(FILE.path)).toMatchObject({
      kind: "parsed",
      note: { preview: "modified" },
    });
    index.stop();
  });

  it("coalesces cache writes and persists only derived note data", async () => {
    const source = new MetadataNoteSource();
    source.files = [FILE];
    source.read
      .mockResolvedValueOnce("first")
      .mockResolvedValueOnce("second");
    const cache = new MemoryNoteIndexCache(null);
    const scheduled: Array<() => void> = [];
    const index = new NoteIndex(source, {
      cache,
      scheduleCacheSave: (callback) => {
        scheduled.push(callback);
        return () => undefined;
      },
    });

    await index.start();
    expect(scheduled).toHaveLength(1);
    source.emit({ type: "modify", path: FILE.path });
    await vi.waitFor(() => {
      expect(index.get(FILE.path)).toMatchObject({
        kind: "parsed",
        note: { preview: "second" },
      });
    });
    expect(scheduled).toHaveLength(1);

    scheduled[0]?.();
    await vi.waitFor(() => expect(cache.save).toHaveBeenCalledTimes(1));
    const saved = cache.save.mock.calls[0]?.[0];
    expect(saved?.entries[0]?.note).toMatchObject({ preview: "second" });
    expect(saved?.entries[0]?.note).not.toHaveProperty("document");
    expect(saved?.entries[0]?.note).not.toHaveProperty("frontmatter");
    index.stop();
  });

  it("keeps the live index ready when cache saving fails", async () => {
    const source = new MetadataNoteSource();
    source.files = [FILE];
    source.read.mockResolvedValue("fresh");
    const cache = new MemoryNoteIndexCache(null);
    cache.save.mockRejectedValueOnce(new Error("quota exceeded"));
    const scheduled: Array<() => void> = [];
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const index = new NoteIndex(source, {
      cache,
      scheduleCacheSave: (callback) => {
        scheduled.push(callback);
        return () => undefined;
      },
    });

    await index.start();
    scheduled[0]?.();
    await vi.waitFor(() => expect(cache.save).toHaveBeenCalledOnce());

    expect(index.getSnapshot().readiness).toBe("ready");
    expect(index.get(FILE.path).kind).toBe("parsed");
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
    index.stop();
  });

  it("drops cached files that no longer exist without reading them", async () => {
    const source = new MetadataNoteSource();
    source.files = [];
    const index = new NoteIndex(source, {
      cache: new MemoryNoteIndexCache(cached("old")),
    });

    await index.start();

    expect(source.read).not.toHaveBeenCalled();
    expect(index.get(FILE.path).kind).toBe("missing");
    index.stop();
  });

  it("starts verification in a later host task and keeps yielding by time budget", async () => {
    const source = new MetadataNoteSource();
    source.files = [0, 1, 2].map((index) => Object.freeze({
      path: `Daily/${index}.md`,
      mtime: 1,
      size: 4,
    }));
    source.read.mockResolvedValue("body");
    const snapshot = createPersistedNoteIndexSnapshot(source.files.map((file) =>
      Object.freeze({
        file,
        note: createIndexedNote(parseNote(file.path, "body")),
      })));
    const verificationCallbacks: Array<() => void> = [];
    let clock = 0;
    const yieldToHost = vi.fn(async () => undefined);
    const index = new NoteIndex(source, {
      cache: new MemoryNoteIndexCache(snapshot),
      initialIndexClock: () => {
        clock += 10;
        return clock;
      },
      yieldInitialIndex: yieldToHost,
      scheduleBackgroundVerification: (callback) => {
        verificationCallbacks.push(callback);
        return () => undefined;
      },
    });

    await index.start();
    expect(source.read).not.toHaveBeenCalled();
    expect(index.getSnapshot().readiness).toBe("ready");

    verificationCallbacks[0]?.();
    await vi.waitFor(() => expect(source.read).toHaveBeenCalledTimes(3));
    await vi.waitFor(() => expect(yieldToHost).toHaveBeenCalled());
    index.stop();
  });

  it("lets a pending live modification replace background verification", async () => {
    const source = new MetadataNoteSource();
    source.files = [FILE];
    source.read.mockResolvedValue("live");
    const verificationCallbacks: Array<() => void> = [];
    const index = new NoteIndex(source, {
      cache: new MemoryNoteIndexCache(cached("old")),
      scheduleBackgroundVerification: (callback) => {
        verificationCallbacks.push(callback);
        return () => undefined;
      },
    });

    await index.start();
    source.emit({ type: "modify", path: FILE.path });
    verificationCallbacks[0]?.();

    await vi.waitFor(() => {
      expect(index.get(FILE.path)).toMatchObject({
        kind: "parsed",
        note: { preview: "live" },
      });
    });
    expect(source.read).toHaveBeenCalledTimes(1);
    index.stop();
  });

  it("rejects duplicate or non-finite persisted metadata", () => {
    const duplicate = cached("old");
    expect(parsePersistedNoteIndexSnapshot({
      ...duplicate,
      entries: [duplicate.entries[0], duplicate.entries[0]],
    })).toBeNull();
    expect(parsePersistedNoteIndexSnapshot({
      schema: 1,
      entries: [{
        ...duplicate.entries[0],
        file: { ...FILE, mtime: Number.NaN },
      }],
    })).toBeNull();
  });
});
