import { describe, expect, it } from "vitest";

import { parseNote } from "../../src/core/note/parsed-note";
import { toggleTaskInContent } from "../../src/core/note/task-line-rewrite";

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
});
