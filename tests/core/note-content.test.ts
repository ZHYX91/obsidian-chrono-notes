import { describe, expect, it } from "vitest";

import { projectMarkdownBody } from "../../src/core/document/markdown-body-projection";
import {
  deriveNotePreview,
  EMPTY_NOTE_EMBED_STATISTICS,
  summarizeNotePreview,
} from "../../src/core/note/note-preview";
import { calculateNoteStatistics } from "../../src/core/note/note-statistics";
import { parseNoteTasks } from "../../src/core/note/note-tasks";

function parseTasks(body: string, path: string, bodyStartLine: number) {
  return parseNoteTasks(projectMarkdownBody(body, bodyStartLine), path);
}

function derivePreview(body: string) {
  return deriveNotePreview(projectMarkdownBody(body, 0));
}

function calculateStatistics(body: string, tasks: ReturnType<typeof parseTasks>) {
  return calculateNoteStatistics(projectMarkdownBody(body, 0), tasks);
}

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
    expect(derivePreview([
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
    const derived = derivePreview("Plain text");

    expect(derived.embeds).toBe(EMPTY_NOTE_EMBED_STATISTICS);
    expect(Object.isFrozen(derived.embeds)).toBe(true);
  });

  it("keeps balanced Markdown destinations out of the excerpt", () => {
    expect(derivePreview([
      "Before ![local](assets/image_(1).png) after",
      "![remote](https://example.com/image_(2).svg \"Preview (large)\")",
      String.raw`![escaped](assets/image_\(3\).webp)`,
    ].join("\n"))).toEqual({
      text: "Before after",
      embeds: {
        imageCount: 3,
        pdfCount: 0,
        audioCount: 0,
        videoCount: 0,
        noteCount: 0,
        otherCount: 0,
      },
    });
  });

  it("parses legacy task date markers with normalized source line positions", () => {
    const tasks = parseTasks([
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

  it("does not project impossible task marker dates into the task model", () => {
    const [task] = parseTasks(
      "- [ ] Invalid dates 馃搮 2026-02-30 鈴?2026-13-01 馃洬 2026-00-10",
      "Tasks.md",
      0,
    );

    expect(task).toMatchObject({
      dueDate: null,
      scheduledDate: null,
      startDate: null,
    });
  });

  it("shares legacy word, link, tag and task completion counting rules", () => {
    const body = [
      "你好 world it's state-of-the-art 1,024",
      "[[daily-note]] ![[cover.png]] [docs](https://example.com) ![img](file.png)",
      "#start (#nested) foo#ignore /#ignore #project/plan",
      "- [x] done",
      "- [ ] open",
    ].join("\n");
    const tasks = parseTasks(body, "Daily.md", 0);

    expect(calculateStatistics(body, tasks)).toMatchObject({
      linkCount: 4,
      tagCount: 3,
      taskTotal: 2,
      taskCompleted: 1,
      taskCompletionRate: 50,
    });
    expect(calculateStatistics("你好 world it's state-of-the-art 1,024", [])).toMatchObject({
      wordCount: 6,
    });
    expect(calculateStatistics("- --- ' --", [])).toMatchObject({ wordCount: 0 });
  });

  it("isolates fenced code, HTML comments, and inline code for all note consumers", () => {
    const body = [
      "Visible [[real]] #real ![[cover.png]]",
      "`[[inline]] #inline ![[inline.png]] 📅 2026-09-01`",
      "<!-- [[comment]] #comment ![[comment.png]] -->",
      "````md",
      "- [ ] hidden [[fence]] #fence ![[fence.png]]",
      "````",
      "- [ ] shown `📅 2026-09-02` 📅 2026-09-03",
    ].join("\n");
    const projection = projectMarkdownBody(body, 0);
    const tasks = parseNoteTasks(projection, "Daily.md");
    const preview = deriveNotePreview(projection);
    const statistics = calculateNoteStatistics(projection, tasks);

    expect(tasks).toEqual([expect.objectContaining({
      text: "shown `📅 2026-09-02`",
      dueDate: "2026-09-03",
      line: 6,
    })]);
    expect(preview).toEqual({
      text: "Visible real #real\nshown 📅 2026-09-03",
      embeds: {
        imageCount: 1,
        pdfCount: 0,
        audioCount: 0,
        videoCount: 0,
        noteCount: 0,
        otherCount: 0,
      },
    });
    expect(statistics).toMatchObject({ linkCount: 2, tagCount: 1, taskTotal: 1 });
  });
});
