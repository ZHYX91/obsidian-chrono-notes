import type { Vault } from "obsidian";

import {
  MissingNoteIndexCacheBaseline,
  NOTE_INDEX_CACHE_SCHEMA,
  summarizePersistedNoteIndexStorage,
  type NoteIndexCache,
  type NoteIndexCacheChanges,
  type NoteIndexCacheStorageStatus,
  type PersistedNoteIndexEntry,
  type PersistedNoteIndexSnapshot,
} from "../../features/notes/note-index-cache";

const DATABASE_NAME = "chrono-notes";
const DATABASE_VERSION = 2;
// V1 stored both its full snapshot and its optional status metadata here.
const HEADER_STORE = "note-index-snapshots";
const ROW_STORE = "note-index-entries";

export class ObsidianNoteIndexCache implements NoteIndexCache {
  private readonly key: string;
  private readonly metadataKey: string;
  needsFullSave = false;
  private baseline: { generation: string; paths: ReadonlySet<string> } | null = null;

  constructor(vault: Vault) {
    this.key = getVaultCacheKey(vault);
    this.metadataKey = JSON.stringify(["metadata", this.key]);
  }

  async load(): Promise<unknown> {
    return this.withStores("readonly", async (headers, rows) => {
      const [header, snapshot]: readonly [unknown, unknown] = await Promise.all([
        requestResult<unknown>(headers.get(this.metadataKey)), requestResult<unknown>(headers.get(this.key)),
      ]);
      if (!hasOverlayLayout(header)) {
        if (!isLegacyMetadata(header) || await requestResult(rows.getKey(this.rowRange())) !== undefined) return {};
        this.baseline = null;
        this.needsFullSave = snapshot != null;
        return snapshot;
      }
      const baseline = parseBaseline(snapshot);
      if (!validManifest(header) || !baseline) return {};
      this.baseline = { generation: header.generation, paths: baseline.paths };
      this.needsFullSave = header.overlayCount >= Math.max(256, baseline.paths.size / 2);
      const range = this.rowRange();
      if (header.overlayCount === 0) {
        const firstOverride = await requestResult(rows.getKey(range));
        return firstOverride === undefined && baseline.paths.size === header.entryCount ? snapshot : {};
      }

      const [overrides, keys] = await Promise.all([
        requestResult<unknown[]>(rows.getAll(range)), requestResult(rows.getAllKeys(range)),
      ]);
      if (overrides.length !== header.overlayCount) return {};
      const entries = new Map(baseline.entries.map((entry) => [entry.file.path, entry]));
      for (const [index, override] of overrides.entries()) {
        const key = keys[index];
        const path = hasFilePath(override) ? override.file.path : override;
        if (!Array.isArray(key) || key.length !== 2 || key[1] !== path) return {};
        if (typeof override === "string") entries.delete(override);
        else if (hasFilePath(override)) entries.set(override.file.path, override);
        else return {};
      }
      return entries.size === header.entryCount
        ? { schema: NOTE_INDEX_CACHE_SCHEMA, entries: [...entries.values()] }
        : {};
    }, null);
  }

  async save(snapshot: PersistedNoteIndexSnapshot): Promise<void> {
    const generation = await this.withStores("readwrite", (headers, rows) => {
      const id = crypto.getRandomValues(new Uint32Array(4)).join("-");
      rows.delete(this.rowRange());
      headers.put(snapshot, this.key);
      headers.put(rowHeader(id, snapshot.entries.length, 0), this.metadataKey);
      return id;
    }, null);
    if (generation === null) return;
    this.baseline = { generation, paths: new Set(snapshot.entries.map(({ file }) => file.path)) };
    this.needsFullSave = false;
  }

  async applyChanges({ upserts, deletes }: NoteIndexCacheChanges): Promise<void> {
    if (upserts.length === 0 && deletes.length === 0) return;
    await this.withStores("readwrite", async (headers, rows) => {
      const header: unknown = await requestResult(headers.get(this.metadataKey));
      if (!hasOverlayLayout(header) || !validManifest(header)) throw missingBaseline();
      if (this.baseline?.generation !== header.generation) {
        // Another window replaced the baseline. Refresh membership once for
        // that generation, inside the same transaction that updates its counts.
        const baseline = parseBaseline(await requestResult(headers.get(this.key)));
        if (!baseline) throw missingBaseline();
        this.baseline = { generation: header.generation, paths: baseline.paths };
      }
      const baseline = this.baseline.paths;
      const changes = new Map<string, PersistedNoteIndexEntry | null>();
      for (const path of deletes) changes.set(path, null);
      for (const entry of upserts) changes.set(entry.file.path, entry);

      let { entryCount, overlayCount } = header;
      await Promise.all(Array.from(changes, async ([path, entry]) => {
        const key = [this.key, path];
        const previous: unknown = await requestResult(rows.get(key));
        const inBaseline = baseline.has(path);
        const wasPresent = previous === undefined ? inBaseline : typeof previous !== "string";
        entryCount += Number(entry !== null) - Number(wasPresent);
        // A deleted baseline row needs a tombstone. A new row can disappear entirely.
        const keepOverlay = entry !== null || inBaseline;
        overlayCount += Number(keepOverlay) - Number(previous !== undefined);
        if (keepOverlay) rows.put(entry ?? path, key);
        else rows.delete(key);
      }));
      headers.put(rowHeader(header.generation, entryCount, overlayCount), this.metadataKey);
    }, undefined);
  }

