import type { NoteIndexCache, PersistedNoteIndexSnapshot } from "./note-index-cache";

interface CacheWriterOptions {
  readonly cache: NoteIndexCache | null;
  readonly schedule: (callback: () => void) => () => void;
  readonly canSchedule: () => boolean;
  readonly canSave: () => boolean;
  readonly snapshot: () => PersistedNoteIndexSnapshot;
  readonly onError: (error: unknown) => void;
}

/** Owns only delayed/serialized persistence. NoteIndex still owns every published fact. */
export class NoteIndexCacheWriter {
  private cancelScheduled: (() => void) | null = null;
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly options: CacheWriterOptions) {}

  schedule(): void {
    if (this.options.cache === null || !this.options.canSchedule() || this.cancelScheduled !== null) return;
    this.cancelScheduled = this.options.schedule(() => {
      this.cancelScheduled = null;
      if (!this.options.canSave()) {
        this.schedule();
        return;
      }
      void this.save(this.options.snapshot()).catch(() => undefined);
    });
  }

  cancel(): void {
    this.cancelScheduled?.();
    this.cancelScheduled = null;
  }

  settled(): Promise<void> {
    return this.tail;
  }

  save(snapshot: PersistedNoteIndexSnapshot): Promise<void> {
    const cache = this.options.cache;
    if (cache === null) return Promise.reject(new Error("NoteIndex cache is not configured"));
    const save = this.tail.then(() => cache.save(snapshot));
    this.tail = save.catch((error: unknown) => { this.options.onError(error); });
    return save;
  }
}
