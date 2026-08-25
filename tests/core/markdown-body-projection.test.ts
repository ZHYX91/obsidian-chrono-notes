import { describe, expect, it } from "vitest";

import { projectMarkdownBody } from "../../src/core/document/markdown-body-projection";
import { parseNote } from "../../src/core/note/parsed-note";

describe("Markdown body projection", () => {
  it("preserves raw text and source lines while masking HTML comments", () => {
    const projection = projectMarkdownBody([
      "Visible",
      "<!-- hidden",
      "still hidden --> shown",
    ].join("\n"), 7);

    expect(projection.lines.map((line) => line.sourceLine)).toEqual([7, 8, 9]);
    expect(projection.lines.map((line) => line.rawText)).toEqual([
      "Visible",
      "<!-- hidden",
      "still hidden --> shown",
    ]);
    expect(projection.lines.map((line) => line.visibleText.trim())).toEqual([
      "Visible",
      "",
      "shown",
    ]);
  });

  it.each([
    ["three backticks", "```markdown", "```"],
    ["tilde fence", "~~~markdown", "~~~"],
    ["three leading spaces", "   ```markdown", "   ```"],
  ])("excludes tasks inside %s and keeps the following body task", (
    _label,
    openingFence,
    closingFence,
  ) => {
    const note = parseNote("Tasks.md", [
      openingFence,
      "- [ ] Hidden 📅 2026-08-13",
      closingFence,
      "- [ ] Visible 📅 2026-08-14",
    ].join("\n"));

    expect(note.tasks).toEqual([{
      text: "Visible",
      completed: false,
      dueDate: "2026-08-14",
      scheduledDate: null,
      startDate: null,
      doneDate: null,
      path: "Tasks.md",
      line: 3,
    }]);
  });

  it("requires a four-backtick fence to close before projecting later tasks", () => {
    const note = parseNote("Tasks.md", [
      "````markdown",
      "- [ ] First hidden",
      "```",
      "- [ ] Still hidden",
      "````",
      "- [x] Visible ✅ 2026-08-14",
    ].join("\n"));

    expect(note.tasks).toEqual([{
      text: "Visible",
      completed: true,
      dueDate: null,
      scheduledDate: null,
      startDate: null,
      doneDate: "2026-08-14",
      path: "Tasks.md",
      line: 5,
    }]);
  });

  it("gives a fenced block priority over an unmatched inline opener", () => {
    const note = parseNote("Tasks.md", [
      "- [ ] before `",
      "```md",
      "- [ ] hidden",
      "`",
      "```",
      "- [ ] after",
    ].join("\n"));

    expect(note.tasks.map((task) => task.text)).toEqual(["before `", "after"]);
  });

  it("excludes commented tasks and comment-contained date markers", () => {
    const note = parseNote("Tasks.md", [
      "<!--",
      "- [ ] Hidden 📅 2026-08-13",
      "-->",
      "- [ ] Visible <!-- 📅 2026-08-14 --> 📅 2026-08-15",
    ].join("\n"));

    expect(note.tasks).toEqual([{
      text: "Visible",
      completed: false,
      dueDate: "2026-08-15",
      scheduledDate: null,
      startDate: null,
      doneDate: null,
      path: "Tasks.md",
      line: 3,
    }]);
  });

  it.each([1, 2, 3])(
    "does not open an HTML comment inside a same-line %i-backtick code span",
    (delimiterLength) => {
      const delimiter = "`".repeat(delimiterLength);
      const note = parseNote("Tasks.md", [
        `- [ ] document ${delimiter}<!--${delimiter} syntax`,
        "- [ ] Following task",
      ].join("\n"));

      expect(note.tasks.map((task) => task.text)).toEqual([
        `document ${delimiter}<!--${delimiter} syntax`,
        "Following task",
      ]);
    },
  );

  it.each([1, 2])(
    "keeps a cross-line %i-backtick code span visible without opening an HTML comment",
    (delimiterLength) => {
      const delimiter = "`".repeat(delimiterLength);
      const rawLines = [
        `- [ ] document ${delimiter}<!--`,
        `continued -->${delimiter} text`,
        "- [ ] next",
      ];
      const body = rawLines.join("\n");
      const projection = projectMarkdownBody(body, 0);
      const note = parseNote("Tasks.md", body);

      expect(projection.lines.map((line) => line.visibleText)).toEqual(rawLines);
      expect(note.tasks.map((task) => task.text)).toEqual([
        `document ${delimiter}<!--`,
        "next",
      ]);
    },
  );

  it("does not let an unmatched backtick suppress a real HTML comment", () => {
    const note = parseNote("Tasks.md", [
      "- [ ] Before `<!-- hidden",
      "- [ ] Hidden task",
      "-->",
      "- [ ] Following task",
    ].join("\n"));

    expect(note.tasks.map((task) => task.text)).toEqual([
      "Before `",
      "Following task",
    ]);
  });

  it("does not treat an escaped backtick as a code-span opener", () => {
    const note = parseNote(
      "Tasks.md",
      "- [ ] Before \\`<!-- hidden --> after",
    );

    expect(note.tasks.map((task) => task.text)).toEqual(["Before \\` after"]);
  });
});
