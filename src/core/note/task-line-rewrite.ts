import { projectMarkdownBody } from "../document/markdown-body-projection";
import { parseNoteDocument } from "../document/parse-note-document";
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
  return rewriteTaskLine(content, expected, (line, semanticLine) => {
    // Locate the same marker used by the parser, not a lookalike in code or
    // a comment. The projection retains UTF-16 offsets into the source line.
    const match = /📅\s*(\d{4}-\d{2}-\d{2})/u.exec(semanticLine);
    const date = match?.[1];
    if (match === null || date === undefined) return line;
    const start = match.index + match[0].length - date.length;
    // Replace only the date, preserving marker spacing and all masked text.
    return `${line.slice(0, start)}${nextDateKey}${line.slice(start + date.length)}`;
  });
}

function rewriteTaskLine(
  content: string,
  expected: NoteTask,
  update: (line: string, semanticLine: string) => string,
): TaskLineRewriteResult {
  const range = findLineRange(content, expected.line);
  if (range === null) return Object.freeze({ status: "line-missing" });
  const line = content.slice(range.start, range.end);
  const document = parseNoteDocument(content);
  const projection = projectMarkdownBody(document.body, document.bodyStartLine);
  const current = parseNoteTasks(projection, expected.path).find(
    (task) => task.line === expected.line,
  );
  const projectedLine = projection.lines.find((item) => item.sourceLine === expected.line);
  if (current === undefined || projectedLine === undefined || !sameTaskIdentity(current, expected)) {
    return Object.freeze({ status: "stale" });
  }
  // The document parser removes the file BOM. Restore its source coordinate
  // before mapping semantic offsets back into the original first line.
  const semanticLine = document.hadBom && expected.line === 0
    ? ` ${projectedLine.semanticText}`
    : projectedLine.semanticText;
  const updatedLine = update(line, semanticLine);
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
