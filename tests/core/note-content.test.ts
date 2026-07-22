import { describe, expect, it } from "vitest";

import { summarizeNotePreview } from "../../src/core/note/note-preview";
import { calculateNoteStatistics } from "../../src/core/note/note-statistics";
import { parseNoteTasks } from "../../src/core/note/note-tasks";

describe("note content derivation", () => {
  it("creates a four-line preview without fenced code or Markdown decoration", () => {
    const preview = summarizeNotePreview([
      "# Heading",
      "- [ ] Ship feature",
      "[[Project|Roadmap]]",
      "```ts",
      "const hidden = true;",
      "```",
      "> Quoted line",
      "Ignored fifth line",
    ].join("\n"));

    expect(preview).toBe("Heading\nShip feature\nRoadmap\nQuoted line");
  });

  it("uses lightweight labels for embedded media", () => {
    expect(summarizeNotePreview([
      "![[images/cover.png|300]]",
      "![[paper.pdf]]",
      "![diagram](assets/flow.svg)",
    ].join("\n"))).toBe("Image: cover.png\nPDF: paper.pdf\nImage: diagram");
  });

  it("parses legacy task date markers with normalized source line positions", () => {
    const tasks = parseNoteTasks([
      "  - [ ] Ship round 7 📅 2026-05-06 ⏳ 2026-05-05 🛫 2026-05-04",
      "* [X] Done item ✅ 2026-05-03",
      "Plain paragraph",
    ].join("\n"), "Tasks.md", 4);

    expect(tasks).toEqual([
      {
        text: "Ship round 7",
        completed: false,
        dueDate: "2026-05-06",
        scheduledDate: "2026-05-05",
        startDate: "2026-05-04",
        doneDate: null,
        path: "Tasks.md",
        line: 4,
      },
      {
        text: "Done item",
        completed: true,
        dueDate: null,
        scheduledDate: null,
        startDate: null,
        doneDate: "2026-05-03",
        path: "Tasks.md",
        line: 5,
      },
    ]);
  });

  it("shares legacy word, link, tag and task completion counting rules", () => {
    const body = [
      "你好 world it's state-of-the-art 1,024",
      "[[daily-note]] ![[cover.png]] [docs](https://example.com) ![img](file.png)",
      "#start (#nested) foo#ignore /#ignore #project/plan",
      "- [x] done",
      "- [ ] open",
    ].join("\n");
    const tasks = parseNoteTasks(body, "Daily.md", 0);

    expect(calculateNoteStatistics(body, tasks)).toMatchObject({
      linkCount: 4,
      tagCount: 3,
      taskTotal: 2,
      taskCompleted: 1,
      taskCompletionRate: 50,
    });
    expect(calculateNoteStatistics("你好 world it's state-of-the-art 1,024", [])).toMatchObject({
      wordCount: 6,
    });
  });
});
