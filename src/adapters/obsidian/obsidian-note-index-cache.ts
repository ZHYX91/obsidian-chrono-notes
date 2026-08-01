import type { Vault } from "obsidian";

import {
  createPersistedNoteIndexStorageMetadata,
  summarizePersistedNoteIndexStorage,
  type NoteIndexCache,
  type NoteIndexCacheStorageStatus,
  type PersistedNoteIndexSnapshot,
} from "../../features/notes/note-index-cache";

const DATABASE_NAME = "chrono-notes";
const DATABASE_VERSION = 1;
const STORE_NAME = "note-index-snapshots";

export class ObsidianNoteIndexCache implements NoteIndexCache {
  private readonly key: string;
  private readonly metadataKey: string;

  constructor(vault: Vault) {
    this.key = getVaultCacheKey(vault);
    this.metadataKey = JSON.stringify(["metadata", this.key]);
  }

  async load(): Promise<unknown> {
    return this.withStore("readonly", (store) => requestResult(store.get(this.key)), null);
  }

  async save(snapshot: PersistedNoteIndexSnapshot): Promise<void> {
    await this.withStore(
      "readwrite",
      async (store) => {
        await requestResult(store.put(snapshot, this.key));
        await requestResult(store.put(
          createPersistedNoteIndexStorageMetadata(snapshot),
          this.metadataKey,
        ));
      },
      undefined,
    );
  }

  async clear(): Promise<void> {
    await this.withStore(
      "readwrite",
      async (store) => {
        await requestResult(store.delete(this.key));
        await requestResult(store.delete(this.metadataKey));
      },
      undefined,
    );
  }

  async getStatus(): Promise<NoteIndexCacheStorageStatus> {
    if (
      typeof window === "undefined" ||
      typeof window.indexedDB === "undefined"
    ) {
      return Object.freeze({ state: "unavailable" });
    }
    try {
      return await this.withStore(
        "readonly",
        async (store) => {
          const metadata: unknown = await requestResult<unknown>(
            store.get(this.metadataKey),
          );
          if (metadata !== undefined) {
            const status = summarizePersistedNoteIndexStorage(metadata);
            if (status.state !== "stored") return status;
            const snapshotKey = await requestResult(store.getKey(this.key));
            return snapshotKey === undefined
              ? Object.freeze({ state: "invalid" })
              : status;
          }
          const legacyKey = await requestResult(store.getKey(this.key));
          return legacyKey === undefined
            ? Object.freeze({ state: "empty" })
            : Object.freeze({ state: "legacy" });
        },
        Object.freeze({ state: "unavailable" }),
      );
    } catch {
      return Object.freeze({ state: "error" });
    }
  }

  private async withStore<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => Promise<T>,
    unavailable: T,
  ): Promise<T> {
    if (
      typeof window === "undefined" ||
      typeof window.indexedDB === "undefined"
    ) {
      return unavailable;
    }
    const database = await openDatabase();
    try {
      const transaction = database.transaction(STORE_NAME, mode);
      const result = await run(transaction.objectStore(STORE_NAME));
      await transactionDone(transaction);
      return result;
    } finally {
      database.close();
    }
  }
}

function getVaultCacheKey(vault: Vault): string {
  const adapter = vault.adapter as typeof vault.adapter & {
    getBasePath?: () => string;
  };
  let storageIdentity = "";
  try {
    storageIdentity = adapter.getBasePath?.() ?? "";
  } catch {
    // Mobile adapters need not expose a filesystem path.
  }
  if (storageIdentity.length === 0) {
    try {
      storageIdentity = adapter.getResourcePath(vault.configDir);
    } catch {
      // The Vault name remains a stable fallback on restricted adapters.
    }
  }
  return `${vault.getName()}\u0000${storageIdentity}`;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onerror = () => reject(request.error ?? new Error("Failed to open index cache"));
    request.onsuccess = () => resolve(request.result);
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error("Index cache request failed"));
    request.onsuccess = () => resolve(request.result);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.onabort = () => reject(
      transaction.error ?? new Error("Index cache transaction aborted"),
    );
    transaction.onerror = () => reject(
      transaction.error ?? new Error("Index cache transaction failed"),
    );
    transaction.oncomplete = () => resolve();
  });
}
