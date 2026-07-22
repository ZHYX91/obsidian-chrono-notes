import { describe, expect, it } from "vitest";

import { parseNote } from "../../src/core/note/parsed-note";
import {
  rescheduleTaskDueDateInContent,
  toggleTaskInContent,
} from "../../src/core/note/task-line-rewrite";

function task(content: string, index = 0) {
  const value = parseNote("Tasks.md", content).tasks[index];
  if (value === undefined) throw new Error("Task fixture was not parsed");
  return value;
}

describe("task line rewriting", () => {
  it("toggles only the checked marker while preserving mixed line endings", () => {
    const content = "intro\r\n- [ ] Keep 📅 2026-01-05\rnext\r- [x] Other\n";
    const result = toggleTaskInContent(content, task(content));

    expect(result).toEqual({
      status: "updated",
      content: "intro\r\n- [x] Keep 📅 2026-01-05\rnext\r- [x] Other\n",
    });
  });

  it("rejects a missing or changed source line instead of editing stale content", () => {
    const original = "heading\n- [ ] Original 📅 2026-01-05";
    const expected = task(original);

    expect(toggleTaskInContent("heading", expected)).toEqual({ status: "line-missing" });
    expect(toggleTaskInContent("heading\n- [ ] Changed 📅 2026-01-05", expected)).toEqual({
      status: "stale",
    });
  });

  it("replaces only an existing due date and validates all refusal cases", () => {
    const content = "- [ ] Keep 📅 2026-01-05 ⏳ 2026-01-06 🛫 2026-01-07\r\n";
    expect(rescheduleTaskDueDateInContent(
      content,
      task(content),
      { year: 2026, month: 1, day: 12 },
    )).toEqual({
      status: "updated",
      content: "- [ ] Keep 📅 2026-01-12 ⏳ 2026-01-06 🛫 2026-01-07\r\n",
    });
    expect(rescheduleTaskDueDateInContent(
      content,
      task(content),
      { year: 2026, month: 1, day: 5 },
    )).toEqual({ status: "unchanged" });
    expect(rescheduleTaskDueDateInContent(
      content,
      task(content),
      { year: 2026, month: 2, day: 30 },
    )).toEqual({ status: "invalid-date" });

    const scheduled = "- [ ] Later ⏳ 2026-01-06";
    expect(rescheduleTaskDueDateInContent(
      scheduled,
      task(scheduled),
      { year: 2026, month: 1, day: 12 },
    )).toEqual({ status: "no-due" });
  });
});
