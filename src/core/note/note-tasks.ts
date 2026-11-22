import type { MarkdownBodyLineProjection, MarkdownBodyProjection } from "../document/markdown-body-projection";
import { parseLocalDateKey } from "../periodic/periodic-date";

export interface NoteTask {
  readonly text: string;
  readonly completed: boolean;
  readonly dueDate: string | null;
  readonly scheduledDate: string | null;
  readonly startDate: string | null;
  readonly doneDate: string | null;
  readonly path: string;
  readonly line: number;
}

const TASK_DATE_KINDS = {
  "📅": "dueDate",
  "⏳": "scheduledDate",
  "⌛": "scheduledDate",
  "🛫": "startDate",
  "✅": "doneDate",
} as const;
type TaskDateKind = typeof TASK_DATE_KINDS[keyof typeof TASK_DATE_KINDS];

export function parseNoteTasks(
  projection: MarkdownBodyProjection,
  path: string,
): readonly NoteTask[] {
  const tasks: NoteTask[] = [];
  for (const line of projection.lines) {
    const parsed = parseTaskLine(line, path);
    if (parsed !== null) tasks.push(parsed.task);
  }
  return Object.freeze(tasks);
}

/** Keep writable source coordinates ephemeral; the index contains only task values. */
export function parseTaskLine(line: MarkdownBodyLineProjection, path: string) {
  const marker = line.taskMarker;
  if (marker === null) return null;
  const dates: Partial<Record<TaskDateKind, string | null>> = {};
  let dueOffset: number | null = null;
  const visibleWithoutDates = line.visibleText.split("");
  for (const match of line.taskText.matchAll(/(📅|⏳|⌛|🛫|✅)\s*(\d{4}-\d{2}-\d{2})(?!\d)/gu)) {
    const kind = TASK_DATE_KINDS[match[1] as keyof typeof TASK_DATE_KINDS];
    const date = match[2]!;
    const end = match.index + match[0].length;
    if (!(kind in dates)) {
      dates[kind] = parseLocalDateKey(date) === null ? null : date;
      if (kind === "dueDate" && dates[kind] !== null) dueOffset = end - date.length;
    }
    for (let index = match.index; index < end; index += 1) visibleWithoutDates[index] = " ";
  }
  const rawText = line.visibleText.slice(marker.contentOffset).trim();
  const text = visibleWithoutDates.join("").slice(marker.contentOffset).replace(/\s+/g, " ").trim();
  const task: NoteTask = Object.freeze({
    text: text || rawText,
    completed: line.semanticText[marker.checkboxOffset] !== " ",
    dueDate: dates.dueDate ?? null,
    scheduledDate: dates.scheduledDate ?? null,
    startDate: dates.startDate ?? null,
    doneDate: dates.doneDate ?? null,
    path,
    line: line.sourceLine,
  });
  return { task, checkboxOffset: marker.checkboxOffset, dueOffset };
}
