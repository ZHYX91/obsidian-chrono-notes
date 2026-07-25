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
    await expect(cache.save(snapshot)).resolves.toBeUndefined();
    await expect(cache.clear()).resolves.toBeUndefined();
  });

  it("round-trips and clears a Vault-scoped snapshot", async () => {
    const indexedDB = createFakeIndexedDb();
    vi.stubGlobal("window", { indexedDB });
    const cache = new ObsidianNoteIndexCache(createVault("Vault", "D:/Vault"));
    const snapshot = createPersistedNoteIndexSnapshot([]);

    await expect(cache.load()).resolves.toBeUndefined();
    await expect(cache.save(snapshot)).resolves.toBeUndefined();
    await expect(cache.load()).resolves.toEqual(snapshot);
    await expect(cache.clear()).resolves.toBeUndefined();
    await expect(cache.load()).resolves.toBeUndefined();
    expect(indexedDB.open).toHaveBeenCalledTimes(5);
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
}> = {}) {
  const values = new Map<IDBValidKey, unknown>();
  let upgraded = false;
  const database = {
    objectStoreNames: {
      contains: () => upgraded,
    },
    createObjectStore: () => {
      upgraded = true;
      return {} as IDBObjectStore;
    },
    transaction: () => createTransaction(values),
    close: vi.fn(),
  } as unknown as IDBDatabase;
  return {
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
): IDBTransaction {
  const transaction = {
    objectStore: () => ({
      get: (key: IDBValidKey) => createRequest(() => values.get(key)),
      put: (value: unknown, key: IDBValidKey) =>
        createRequest(() => {
          values.set(key, value);
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
