import type { NoteContentState } from "../../core/document/parse-note-document";
import type { NoteStatistics } from "../../core/note/note-statistics";
import type {
  LocalDate,
  PeriodicNoteType,
  WeekStartDay,
} from "../../core/periodic/periodic-date";
import { formatPeriodicNotePath } from "../../core/periodic/periodic-note-path";
import type { NoteIndexSnapshot } from "../notes/note-index";

export type IndexedPeriodicNoteState =
  | NoteContentState
  | "missing"
  | "error"
  | "not-configured";

export interface IndexedPeriodicNote {
  readonly date: LocalDate;
  readonly notePath: string | null;
  readonly noteState: IndexedPeriodicNoteState;
  readonly preview: string | null;
  readonly statistics: NoteStatistics;
  readonly errorMessage?: string;
}

export function hasIndexedPeriodicNote(
  state: IndexedPeriodicNoteState,
): boolean {
  return (
    state === "empty" ||
    state === "yaml-only" ||
    state === "has-body" ||
    state === "error"
  );
}

export interface PeriodicNoteRule {
  readonly enabled: boolean;
  readonly pattern: string;
}

export interface PeriodicNotePathContext {
  readonly locale: string;
  readonly weekStartDay: WeekStartDay;
}

const EMPTY_STATISTICS: NoteStatistics = Object.freeze({
  wordCount: 0,
  linkCount: 0,
  tagCount: 0,
  taskTotal: 0,
  taskCompleted: 0,
  taskCompletionRate: 0,
});

export function selectIndexedPeriodicNote(
  date: LocalDate,
  noteType: PeriodicNoteType,
  snapshot: NoteIndexSnapshot,
  context: PeriodicNotePathContext,
  rule: PeriodicNoteRule,
): IndexedPeriodicNote {
  if (!rule.enabled || rule.pattern.trim().length === 0) {
    return emptyIndexedPeriodicNote(date, null, "not-configured");
  }

  const notePath = formatPeriodicNotePath(
    date,
    { noteType, pattern: rule.pattern },
    context,
  );
  if (notePath === null) {
    return emptyIndexedPeriodicNote(date, null, "not-configured");
  }

  const entry = snapshot.notes[notePath];
  if (entry === undefined) {
    return emptyIndexedPeriodicNote(date, notePath, "missing");
  }
  if (entry.kind === "error") {
    return Object.freeze({
      date,
      notePath,
      noteState: "error",
      preview: null,
      statistics: EMPTY_STATISTICS,
      errorMessage: entry.error.message,
    });
  }

  return Object.freeze({
    date,
    notePath,
    noteState: entry.note.state,
    preview: entry.note.preview,
    statistics: entry.note.statistics,
  });
}

function emptyIndexedPeriodicNote(
  date: LocalDate,
  notePath: string | null,
  noteState: Extract<IndexedPeriodicNoteState, "missing" | "not-configured">,
): IndexedPeriodicNote {
  return Object.freeze({
    date,
    notePath,
    noteState,
    preview: null,
    statistics: EMPTY_STATISTICS,
  });
}
