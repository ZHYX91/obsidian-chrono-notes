import {
  formatLocalDateKey,
  toDateTime,
  type LocalDate,
} from "../periodic/periodic-date";
import { parseNoteTasks, type NoteTask } from "./note-tasks";

export type TaskLineRewriteResult =
  | Readonly<{ status: "updated"; content: string }>
  | Readonly<{
      status: "invalid-date" | "line-missing" | "no-due" | "stale" | "unchanged";
    }>;

export function toggleTaskInContent(
  content: string,
  expected: NoteTask,
): TaskLineRewriteResult {
  return rewriteTaskLine(content, expected, (line) =>
    line.replace(
      /^(\s*[-*]\s+\[)[ xX](\])/u,
      `$1${expected.completed ? " " : "x"}$2`,
    ));
}

export function rescheduleTaskDueDateInContent(
  content: string,
  expected: NoteTask,
  nextDueDate: LocalDate,
): TaskLineRewriteResult {
  if (!isValidDate(nextDueDate)) return Object.freeze({ status: "invalid-date" });
  if (expected.dueDate === null) return Object.freeze({ status: "no-due" });
  const nextDateKey = formatLocalDateKey(nextDueDate);
  if (expected.dueDate === nextDateKey) return Object.freeze({ status: "unchanged" });
  return rewriteTaskLine(content, expected, (line) =>
    line.replace(/📅\s*\d{4}-\d{2}-\d{2}/u, `📅 ${nextDateKey}`));
}

function rewriteTaskLine(
  content: string,
  expected: NoteTask,
  update: (line: string) => string,
): TaskLineRewriteResult {
  const range = findLineRange(content, expected.line);
  if (range === null) return Object.freeze({ status: "line-missing" });
  const line = content.slice(range.start, range.end);
  const current = parseNoteTasks(line, expected.path, expected.line)[0];
  if (current === undefined || !sameTaskIdentity(current, expected)) {
    return Object.freeze({ status: "stale" });
  }
  const updatedLine = update(line);
  if (updatedLine === line) return Object.freeze({ status: "stale" });
  return Object.freeze({
    status: "updated",
    content: `${content.slice(0, range.start)}${updatedLine}${content.slice(range.end)}`,
  });
}

function findLineRange(
  content: string,
  targetLine: number,
): Readonly<{ start: number; end: number }> | null {
  if (!Number.isInteger(targetLine) || targetLine < 0) return null;
  let line = 0;
  let start = 0;
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (character !== "\n" && character !== "\r") continue;
    if (line === targetLine) return { start, end: index };
    if (character === "\r" && content[index + 1] === "\n") index += 1;
    line += 1;
    start = index + 1;
  }
  return line === targetLine ? { start, end: content.length } : null;
}

function sameTaskIdentity(current: NoteTask, expected: NoteTask): boolean {
  return current.path === expected.path &&
    current.line === expected.line &&
    current.text === expected.text &&
    current.completed === expected.completed &&
    current.dueDate === expected.dueDate &&
    current.scheduledDate === expected.scheduledDate &&
    current.startDate === expected.startDate &&
    current.doneDate === expected.doneDate;
}

function isValidDate(date: LocalDate): boolean {
  try {
    toDateTime(date);
    return true;
  } catch {
    return false;
  }
}
