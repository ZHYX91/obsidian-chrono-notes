import type { NoteSourceFile } from "../../core/note/note-source";
import {
  isSameLocalDate,
  parseLocalDateKey,
  type LocalDate,
} from "../../core/periodic/periodic-date";
import type { IndexedNote } from "./indexed-note";

export const NOTE_INDEX_CACHE_SCHEMA = 1;

export interface PersistedNoteIndexEntry {
  readonly file: NoteSourceFile;
  readonly note: IndexedNote;
}

export interface PersistedNoteIndexSnapshot {
  readonly schema: typeof NOTE_INDEX_CACHE_SCHEMA;
  readonly entries: readonly PersistedNoteIndexEntry[];
}

export interface NoteIndexCache {
  load(): Promise<unknown>;
  save(snapshot: PersistedNoteIndexSnapshot): Promise<void>;
  clear(): Promise<void>;
}

export function createPersistedNoteIndexSnapshot(
  entries: readonly PersistedNoteIndexEntry[],
): PersistedNoteIndexSnapshot {
  return Object.freeze({
    schema: NOTE_INDEX_CACHE_SCHEMA,
    entries: Object.freeze([...entries]),
  });
}

export function parsePersistedNoteIndexSnapshot(
  value: unknown,
): PersistedNoteIndexSnapshot | null {
  if (!isRecord(value) || value.schema !== NOTE_INDEX_CACHE_SCHEMA) return null;
  if (!Array.isArray(value.entries)) return null;
  const entries: PersistedNoteIndexEntry[] = [];
  const paths = new Set<string>();
  for (const candidate of value.entries) {
    const entry = parseEntry(candidate);
    if (entry === null || paths.has(entry.file.path)) return null;
    paths.add(entry.file.path);
    entries.push(entry);
  }
  return createPersistedNoteIndexSnapshot(entries);
}

function parseEntry(value: unknown): PersistedNoteIndexEntry | null {
  if (!isRecord(value)) return null;
  const file = parseFile(value.file);
  const note = parseIndexedNote(value.note);
  if (file === null || note === null || file.path !== note.path) return null;
  return Object.freeze({ file, note });
}

function parseFile(value: unknown): NoteSourceFile | null {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.path) ||
    !isNonNegativeFiniteNumber(value.mtime) ||
    !isNonNegativeFiniteNumber(value.size)
  ) {
    return null;
  }
  return Object.freeze({
    path: value.path,
    mtime: value.mtime,
    size: value.size,
  });
}

function parseIndexedNote(value: unknown): IndexedNote | null {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.path) ||
    !isNoteState(value.state) ||
    !(value.preview === null || typeof value.preview === "string")
  ) {
    return null;
  }
  const interval = value.interval === null ? null : parseInterval(value.interval);
  const embeds = parseEmbeds(value.embeds);
  const tasks = parseTasks(value.tasks, value.path);
  const statistics = parseStatistics(value.statistics);
  const completedTasks = tasks?.filter((task) => task.completed).length ?? 0;
  if (
    (value.interval !== null && interval === null) ||
    embeds === null ||
    tasks === null ||
    statistics === null ||
    statistics.taskTotal !== tasks.length ||
    statistics.taskCompleted !== completedTasks ||
    statistics.taskCompletionRate !== (
      tasks.length === 0 ? 0 : Math.round((completedTasks / tasks.length) * 100)
    )
  ) {
    return null;
  }
  return Object.freeze({
    path: value.path,
    state: value.state,
    interval,
    preview: value.preview,
    embeds,
    tasks,
    statistics,
  });
}

function parseInterval(value: unknown): IndexedNote["interval"] {
  if (!isRecord(value) || !isPositiveInteger(value.dayCount)) return null;
  const start = parseBoundary(value.start);
  const end = parseBoundary(value.end);
  if (start === null || end === null) return null;
  return Object.freeze({ start, end, dayCount: value.dayCount });
}

function parseBoundary(value: unknown): NonNullable<IndexedNote["interval"]>["start"] | null {
  if (
    !isRecord(value) ||
    typeof value.value !== "string" ||
    typeof value.dateKey !== "string" ||
    typeof value.hasTime !== "boolean" ||
    typeof value.epochMillis !== "number" ||
    !Number.isFinite(value.epochMillis)
  ) {
    return null;
  }
  const date = parseLocalDate(value.date);
  const keyedDate = parseLocalDateKey(value.dateKey);
  if (date === null || keyedDate === null || !isSameLocalDate(date, keyedDate)) return null;
  return Object.freeze({
    value: value.value,
    date,
    dateKey: value.dateKey,
    hasTime: value.hasTime,
    epochMillis: value.epochMillis,
  });
}

function parseLocalDate(value: unknown): LocalDate | null {
  if (
    !isRecord(value) ||
    !isPositiveInteger(value.year) ||
    !isPositiveInteger(value.month) ||
    !isPositiveInteger(value.day)
  ) {
    return null;
  }
  return Object.freeze({
    year: value.year,
    month: value.month,
    day: value.day,
  });
}

function parseEmbeds(value: unknown): IndexedNote["embeds"] | null {
  if (!isRecord(value)) return null;
  const keys = [
    "imageCount",
    "pdfCount",
    "audioCount",
    "videoCount",
    "noteCount",
    "otherCount",
  ] as const;
  if (keys.some((key) => !isNonNegativeInteger(value[key]))) return null;
  return Object.freeze({
    imageCount: value.imageCount as number,
    pdfCount: value.pdfCount as number,
    audioCount: value.audioCount as number,
    videoCount: value.videoCount as number,
    noteCount: value.noteCount as number,
    otherCount: value.otherCount as number,
  });
}

function parseTasks(value: unknown, path: string): IndexedNote["tasks"] | null {
  if (!Array.isArray(value)) return null;
  const tasks = value.map((candidate) => {
    if (
      !isRecord(candidate) ||
      typeof candidate.text !== "string" ||
      typeof candidate.completed !== "boolean" ||
      !isNullableString(candidate.dueDate) ||
      !isNullableString(candidate.scheduledDate) ||
      !isNullableString(candidate.startDate) ||
      !isNullableString(candidate.doneDate) ||
      candidate.path !== path ||
      !isNonNegativeInteger(candidate.line)
    ) {
      return null;
    }
    return Object.freeze({
      text: candidate.text,
      completed: candidate.completed,
      dueDate: candidate.dueDate,
      scheduledDate: candidate.scheduledDate,
      startDate: candidate.startDate,
      doneDate: candidate.doneDate,
      path,
      line: candidate.line,
    });
  });
  return tasks.some((task) => task === null)
    ? null
    : Object.freeze(tasks) as IndexedNote["tasks"];
}

function parseStatistics(value: unknown): IndexedNote["statistics"] | null {
  if (!isRecord(value)) return null;
  const integerKeys = [
    "wordCount",
    "linkCount",
    "tagCount",
    "taskTotal",
    "taskCompleted",
    "taskCompletionRate",
  ] as const;
  if (integerKeys.some((key) => !isNonNegativeInteger(value[key]))) return null;
  return Object.freeze({
    wordCount: value.wordCount as number,
    linkCount: value.linkCount as number,
    tagCount: value.tagCount as number,
    taskTotal: value.taskTotal as number,
    taskCompleted: value.taskCompleted as number,
    taskCompletionRate: value.taskCompletionRate as number,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNoteState(value: unknown): value is IndexedNote["state"] {
  return value === "empty" || value === "yaml-only" || value === "has-body";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}
