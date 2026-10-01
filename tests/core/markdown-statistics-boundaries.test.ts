import { describe, expect, it } from "vitest";

import { projectMarkdownBody } from "../../src/core/document/markdown-body-projection";
import { parseNote } from "../../src/core/note/parsed-note";
import {
  rescheduleTaskDueDateInContent,
  toggleTaskInContent,
} from "../../src/core/note/task-line-rewrite";

describe("Markdown and Unicode boundaries", () => {
  it.each([
    "    - [ ] this is code, not a task",
    "`sample\n    - [ ] this is code, not a task\nend`",
  ])("ignores non-task code %s", (content) => {
    expect(parseNote("Tasks.md", content).tasks).toHaveLength(0);
  });

  it.each([
    "    - [ ] this is code, not a task",
    "`sample\n    - [ ] this is code, not a task\nend`",
  ])("refuses a stale cached task now in code %s", (content) => {
    const line = content.startsWith("`") ? 1 : 0;
    const expected = { ...parseNote("Tasks.md", "- [ ] this is code, not a task").tasks[0]!, line };
    expect(toggleTaskInContent(content, expected)).toEqual({ status: "stale" });
  });

  it.each([
    "- parent\n    - [ ] nested 📅 2026-10-01",
    "- parent\n\n    - [ ] nested 📅 2026-10-01",
  ])("preserves valid nested tasks %s", (content) => {
    const current = parseNote("Tasks.md", content).tasks[0]!;
    expect(current.text).toBe("nested");
    expect(current.dueDate).toBe("2026-10-01");
    expect(toggleTaskInContent(content, current).status).toBe("updated");
  });

  it.each([
    "\t- [ ] example",
    "- parent\n\n      - [ ] example",
    "- parent\n    ```\n    - [ ] example\n    ```",
  ])("excludes code in tab/list containers %s", (content) => {
    expect(parseNote("Tasks.md", content).tasks).toHaveLength(0);
  });

  it("does not match code delimiters across independent list items", () => {
    const content = "- [ ] first `\n- [ ] second 📅 2026-10-01\nend`";
    expect(parseNote("Tasks.md", content).tasks[1]!.dueDate).toBe("2026-10-01");
  });

  it.each(["مرحبا بالعالم", "سلام دنیا", "שלום עולם", "ሰላም ዓለም", "नमस्ते दुनिया"])(
    "counts Unicode words in %s", (content) => {
      expect(parseNote("Words.md", content).statistics.wordCount).toBe(2);
    },
  );
  it.each([
    ["cafe\u0301 re-entry l’année", 3],
    ["hello中文مرحبا 𠀀", 5],
    ["می\u200cروم क्\u200dष", 2],
    ["١٢٣ ४५६ 123,456", 3],
    ["\u0301 \u200c \u200d", 0],
  ])("uses the documented Unicode counting rule for %s", (content, count) => {
    expect(parseNote("Words.md", content).statistics.wordCount).toBe(count);
  });

  it.each([
    "<!--\n```\n-->\n- [ ] after 📅 2026-10-01",
    "- [ ] before `<!-- hidden\n```\n-->\n- [ ] after 📅 2026-10-01\n```",
  ])("keeps fences inside comments from hiding following tasks %s", (content) => {
    const tasks = parseNote("Tasks.md", content).tasks;
    expect(tasks.at(-1)!.text).toBe("after");
    expect(tasks.at(-1)!.dueDate).toBe("2026-10-01");
  });

  it("retains an indented visible suffix after a multiline comment", () => {
    const note = parseNote("Words.md", "<!-- hidden\nstill hidden --> shown");
    expect(note.statistics.wordCount).toBe(1);
    expect(note.preview).toContain("shown");
  });

  it.each([
    "<!-- note -->",
    "<!-- hidden\nstill hidden -->",
    "<!-- hidden -->   ",
  ])("keeps comment-only lines from converting indented code to prose %s", (comment) => {
    const note = parseNote("Tasks.md", `${comment}\n    - [ ] sample\n\n- [ ] real`);
    expect(note.statistics.wordCount).toBe(1);
    expect(note.preview).not.toContain("sample");
    expect(note.tasks.map((task) => task.text)).toEqual(["real"]);
  });

  it.each([
    ["- <!-- hidden --> visible [[Target]] #tag", 3],
    ["> <!-- hidden --> visible [[Target]] #tag", 3],
    ["1. <!-- hidden --> visible [[Target]] #tag", 4],
    ["> - <!-- hidden --> visible [[Target]] #tag", 3],
    ["- parent\n  - <!-- hidden --> visible [[Target]] #tag", 4],
    ["> 1. <!-- hidden --> visible [[Target]] #tag", 4],
    ["1. parent\n   > <!-- hidden --> visible [[Target]] #tag", 5],
    ["- <!-- 😀 --> visible [[Target]] #tag", 3],
    ["- 😀 <!-- hidden --> visible [[Target]] #tag", 3],
    ["> <!-- hidden\n> still hidden --> visible [[Target]] #tag", 3],
  ])("preserves visible comment suffixes in containers %s", (content, words) => {
    const note = parseNote("Containers.md", content);
    expect(note.preview).toContain("visible Target #tag");
    expect(note.statistics).toMatchObject({ wordCount: words, linkCount: 1, tagCount: 1 });
    expect(note.tasks).toHaveLength(0);
    for (const line of projectMarkdownBody(content, 0).lines) {
      expect(line.visibleText.length).toBe(line.rawText.length);
      expect(line.semanticText.length).toBe(line.rawText.length);
    }
  });

  it.each([
    "- <!-- hidden -->\n      - [ ] sample",
    "> <!-- hidden -->\n>     - [ ] sample",
    "> - <!-- hidden -->\n>       - [ ] sample",
  ])("preserves code after comment-only container content %s", (content) => {
    const note = parseNote("Tasks.md", content);
    expect(note.statistics.wordCount).toBe(0);
    expect(note.preview ?? "").not.toContain("sample");
    expect(note.tasks).toHaveLength(0);
    const expected = { ...parseNote("Tasks.md", "- [ ] sample").tasks[0]!, line: 1 };
    expect(toggleTaskInContent(content, expected)).toEqual({ status: "stale" });
  });

  it("preserves Unicode source offsets when writing tasks after container comments", () => {
    const content = "\uFEFF- <!-- 😀 --> visible [[Target]] #tag\r\n" +
      "- [ ] 😀 <!-- 📅 1999-01-01 --> keep `📅 1998-01-01` 📅 2026-10-01\r\n";
    const expected = parseNote("Tasks.md", content).tasks[0]!;
    expect(expected.dueDate).toBe("2026-10-01");
    expect(toggleTaskInContent(content, expected)).toEqual({
      status: "updated", content: content.replace("- [ ]", "- [x]"),
    });
    expect(rescheduleTaskDueDateInContent(
      content, expected, { year: 2026, month: 10, day: 2 },
    )).toEqual({
      status: "updated", content: content.replace("📅 2026-10-01", "📅 2026-10-02"),
    });
  });

  it.each([
    "<!-- hidden --> shown\n    - [ ] sample",
    "- <!-- hidden --> shown\n      - [ ] sample",
    "> <!-- hidden --> shown\n>     - [ ] sample",
    "> - <!-- hidden --> shown\n>       - [ ] sample",
  ])("keeps original code blocks after a visible comment suffix %s", (content) => {
    const note = parseNote("Tasks.md", content);
    expect(note.statistics.wordCount).toBe(1);
    expect(note.preview).toContain("shown");
    expect(note.preview).not.toContain("sample");
    expect(note.tasks).toHaveLength(0);
  });
});
