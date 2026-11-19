import {
  createPersistedNoteIndexSnapshot,
  MissingNoteIndexCacheBaseline,
  type NoteIndexCache,
  type NoteIndexCacheChanges,
} from "./note-index-cache";

interface CacheWriterOptions {
  readonly cache: NoteIndexCache | null;
  readonly schedule: (callback: () => void) => () => void;
  readonly canSchedule: () => boolean;
  readonly canSave: () => boolean;
  readonly collect: (paths?: Iterable<string>) => NoteIndexCacheChanges;
  readonly onError: (error: unknown) => void;
}

/** Tracks outstanding persistence without retaining another copy of note contents. */
export class NoteIndexCacheWriter {
  private cancelScheduled: (() => void) | null = null;
  private tail: Promise<void> = Promise.resolve();
  private dirty = new Map<string, number>();
  private revision = 0;
  private writes = 0;
  private canRetry = true;
  private replaceAll = false;

  constructor(private readonly options: CacheWriterOptions) {}

  reset(replaceAll: boolean): void {
    this.cancel();
    this.dirty = new Map();
    this.replaceAll = replaceAll;
    this.canRetry = true;
  }

  changed(path: string): void {
    if (this.options.cache !== null && this.options.canSchedule()) {
      this.dirty.set(path, ++this.revision);
      this.canRetry = true;
    }
  }

  schedule(): void {
    if (this.writes > 0 || (!this.replaceAll && this.dirty.size === 0)) return;
    if (this.options.cache === null || !this.options.canSchedule() || this.cancelScheduled !== null) return;
    this.cancelScheduled = this.options.schedule(() => {
      this.cancelScheduled = null;
      if (!this.options.canSave()) {
        this.schedule();
        return;
      }
      void this.save().catch(() => undefined);
    });
  }

  cancel(): void {
    this.cancelScheduled?.();
    this.cancelScheduled = null;
  }

  settled(): Promise<void> {
    return this.tail;
  }

  clear(): Promise<void> {
    const cache = this.options.cache;
    if (cache === null) return Promise.reject(new Error("NoteIndex cache is not configured"));
    const clear = this.tail.then(() => cache.clear());
    this.tail = clear.catch(() => undefined);
    return clear;
  }

  save(): Promise<void> {
    const cache = this.options.cache;
    if (cache === null) return Promise.reject(new Error("NoteIndex cache is not configured"));
    const dirty = this.dirty;
    const changes = new Map(dirty);
    const full = this.replaceAll || cache.applyChanges === undefined;
    if (!full && changes.size === 0) return this.tail;
    let rows: NoteIndexCacheChanges;
    try {
      rows = this.options.collect(full ? undefined : changes.keys());
    } catch (error) {
      this.failed(dirty, error);
      return Promise.reject(error instanceof Error ? error : new Error("Failed to collect cache entries", { cause: error }));
    }
    this.writes += 1;
    const save = this.tail.then(async () => {
      if (full || cache.applyChanges === undefined) {
        await cache.save(createPersistedNoteIndexSnapshot(rows.upserts));
      } else {
        await cache.applyChanges(rows);
      }
    }).then(() => {
      this.writes -= 1;
      // A path may change again while this batch waits for an earlier transaction.
      if (dirty !== this.dirty) return;
      if (full) this.replaceAll = false;
      for (const [path, revision] of changes) {
        if (dirty.get(path) === revision) dirty.delete(path);
      }
      this.schedule();
    }, (error: unknown) => {
      this.writes -= 1;
      this.failed(dirty, error);
      throw error;
    });
    this.tail = save.catch(() => undefined);
    return save;
  }

  private failed(dirty: ReadonlyMap<string, number>, error: unknown): void {
    this.options.onError(error);
    if (dirty !== this.dirty) return;
    if (error instanceof MissingNoteIndexCacheBaseline) this.replaceAll = true;
    // One delayed retry for transient errors. A later edit permits another try.
    if (this.canRetry) {
      this.canRetry = false;
      this.schedule();
    }
  }
}
