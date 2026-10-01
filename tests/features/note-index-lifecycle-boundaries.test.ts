import { describe, expect, it, vi } from "vitest";

import { parseNote } from "../../src/core/note/parsed-note";
import { NoteIndex } from "../../src/features/notes/note-index";
import { createIndexedNote } from "../../src/features/notes/indexed-note";
import { createPersistedNoteIndexSnapshot } from "../../src/features/notes/note-index-cache";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("NoteIndex lifecycle boundaries", () => {
  it("does not let old cache validation invalidate new reads", async () => {
    const files = ["A.md", "B.md"].map((path) => ({ path, mtime: 1, size: 4 }));
    const pausedValidation = deferred<void>();
    const reads = new Map(files.map((file) => [file.path, deferred<string>()]));
    let value: unknown = createPersistedNoteIndexSnapshot(files.map((file) => ({
      file, note: createIndexedNote(parseNote(file.path, "body")),
    })));
    const source = {
      listPaths: () => files.map((file) => file.path),
      listFiles: () => files,
      subscribe: () => () => undefined,
      read: vi.fn((path: string) => reads.get(path)!.promise),
    };
    const cache = {
      load: async () => value,
      clear: async () => { value = null; },
      save: async (snapshot: unknown) => { value = snapshot; },
    };
    let clock = 0;
    const yieldToHost = vi.fn(() => pausedValidation.promise);
    const index = new NoteIndex(source, {
      cache, initialIndexClock: () => clock += 10,
      yieldInitialIndex: yieldToHost,
      scheduleCacheSave: () => () => undefined,
    });
    const old = index.start();
    await vi.waitFor(() => expect(yieldToHost).toHaveBeenCalledOnce());
    index.stop();
    await index.clearCacheWhileStopped();
    const current = index.start();
    await vi.waitFor(() => expect(source.read).toHaveBeenCalledTimes(2));
    pausedValidation.resolve();
    await old;
    for (const read of reads.values()) read.resolve("body");
    await current;
    expect(index.getSnapshot().readiness).toBe("ready");
    expect(Object.keys(index.getSnapshot().notes)).toEqual(["A.md", "B.md"]);
    index.stop();
  });

  it.each([null, { schema: 3, entries: [] }])(
    "does not clear or restore a late cache load from an old lifecycle (%s)", async (value) => {
      const loading = deferred<unknown>();
      const cache = {
        load: vi.fn().mockReturnValueOnce(loading.promise).mockResolvedValue(null),
        clear: vi.fn(async () => undefined),
        save: async () => undefined,
      };
      const source = {
        listFiles: () => [{ path: "Current.md", mtime: 2, size: 4 }],
        listPaths: () => ["Current.md"],
        read: vi.fn(async () => "body"),
        subscribe: () => () => undefined,
      };
      const index = new NoteIndex(source, { cache, scheduleCacheSave: () => () => undefined });
      const old = index.start();
      await vi.waitFor(() => expect(cache.load).toHaveBeenCalledOnce());
      index.stop();
      await index.start();
      loading.resolve(value);
      await old;
      expect(index.getSnapshot().readiness).toBe("ready");
      expect(Object.keys(index.getSnapshot().notes)).toEqual(["Current.md"]);
      expect(source.read).toHaveBeenCalledOnce();
      expect(cache.clear).not.toHaveBeenCalled();
      index.stop();
    },
  );
});
