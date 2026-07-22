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
  body: string,
  path: string,
  bodyStartLine: number,
): readonly NoteTask[] {
  const tasks: NoteTask[] = [];
  for (const [index, line] of body.split("\n").entries()) {
    const match = TASK_LINE_PATTERN.exec(line);
    if (match === null) continue;
    const rawText = match[3]?.trim() ?? "";
    const text = rawText.replace(DISPLAY_DATE_MARKER_PATTERN, "").replace(/\s+/g, " ").trim();
    tasks.push(Object.freeze({
      text: text || rawText,
      completed: match[2] !== " ",
      dueDate: DUE_PATTERN.exec(line)?.[1] ?? null,
      scheduledDate: SCHEDULED_PATTERN.exec(line)?.[1] ?? null,
      startDate: START_PATTERN.exec(line)?.[1] ?? null,
      doneDate: DONE_PATTERN.exec(line)?.[1] ?? null,
      path,
      line: bodyStartLine + index,
    }));
  }
  return Object.freeze(tasks);
}
