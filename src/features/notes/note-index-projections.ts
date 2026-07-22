import type { NoteIntervalBoundary } from "../../core/note/note-interval";
import type { NoteStatistics } from "../../core/note/note-statistics";
import type { NoteTask } from "../../core/note/note-tasks";
import type { ParsedNote } from "../../core/note/parsed-note";
import {
  parseLocalDateKey,
  type LocalDate,
} from "../../core/periodic/periodic-date";

export type TaskDateKind = "due" | "scheduled" | "start";

export interface TaskDateRef {
  readonly date: LocalDate;
  readonly dateKey: string;
  readonly dateKinds: readonly TaskDateKind[];
  readonly dueDate: LocalDate | null;
  readonly task: NoteTask;
}

export interface TaskDateIndexSnapshot {
  readonly revision: number;
  readonly byDate: Readonly<Record<string, readonly TaskDateRef[]>>;
}

export interface IntervalNoteRef {
  readonly path: string;
  readonly title: string;
  readonly start: NoteIntervalBoundary;
  readonly end: NoteIntervalBoundary;
  readonly dayCount: number;
  readonly statistics: NoteStatistics;
}

export interface IntervalIndexSnapshot {
  readonly revision: number;
  readonly items: readonly IntervalNoteRef[];
}

const EMPTY_TASK_BUCKETS = Object.freeze(
  Object.create(null) as Record<string, readonly TaskDateRef[]>,
);
const EMPTY_INTERVAL_ITEMS = Object.freeze([]) as readonly IntervalNoteRef[];

export const EMPTY_TASK_DATE_INDEX_SNAPSHOT: TaskDateIndexSnapshot = Object.freeze({
  revision: 0,
  byDate: EMPTY_TASK_BUCKETS,
});

export const EMPTY_INTERVAL_INDEX_SNAPSHOT: IntervalIndexSnapshot = Object.freeze({
  revision: 0,
  items: EMPTY_INTERVAL_ITEMS,
});

/** Mutable implementation detail owned exclusively by NoteIndex. */
export class NoteIndexProjections {
  private readonly taskContributionsByPath = new Map<
    string,
    readonly TaskDateRef[]
  >();
  private readonly intervalContributionsByPath = new Map<string, IntervalNoteRef>();
  private taskDateSnapshot = EMPTY_TASK_DATE_INDEX_SNAPSHOT;
  private intervalSnapshot = EMPTY_INTERVAL_INDEX_SNAPSHOT;

  get taskDates(): TaskDateIndexSnapshot {
    return this.taskDateSnapshot;
  }

  get intervals(): IntervalIndexSnapshot {
    return this.intervalSnapshot;
  }

  replace(path: string, note: ParsedNote | null): void {
    this.replaceBatch([[path, note]]);
  }

  /**
   * Apply one publication batch with at most one copy/sort per projection.
   * Later entries for the same path win, matching the reduced event batch.
   */
  replaceBatch(
    changes: Iterable<readonly [path: string, note: ParsedNote | null]>,
  ): void {
    const normalized = new Map<string, ParsedNote | null>();
    for (const [path, note] of changes) normalized.set(path, note);
    if (normalized.size === 0) return;
    this.replaceTaskContributions(normalized);
    this.replaceIntervalContributions(normalized);
  }

  clear(): void {
    if (this.taskContributionsByPath.size > 0) {
      this.taskContributionsByPath.clear();
      this.taskDateSnapshot = Object.freeze({
        revision: this.taskDateSnapshot.revision + 1,
        byDate: EMPTY_TASK_BUCKETS,
      });
    }
    if (this.intervalContributionsByPath.size > 0) {
      this.intervalContributionsByPath.clear();
      this.intervalSnapshot = Object.freeze({
        revision: this.intervalSnapshot.revision + 1,
        items: EMPTY_INTERVAL_ITEMS,
      });
    }
  }

