import { parseNote } from "../../src/core/note/parsed-note";
import type {
  NoteIndexSnapshot,
  PresentNoteIndexEntry,
} from "../../src/features/notes/note-index";
import { NoteIndexProjections } from "../../src/features/notes/note-index-projections";

export function createNoteIndexSnapshot(
  entries: Readonly<Record<string, PresentNoteIndexEntry>>,
  version: number,
): NoteIndexSnapshot {
  const projections = new NoteIndexProjections();
  for (const [path, entry] of Object.entries(entries)) {
    projections.replace(path, entry.kind === "parsed" ? entry.note : null);
  }
  return Object.freeze({
    version,
    notes: Object.freeze(entries),
    taskDates: projections.taskDates,
    intervals: projections.intervals,
  });
}

export function createParsedNoteIndexSnapshot(
  contents: Readonly<Record<string, string>>,
  version: number,
): NoteIndexSnapshot {
  const entries: Record<string, PresentNoteIndexEntry> = {};
  for (const [path, content] of Object.entries(contents)) {
    entries[path] = Object.freeze({
      kind: "parsed",
      revision: 1,
      note: parseNote(path, content),
    });
  }
  return createNoteIndexSnapshot(entries, version);
}
