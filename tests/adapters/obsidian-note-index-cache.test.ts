import { afterEach, describe, expect, it, vi } from "vitest";

import { ObsidianNoteIndexCache } from "../../src/adapters/obsidian/obsidian-note-index-cache";
import { createPersistedNoteIndexSnapshot } from "../../src/features/notes/note-index-cache";

describe("ObsidianNoteIndexCache", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fails open when IndexedDB is unavailable", async () => {
    const cache = new ObsidianNoteIndexCache({
      adapter: {
        getBasePath: () => "D:/Vault",
        getResourcePath: () => "app://vault/.obsidian",
      },
      configDir: ".obsidian",
      getName: () => "Vault",
    } as never);
    const snapshot = createPersistedNoteIndexSnapshot([]);

    await expect(cache.load()).resolves.toBeNull();
    await expect(cache.getStatus()).resolves.toEqual({ state: "unavailable" });
    await expect(cache.save(snapshot)).resolves.toBeUndefined();
    await expect(cache.applyChanges({ upserts: [], deletes: ["missing.md"] })).resolves.toBeUndefined();
    await expect(cache.clear()).resolves.toBeUndefined();
  });

  it("falls back to the resource identity and surfaces IndexedDB errors", async () => {
    const indexedDB = {
      open: () => {
        const request = {} as IDBOpenDBRequest;
        queueMicrotask(() => {
          Object.defineProperty(request, "error", { value: new Error("open failed") });
          request.onerror?.(new Event("error"));
        });
        return request;
      },
    };
    vi.stubGlobal("window", { indexedDB });
    const cache = new ObsidianNoteIndexCache({
      adapter: {
        getBasePath: () => {
          throw new Error("restricted");
        },
        getResourcePath: () => "app://vault/.obsidian",
      },
      configDir: ".obsidian",
      getName: () => "Mobile vault",
    } as never);

    await expect(cache.load()).rejects.toThrow("open failed");
    await expect(cache.getStatus()).resolves.toEqual({ state: "error" });
  });
});