  private replaceTaskContributions(changes: ReadonlyMap<string, ParsedNote | null>): void {
    const replacements: TaskContributionReplacement[] = [];
    const affectedDateKeys = new Set<string>();
    const removedRefs = new Set<TaskDateRef>();
    const additionsByDate = new Map<string, TaskDateRef[]>();
    for (const [path, note] of changes) {
      const current = this.taskContributionsByPath.get(path) ?? EMPTY_TASK_REFS;
      const next = note === null ? EMPTY_TASK_REFS : collectTaskDateRefs(note.tasks);
      if (areTaskDateRefsEqual(current, next)) continue;
      replacements.push({ path, next });
      for (const ref of current) {
        affectedDateKeys.add(ref.dateKey);
        removedRefs.add(ref);
      }
      for (const ref of next) {
        affectedDateKeys.add(ref.dateKey);
        const additions = additionsByDate.get(ref.dateKey);
        if (additions === undefined) additionsByDate.set(ref.dateKey, [ref]);
        else additions.push(ref);
      }
    }
    if (replacements.length === 0) return;

    const nextBuckets = Object.assign(
      Object.create(null) as Record<string, readonly TaskDateRef[]>,
      this.taskDateSnapshot.byDate,
    );
    for (const dateKey of affectedDateKeys) {
      const bucket = (this.taskDateSnapshot.byDate[dateKey] ?? EMPTY_TASK_REFS)
        .filter((ref) => !removedRefs.has(ref));
      bucket.push(...(additionsByDate.get(dateKey) ?? EMPTY_TASK_REFS));
      if (bucket.length === 0) {
        delete nextBuckets[dateKey];
        continue;
      }
      bucket.sort(compareTaskDateRefs);
      nextBuckets[dateKey] = Object.freeze(bucket);
    }

    for (const { path, next } of replacements) {
      if (next.length === 0) this.taskContributionsByPath.delete(path);
      else this.taskContributionsByPath.set(path, next);
    }
    this.taskDateSnapshot = Object.freeze({
      revision: this.taskDateSnapshot.revision + 1,
      byDate: Object.freeze(nextBuckets),
    });
  }

  private replaceIntervalContributions(
    changes: ReadonlyMap<string, ParsedNote | null>,
  ): void {
    let changed = false;
    for (const [path, note] of changes) {
      const current = this.intervalContributionsByPath.get(path) ?? null;
      const next = note === null ? null : collectIntervalNoteRef(note);
      if (areIntervalNoteRefsEqual(current, next)) continue;
      changed = true;
      if (next === null) this.intervalContributionsByPath.delete(path);
      else this.intervalContributionsByPath.set(path, next);
    }
    if (!changed) return;

    const items = [...this.intervalContributionsByPath.values()]
      .sort(compareIntervalNotes);
    this.intervalSnapshot = Object.freeze({
      revision: this.intervalSnapshot.revision + 1,
      items: items.length === 0 ? EMPTY_INTERVAL_ITEMS : Object.freeze(items),
    });
  }
}

const EMPTY_TASK_REFS = Object.freeze([]) as readonly TaskDateRef[];

interface TaskContributionReplacement {
  readonly path: string;
  readonly next: readonly TaskDateRef[];
}

interface CollectedTaskDate {
  readonly date: LocalDate;
  readonly kinds: TaskDateKind[];
}

function collectTaskDateRefs(tasks: readonly NoteTask[]): readonly TaskDateRef[] {
  const refs: TaskDateRef[] = [];
  for (const task of tasks) {
    const parsedDates = new Map<string, LocalDate | null>();
    const parseDate = (dateKey: string): LocalDate | null => {
      if (parsedDates.has(dateKey)) return parsedDates.get(dateKey) ?? null;
      const date = parseLocalDateKey(dateKey);
      parsedDates.set(dateKey, date);
      return date;
    };
    const dates = new Map<string, CollectedTaskDate>();
    addTaskDate(dates, task.dueDate, "due", parseDate);
    addTaskDate(dates, task.scheduledDate, "scheduled", parseDate);
    addTaskDate(dates, task.startDate, "start", parseDate);
    const dueDate = task.dueDate === null ? null : parseDate(task.dueDate);
    for (const [dateKey, value] of dates) {
      refs.push(Object.freeze({
        date: value.date,
        dateKey,
        dateKinds: Object.freeze(value.kinds),
        dueDate,
        task,
      }));
    }
  }
  refs.sort(
    (left, right) =>
      left.dateKey.localeCompare(right.dateKey) || compareTaskDateRefs(left, right),
  );
  return refs.length === 0 ? EMPTY_TASK_REFS : Object.freeze(refs);
}