  async clear(): Promise<void> {
    await this.withStores("readwrite", (headers, rows) => {
      rows.delete(this.rowRange());
      headers.delete(this.key);
      headers.delete(this.metadataKey);
    }, undefined);
    this.needsFullSave = false;
    this.baseline = null;
  }

  async getStatus(): Promise<NoteIndexCacheStorageStatus> {
    try {
      return await this.withStores<NoteIndexCacheStorageStatus>("readonly", async (headers, rows) => {
        const metadata: unknown = await requestResult(headers.get(this.metadataKey));
        const status = summarizePersistedNoteIndexStorage(metadata);
        if (hasOverlayLayout(metadata) ? !validManifest(metadata) : !isLegacyMetadata(metadata)) {
          return { state: "invalid" };
        }
        if (!hasOverlayLayout(metadata) && await requestResult(rows.getKey(this.rowRange())) !== undefined) {
          return { state: "invalid" };
        }
        const key = await requestResult(headers.getKey(this.key));
        if (status.state === "stored") return key === undefined ? { state: "invalid" } : status;
        return key === undefined ? { state: "empty" } : { state: "legacy" };
      }, { state: "unavailable" });
    } catch {
      return { state: "error" };
    }
  }

  private rowRange(): IDBKeyRange {
    // In IndexedDB ordering every string path sorts before an array key.
    return IDBKeyRange.bound([this.key], [this.key, []], false, true);
  }

  private async withStores<T>(
    mode: IDBTransactionMode,
    run: (headers: IDBObjectStore, rows: IDBObjectStore) => T | Promise<T>,
    unavailable: T,
  ): Promise<T> {
    if (typeof window === "undefined" || typeof window.indexedDB === "undefined") return unavailable;
    const database = await openDatabase();
    try {
      const transaction = database.transaction([HEADER_STORE, ROW_STORE], mode);
      const done = transactionDone(transaction);
      try {
        const [result] = await Promise.all([
          run(transaction.objectStore(HEADER_STORE), transaction.objectStore(ROW_STORE)),
          done,
        ]);
        return result;
      } catch (error) {
        // A synchronous put/clone failure must also roll back earlier requests.
        try { transaction.abort(); } catch { /* Already completed or aborted. */ }
        await done.catch(() => undefined);
        throw error;
      }
    } finally {
      database.close();
    }
  }
}

function hasOverlayLayout(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && "layout" in value && value.layout === "overlay";
}

function isLegacyMetadata(value: unknown): boolean {
  if (value === undefined) return true;
  return typeof value === "object" && value !== null &&
    !("layout" in value || "generation" in value || "overlayCount" in value || "noteSchema" in value) &&
    summarizePersistedNoteIndexStorage(value).state === "stored";
}

function validManifest(header: Record<string, unknown>): header is ReturnType<typeof rowHeader> {
  return header.schema === 1 && header.noteSchema === NOTE_INDEX_CACHE_SCHEMA &&
    typeof header.generation === "string" &&
    typeof header.entryCount === "number" && Number.isSafeInteger(header.entryCount) && header.entryCount >= 0 &&
    typeof header.overlayCount === "number" && Number.isSafeInteger(header.overlayCount) && header.overlayCount >= 0;
}

function rowHeader(generation: string, entryCount: number, overlayCount: number) {
  return { layout: "overlay", schema: 1, noteSchema: NOTE_INDEX_CACHE_SCHEMA, generation, entryCount, overlayCount };
}

function missingBaseline(): MissingNoteIndexCacheBaseline {
  return new MissingNoteIndexCacheBaseline("Incremental index cache requires a complete baseline");
}

function hasFilePath(value: unknown): value is { file: { path: string } } {
  if (typeof value !== "object" || value === null || !("file" in value)) return false;
  const { file } = value;
  return typeof file === "object" && file !== null && "path" in file && typeof file.path === "string";
}

function parseBaseline(value: unknown) {
  if (typeof value !== "object" || value === null || !("schema" in value) ||
    value.schema !== NOTE_INDEX_CACHE_SCHEMA || !("entries" in value) || !Array.isArray(value.entries)) return null;
  const entries: unknown[] = value.entries;
  if (!entries.every(hasFilePath)) return null;
  const paths = new Set(entries.map((entry) => entry.file.path));
  return paths.size === entries.length ? { entries, paths } : null;
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
      for (const name of [HEADER_STORE, ROW_STORE]) {
        if (!database.objectStoreNames.contains(name)) database.createObjectStore(name);
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
