import type { MarkdownBodyProjection } from "../document/markdown-body-projection";
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

const DUE_PATTERN = /📅\s*(\d{4}-\d{2}-\d{2})/u;
const SCHEDULED_PATTERN = /[⏳⌛]\s*(\d{4}-\d{2}-\d{2})/u;
const START_PATTERN = /🛫\s*(\d{4}-\d{2}-\d{2})/u;
const DONE_PATTERN = /✅\s*(\d{4}-\d{2}-\d{2})/u;
const TASK_LINE_PATTERN = /^(\s*)[-*]\s+\[([ xX])\]\s+(.+)$/;
const DISPLAY_DATE_MARKER_PATTERN = /(📅|⏳|⌛|🛫|✅)\s*\d{4}-\d{2}-\d{2}/gu;

export function parseNoteTasks(
  projection: MarkdownBodyProjection,
  path: string,
): readonly NoteTask[] {
  const tasks: NoteTask[] = [];
  for (const line of projection.lines) {
    const match = TASK_LINE_PATTERN.exec(line.visibleText);
    if (match === null) continue;
    const contentStart = match[0].length - (match[3]?.length ?? 0);
    // RegExp indices are UTF-16 code-unit offsets, so keep the writable copy
    // in the same coordinate system even when emoji markers use surrogate pairs.
    const visibleWithoutDates = line.visibleText.split("");
    for (const dateMarker of line.semanticText.matchAll(DISPLAY_DATE_MARKER_PATTERN)) {
      const start = dateMarker.index;
      const end = start + dateMarker[0].length;
      for (let index = start; index < end; index += 1) visibleWithoutDates[index] = " ";
    }
    const rawText = line.visibleText.slice(contentStart).trim();
    const text = visibleWithoutDates.join("").slice(contentStart).replace(/\s+/g, " ").trim();
    tasks.push(Object.freeze({
      text: text || rawText,
      completed: match[2] !== " ",
      dueDate: parseTaskDate(DUE_PATTERN, line.semanticText),
      scheduledDate: parseTaskDate(SCHEDULED_PATTERN, line.semanticText),
      startDate: parseTaskDate(START_PATTERN, line.semanticText),
      doneDate: parseTaskDate(DONE_PATTERN, line.semanticText),
      path,
      line: line.sourceLine,
    }));
  }
  return Object.freeze(tasks);
}

function parseTaskDate(pattern: RegExp, line: string): string | null {
  const value = pattern.exec(line)?.[1];
  return value !== undefined && parseLocalDateKey(value) !== null ? value : null;
}
