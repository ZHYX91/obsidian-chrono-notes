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
  it.each([
    "[[📅 2026-11-02|会议笔记]]",
    "[[📅 2026-11-02]]",
    "[会议笔记](<📅 2026-11-02>)",
    '[会议笔记](Target.md "📅 2026-11-02")',
    "![📅 2026-11-02](image.png)",
    "[会议笔记][📅 2026-11-02]",
    "[📅 2026-11-02][]",
    "[📅 2026-11-02]",
    '<span title="📅 2026-11-02">会议笔记</span>',
  ])("keeps the complete link or HTML tag intact: %s", (inline) => {
    const content = `\uFEFF> - [ ] 打开 ${inline} 📅 2026-11-05\r\n\r\n[📅 2026-11-02]: Target.md`;
    const expected = task(content);
    expect(expected.dueDate).toBe("2026-11-05");
    expect(expected.text).toContain(inline);
    expect(rescheduleTaskDueDateInContent(content, expected, { year: 2026, month: 11, day: 6 }))
      .toEqual({ status: "updated", content: content.replace("📅 2026-11-05", "📅 2026-11-06") });
  });

  it.each([
    ["[📅 2026-11-05](Target.md)", ""],
    ['[📅 2026-11-05](<📅 2026-11-02> "📅 2026-11-03")', ""],
    ["[[📅 2026-11-02|📅 2026-11-05]]", ""],
    ["[📅 2026-11-05][📅 2026-11-02]", "\r\n\r\n[📅 2026-11-02]: Target.md"],
  ])("reschedules a visible explicit label without changing its target: %s", (inline, suffix) => {
    const content = `\uFEFF> - [ ] Read ${inline}${suffix}`;
    const expected = task(content);
    expect(expected.dueDate).toBe("2026-11-05");
    expect(expected.text).not.toContain("2026-11-05");
    const rewritten = rescheduleTaskDueDateInContent(content, expected, { year: 2026, month: 11, day: 6 });
    expect(rewritten).toEqual({ status: "updated", content: content.replace("2026-11-05", "2026-11-06") });
    if (rewritten.status === "updated") expect(task(rewritten.content).dueDate).toBe("2026-11-06");
  });

  it.each([
    "[report](Report.md)",
    "[[Report]]",
    "`report`",
    "<!-- report -->",
    "%% report %%",
    '<span title="report"></span>',
  ])("does not join a date marker across protected content: %s", (inline) => {
    const content = `- [ ] Review 📅 ${inline} 2026-11-05; deadline 📅 2026-11-20`;
    const expected = task(content);
    expect(expected.dueDate).toBe("2026-11-20");
    expect(expected.text).toContain("2026-11-05");
    if (!inline.startsWith("<!--") && !inline.startsWith("%%")) expect(expected.text).toContain(inline);
    const rewritten = rescheduleTaskDueDateInContent(content, expected, { year: 2026, month: 11, day: 21 });
    expect(rewritten).toEqual({ status: "updated", content: content.replace("2026-11-20", "2026-11-21") });
    if (rewritten.status === "updated") expect(task(rewritten.content).dueDate).toBe("2026-11-21");
  });

  it("ignores all task date kinds inside links and leaves a dateless task unchanged", () => {
    const inline = "[[🛫 2026-11-01 ⏳ 2026-11-02 📅 2026-11-03 ✅ 2026-11-04|Note]]";
    const content = `- [ ] Read ${inline}`;
    const expected = task(content);
    expect(expected).toMatchObject({
      text: `Read ${inline}`, startDate: null, scheduledDate: null, dueDate: null, doneDate: null,
    });
    expect(rescheduleTaskDueDateInContent(content, expected, { year: 2026, month: 11, day: 6 }))
      .toEqual({ status: "no-due" });
    expect(toggleTaskInContent(content, expected))
      .toEqual({ status: "updated", content: content.replace("[ ]", "[x]") });
  });

  it("keeps undefined reference text eligible as ordinary task text", () => {
    const content = "- [ ] Read [📅 2026-11-05]";
    expect(task(content).dueDate).toBe("2026-11-05");
  });

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

  it.each([
    ["fenced code", "```md\n- [ ] Example 📅 2026-01-05\n```"],
    ["HTML comment", "<!--\n- [ ] Example 📅 2026-01-05\n-->"],
  ])("refuses to rewrite a cached task now hidden by %s", (_label, content) => {
    const expected = {
      ...task("- [ ] Example 📅 2026-01-05"),
      line: 1,
    };

    expect(toggleTaskInContent(content, expected)).toEqual({ status: "stale" });
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
