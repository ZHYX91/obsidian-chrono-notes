import { describe, expect, it } from "vitest";

import { parseNote } from "../../src/core/note/parsed-note";
import { rescheduleTaskDueDateInContent } from "../../src/core/note/task-line-rewrite";

function reschedule(content: string) {
  const task = parseNote("Tasks.md", content).tasks[0];
  if (task === undefined) throw new Error("Task fixture was not parsed");
  expect(task.dueDate).toBe("2026-09-13");
  return rescheduleTaskDueDateInContent(content, task, { year: 2026, month: 9, day: 15 });
}

describe("semantic task date source coordinates", () => {
  it.each([
    "\uFEFF- [ ] Work 📅 2026-09-13",
    "- [ ] Work 📅 2026-09-13",
    "\uFEFFHeading\r\n- [ ] Work 📅 2026-09-13\rTail\n",
    "\uFEFF---\r\ntitle: keep\r\n---\r\n- [ ] Work 📅 2026-09-13",
    "\uFEFF- [ ] 😀 `📅 2000-01-01` <!-- keep --> 📅\t2026-09-13",
  ])("preserves BOM and source offsets in %s", (content) => {
    expect(reschedule(content)).toEqual({
      status: "updated", content: content.replace("2026-09-13", "2026-09-15"),
    });
  });

  it.each([
    "`📅 2000-01-01`",
    "<!-- 📅 2000-01-01 -->",
    "😀 `📅 2000-01-01` <!-- 📅 2001-01-01 -->",
  ])("preserves a preceding masked marker in %s and original line endings", (prefix) => {
    for (const ending of ["\n", "\r\n", "\r"]) {
      const content = [
        "---", "title: keep", "---",
        `- [ ] Work ${prefix} 📅 2026-09-13 ⏳ 2026-09-14`, "Unrelated text", "",
      ].join(ending);
      expect(reschedule(content)).toEqual({
        status: "updated", content: content.replace("📅 2026-09-13", "📅 2026-09-15"),
      });
    }
  });

  it("preserves date-marker whitespace", () => {
    const content = "- [ ] Work 📅\t2026-09-13";
    expect(reschedule(content)).toEqual({
      status: "updated", content: "- [ ] Work 📅\t2026-09-15",
    });
  });

  it("rewrites only the first semantic due date, not a masked or later marker", () => {
    const content = "- [ ] Work `📅 2000-01-01` 📅 2026-09-13 📅 2027-03-20";
    expect(reschedule(content)).toEqual({
      status: "updated", content: "- [ ] Work `📅 2000-01-01` 📅 2026-09-15 📅 2027-03-20",
    });
  });
});
