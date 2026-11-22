import { projectMarkdownBody } from "../document/markdown-body-projection";
import { parseNoteDocument } from "../document/parse-note-document";
import {
  formatLocalDateKey,
  parseLocalDateKey,
  type LocalDate,
} from "../periodic/periodic-date";
import { parseTaskLine, type NoteTask } from "./note-tasks";

export type TaskLineRewriteResult =
  | Readonly<{ status: "updated"; content: string }>
  | Readonly<{
      status: "invalid-date" | "line-missing" | "no-due" | "stale" | "unchanged";
    }>;

export function toggleTaskInContent(
  content: string,
  expected: NoteTask,
): TaskLineRewriteResult {
  return rewriteTaskLine(content, expected, (line, { checkboxOffset }) =>
    `${line.slice(0, checkboxOffset)}${expected.completed ? " " : "x"}` +
    line.slice(checkboxOffset + 1));
}

export function rescheduleTaskDueDateInContent(
  content: string,
  expected: NoteTask,
  nextDueDate: LocalDate,
): TaskLineRewriteResult {
  const nextDateKey = formatLocalDateKey(nextDueDate);
  if (parseLocalDateKey(nextDateKey) === null) return Object.freeze({ status: "invalid-date" });
  const oldDate = expected.dueDate;
  if (oldDate === null) return Object.freeze({ status: "no-due" });
  if (oldDate === nextDateKey) return Object.freeze({ status: "unchanged" });
  return rewriteTaskLine(content, expected, (line, { dueOffset }) => dueOffset === null
    ? line
    : line.slice(0, dueOffset) + nextDateKey + line.slice(dueOffset + oldDate.length));
}

function rewriteTaskLine(
  content: string,
  expected: NoteTask,
  update: (line: string, offsets: { checkboxOffset: number; dueOffset: number | null }) => string,
): TaskLineRewriteResult {
  const range = findLineRange(content, expected.line);
  if (range === null) return Object.freeze({ status: "line-missing" });
  const line = content.slice(range.start, range.end);
  const document = parseNoteDocument(content);
  const projection = projectMarkdownBody(document.body, document.bodyStartLine);
  const projectedLine = projection.lines[expected.line - document.bodyStartLine];
  const parsed = projectedLine === undefined ? null : parseTaskLine(projectedLine, expected.path);
  if (parsed === null || !sameTaskIdentity(parsed.task, expected)) {
    return Object.freeze({ status: "stale" });
  }
  const bomOffset = document.hadBom && expected.line === 0 ? 1 : 0;
  const updatedLine = update(line, {
    checkboxOffset: bomOffset + parsed.checkboxOffset,
    dueOffset: parsed.dueOffset === null ? null : bomOffset + parsed.dueOffset,
  });
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
