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
    await expect(cache.clear()).resolves.toBeUndefined();
  });

  it("round-trips and clears a Vault-scoped snapshot", async () => {
    const indexedDB = createFakeIndexedDb();
    vi.stubGlobal("window", { indexedDB });
    const cache = new ObsidianNoteIndexCache(createVault("Vault", "D:/Vault"));
    const snapshot = createPersistedNoteIndexSnapshot([]);

    await expect(cache.load()).resolves.toBeUndefined();
    await expect(cache.getStatus()).resolves.toEqual({ state: "empty" });
    await expect(cache.save(snapshot)).resolves.toBeUndefined();
    await expect(cache.load()).resolves.toEqual(snapshot);
    indexedDB.valueReads.length = 0;
    await expect(cache.getStatus()).resolves.toEqual({
      state: "stored",
      entryCount: 0,
    });
    expect(indexedDB.valueReads.every((key) =>
      typeof key === "string" && key.startsWith('["metadata",'))).toBe(true);
    await expect(cache.clear()).resolves.toBeUndefined();
    await expect(cache.load()).resolves.toBeUndefined();
    expect(indexedDB.open).toHaveBeenCalledTimes(7);
  });

  it("reports a legacy snapshot without reading its full value", async () => {
    const indexedDB = createFakeIndexedDb({ omitMetadataWrites: true });
    vi.stubGlobal("window", { indexedDB });
    const cache = new ObsidianNoteIndexCache(createVault("Vault", "D:/Legacy"));
    await cache.save(createPersistedNoteIndexSnapshot([]));
    indexedDB.valueReads.length = 0;

    await expect(cache.getStatus()).resolves.toEqual({ state: "legacy" });

    expect(indexedDB.valueReads).toHaveLength(1);
    expect(indexedDB.valueReads[0]).toMatch(/^\["metadata",/u);
    expect(indexedDB.keyReads).toHaveLength(1);
  });

  it("keeps same-name Vaults isolated by storage identity", async () => {
    const indexedDB = createFakeIndexedDb();
    vi.stubGlobal("window", { indexedDB });
    const first = new ObsidianNoteIndexCache(createVault("Notes", "D:/First"));
    const second = new ObsidianNoteIndexCache(createVault("Notes", "D:/Second"));
    const snapshot = createPersistedNoteIndexSnapshot([]);

    await first.save(snapshot);

    await expect(first.load()).resolves.toEqual(snapshot);
    await expect(second.load()).resolves.toBeUndefined();
  });

  it("falls back to the resource identity and surfaces IndexedDB errors", async () => {
    const indexedDB = createFakeIndexedDb({ failOpen: true });
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

function createVault(name: string, basePath: string) {
  return {
    adapter: {
      getBasePath: () => basePath,
      getResourcePath: () => `app://${basePath}/.obsidian`,
    },
    configDir: ".obsidian",
    getName: () => name,
  } as never;
}

function createFakeIndexedDb(options: Readonly<{
  failOpen?: boolean;
  omitMetadataWrites?: boolean;
}> = {}) {
  const values = new Map<IDBValidKey, unknown>();
  const valueReads: IDBValidKey[] = [];
  const keyReads: IDBValidKey[] = [];
  let upgraded = false;
  const database = {
    objectStoreNames: {
      contains: () => upgraded,
    },
    createObjectStore: () => {
      upgraded = true;
      return {} as IDBObjectStore;
    },
    transaction: () => createTransaction(values, valueReads, keyReads, options),
    close: vi.fn(),
  } as unknown as IDBDatabase;
  return {
    valueReads,
    keyReads,
    open: vi.fn(() => {
      const request = {} as IDBOpenDBRequest;
      queueMicrotask(() => {
        if (options.failOpen === true) {
          Object.defineProperty(request, "error", {
            value: new Error("open failed"),
          });
          request.onerror?.(new Event("error"));
          return;
        }
        Object.defineProperty(request, "result", { value: database });
        if (!upgraded) request.onupgradeneeded?.(new Event("upgradeneeded") as never);
        request.onsuccess?.(new Event("success"));
      });
      return request;
    }),
  };
}

function createTransaction(
  values: Map<IDBValidKey, unknown>,
  valueReads: IDBValidKey[],
  keyReads: IDBValidKey[],
  options: Readonly<{ omitMetadataWrites?: boolean }>,
): IDBTransaction {
  const transaction = {
    objectStore: () => ({
      get: (key: IDBValidKey) => createRequest(() => {
        valueReads.push(key);
        return values.get(key);
      }),
      getKey: (key: IDBValidKey) => createRequest(() => {
        keyReads.push(key);
        return values.has(key) ? key : undefined;
      }),
      put: (value: unknown, key: IDBValidKey) =>
        createRequest(() => {
          if (!(options.omitMetadataWrites === true &&
            typeof key === "string" && key.startsWith('["metadata",'))) {
            values.set(key, value);
          }
          return key;
        }),
      delete: (key: IDBValidKey) =>
        createRequest(() => {
          values.delete(key);
          return undefined;
        }),
    }),
  } as unknown as IDBTransaction;
  Object.defineProperty(transaction, "oncomplete", {
    set: (listener: ((event: Event) => unknown) | null) => {
      if (listener !== null) queueMicrotask(() => listener(new Event("complete")));
    },
  });
  return transaction;
}

function createRequest<T>(getResult: () => T): IDBRequest<T> {
  const request = {} as IDBRequest<T>;
  queueMicrotask(() => {
    Object.defineProperty(request, "result", { value: getResult() });
    request.onsuccess?.(new Event("success"));
  });
  return request;
}