function addTaskDate(
  dates: Map<string, CollectedTaskDate>,
  dateKey: string | null,
  kind: TaskDateKind,
  parseDate: (dateKey: string) => LocalDate | null,
): void {
  if (dateKey === null) return;
  const current = dates.get(dateKey);
  if (current !== undefined) {
    current.kinds.push(kind);
    return;
  }
  const date = parseDate(dateKey);
  if (date === null) return;
  dates.set(dateKey, { date, kinds: [kind] });
}

function compareTaskDateRefs(left: TaskDateRef, right: TaskDateRef): number {
  return left.task.path.localeCompare(right.task.path) || left.task.line - right.task.line;
}

function areTaskDateRefsEqual(
  left: readonly TaskDateRef[],
  right: readonly TaskDateRef[],
): boolean {
  return left.length === right.length && left.every((value, index) => {
    const candidate = right[index];
    return candidate !== undefined &&
      value.dateKey === candidate.dateKey &&
      areTaskDateKindsEqual(value.dateKinds, candidate.dateKinds) &&
      areNoteTasksEqual(value.task, candidate.task);
  });
}

function areTaskDateKindsEqual(
  left: readonly TaskDateKind[],
  right: readonly TaskDateKind[],
): boolean {
  return left.length === right.length && left.every((kind, index) => kind === right[index]);
}

function areNoteTasksEqual(left: NoteTask, right: NoteTask): boolean {
  return left.text === right.text &&
    left.completed === right.completed &&
    left.dueDate === right.dueDate &&
    left.scheduledDate === right.scheduledDate &&
    left.startDate === right.startDate &&
    left.doneDate === right.doneDate &&
    left.path === right.path &&
    left.line === right.line;
}

function collectIntervalNoteRef(note: ParsedNote): IntervalNoteRef | null {
  if (note.interval === null) return null;
  return Object.freeze({
    path: note.path,
    title: getTitle(note.path),
    start: note.interval.start,
    end: note.interval.end,
    dayCount: note.interval.dayCount,
    statistics: note.statistics,
  });
}

function areIntervalNoteRefsEqual(
  left: IntervalNoteRef | null,
  right: IntervalNoteRef | null,
): boolean {
  if (left === null || right === null) return left === right;
  return left.path === right.path &&
    left.title === right.title &&
    areIntervalBoundariesEqual(left.start, right.start) &&
    areIntervalBoundariesEqual(left.end, right.end) &&
    left.dayCount === right.dayCount &&
    areNoteStatisticsEqual(left.statistics, right.statistics);
}

function areIntervalBoundariesEqual(
  left: NoteIntervalBoundary,
  right: NoteIntervalBoundary,
): boolean {
  return left.value === right.value &&
    left.dateKey === right.dateKey &&
    left.hasTime === right.hasTime &&
    left.epochMillis === right.epochMillis;
}

function areNoteStatisticsEqual(left: NoteStatistics, right: NoteStatistics): boolean {
  return left.wordCount === right.wordCount &&
    left.linkCount === right.linkCount &&
    left.tagCount === right.tagCount &&
    left.taskTotal === right.taskTotal &&
    left.taskCompleted === right.taskCompleted &&
    left.taskCompletionRate === right.taskCompletionRate;
}

function compareIntervalNotes(left: IntervalNoteRef, right: IntervalNoteRef): number {
  return left.start.epochMillis - right.start.epochMillis ||
    left.end.epochMillis - right.end.epochMillis ||
    left.title.localeCompare(right.title) ||
    left.path.localeCompare(right.path);
}

function getTitle(path: string): string {
  const filename = path.split("/").at(-1) ?? path;
  return filename.toLowerCase().endsWith(".md") ? filename.slice(0, -3) : filename;
}
