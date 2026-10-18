import { describe, expect, it } from "vitest";

import { parseNote } from "../../src/core/note/parsed-note";
import {
  rescheduleTaskDueDateInContent,
  toggleTaskInContent,
} from "../../src/core/note/task-line-rewrite";

describe("task list container source coordinates", () => {
  it.each(["+", "1.", "42)", "> -", "> > *", "> 1.", "> +", "- -", "- > 1."])(
    "parses and rewrites only the task marker inside %s", (prefix) => {
      const content = `\uFEFF${prefix} [X] 😀 \`example\` %% 📅 2000-01-01 %% 📅 2026-10-17\r\n`;
      const note = parseNote("Tasks.md", content);
      const task = note.tasks[0]!;
      expect(task).toMatchObject({
        text: "😀 `example`", completed: true, dueDate: "2026-10-17", line: 0,
      });
      expect(note.preview).toBe("😀 📅 2026-10-17");
      expect(toggleTaskInContent(content, task)).toEqual({
        status: "updated", content: content.replace("[X]", "[ ]"),
      });
      expect(rescheduleTaskDueDateInContent(
        content, task, { year: 2026, month: 10, day: 18 },
      )).toEqual({
        status: "updated", content: content.replace("2026-10-17", "2026-10-18"),
      });
    },
  );

  it.each([
    "> [!todo]\n> + [ ] `example` 📅 2026-10-17",
    "1. parent\n   > + [ ] `example` 📅 2026-10-17",
    "> [!note]\r\n> > 1) [ ] `example` 📅 2026-10-17\rTail\n",
  ])("preserves callouts, indentation, code labels and line endings in %s", (content) => {
    const task = parseNote("Tasks.md", content).tasks[0]!;
    expect(task).toMatchObject({ text: "`example`", dueDate: "2026-10-17", line: 1 });
    expect(toggleTaskInContent(content, task)).toEqual({
      status: "updated", content: content.replace("[ ]", "[x]"),
    });
  });

  it.each([
    "> [ ] ordinary quote",
    "    + [ ] indented code",
    "\t1. [ ] indented code",
    "> ```\n> + [ ] fenced code\n> ```",
    "\\+ [ ] escaped marker",
    "Text + [ ] ordinary paragraph",
    "- `[ ]` code checkbox",
    "%%\n> 1. [ ] hidden task\n%%",
  ])("rejects lookalike task markers in %s", (content) => {
    expect(parseNote("Tasks.md", content).tasks).toHaveLength(0);
  });

  it("refuses a stale task whose date or entire line is now hidden", () => {
    const original = "+ [ ] Work 📅 2026-10-17";
    const task = parseNote("Tasks.md", original).tasks[0]!;
    for (const content of [
      "+ [ ] Work %% 📅 2026-10-17 %%",
      "%% + [ ] Work 📅 2026-10-17 %%",
    ]) {
      expect(toggleTaskInContent(content, task)).toEqual({ status: "stale" });
      expect(rescheduleTaskDueDateInContent(
        content, task, { year: 2026, month: 10, day: 18 },
      )).toEqual({ status: "stale" });
    }
  });
});
