import type { NoteContentState } from "../../core/document/parse-note-document";
import type { NoteEmbedStatistics } from "../../core/note/note-preview";
import type { NoteStatistics } from "../../core/note/note-statistics";
import type { NoteInterval } from "../../core/note/note-interval";
import type { NoteTask } from "../../core/note/note-tasks";
import type { ParsedNote } from "../../core/note/parsed-note";

/**
 * The immutable, query-facing subset of a parsed note.
 *
 * Source document text remains an internal NoteIndex concern and is never
 * copied into the persistent derived-data cache.
 */
export interface IndexedNote {
  readonly path: string;
  readonly state: NoteContentState;
  readonly interval: NoteInterval | null;
  readonly preview: string | null;
  readonly embeds: NoteEmbedStatistics;
  readonly tasks: readonly NoteTask[];
  readonly statistics: NoteStatistics;
}

export function createIndexedNote(note: ParsedNote): IndexedNote {
  return Object.freeze({
    path: note.path,
    state: note.state,
    interval: note.interval,
    preview: note.preview,
    embeds: note.embeds,
    tasks: note.tasks,
    statistics: note.statistics,
  });
}
