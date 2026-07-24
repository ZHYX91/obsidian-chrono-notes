import { describe, expect, it } from "vitest";

import {
  deriveNotePreview,
  EMPTY_NOTE_EMBED_STATISTICS,
  summarizeNotePreview,
} from "../../src/core/note/note-preview";
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

  it("removes embeds from the excerpt and classifies them in one derivation", () => {
    expect(deriveNotePreview([
      "Before ![[images/cover.png|300]] after",
      "![[paper.pdf]]",
      "![diagram](assets/flow.svg)",
      "![[Meeting notes#Decision]]",
      "![[recording.mp3]] ![[clip.mp4]] ![[archive.zip]]",
      "![titled](assets/extra.png \"preview\") ![angled](<media/voice.ogg>)",
      "![queried](assets/diagram.svg?raw=1#view)",
      "[[Project|Roadmap]] and [docs](https://example.com)",
    ].join("\n"))).toEqual({
      text: "Before after\nRoadmap and docs",
      embeds: {
        imageCount: 4,
        pdfCount: 1,
        audioCount: 2,
        videoCount: 1,
        noteCount: 1,
        otherCount: 1,
      },
    });
  });

  it("reuses the frozen empty embed statistics for notes without embeds", () => {
    const derived = deriveNotePreview("Plain text");

    expect(derived.embeds).toBe(EMPTY_NOTE_EMBED_STATISTICS);
    expect(Object.isFrozen(derived.embeds)).toBe(true);
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
