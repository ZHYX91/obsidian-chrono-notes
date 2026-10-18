import { describe, expect, it } from "vitest";

import { projectMarkdownBody } from "../../src/core/document/markdown-body-projection";
import { parseNote } from "../../src/core/note/parsed-note";
import { rescheduleTaskDueDateInContent } from "../../src/core/note/task-line-rewrite";

describe("Obsidian comments in shared Markdown semantics", () => {
  it.each(["\n", "\r\n", "\r"])("masks comments and preserves writable offsets with %j", (ending) => {
    const content = [
      "\uFEFF---", "title: keep", "...",
      "%% hidden 😀", "> + [ ] Secret 📅 2000-01-01",
      "[[Secret]] ![[secret.png]] #hidden", "%%",
      "> [!note]",
      "> + [ ] Keep 😀 %% 📅 2001-01-01 %% 📅 2026-10-17 #visible",
    ].join(ending);
    const note = parseNote("Tasks.md", content);
    expect(note.tasks).toMatchObject([{
      text: "Keep 😀 #visible", dueDate: "2026-10-17", line: 8,
    }]);
    expect(note.statistics).toMatchObject({ taskTotal: 1, linkCount: 0, tagCount: 1 });
    expect(note.embeds.imageCount).toBe(0);
    expect(note.preview).not.toMatch(/Secret|hidden|2001/);
    const projection = projectMarkdownBody(note.document.body, note.document.bodyStartLine);
    for (const line of projection.lines) {
      expect(line.visibleText.length).toBe(line.rawText.length);
      expect(line.semanticText.length).toBe(line.rawText.length);
      expect(line.tagText.length).toBe(line.rawText.length);
    }
    expect(rescheduleTaskDueDateInContent(
      content, note.tasks[0]!, { year: 2026, month: 10, day: 18 },
    )).toEqual({
      status: "updated", content: content.replace("2026-10-17", "2026-10-18"),
    });
  });

  it.each([
    "before %% hidden 😀 %% after",
    "before %% hidden\nmore hidden %% after",
  ])("retains only visible words around %s", (content) => {
    const note = parseNote("Notes.md", content);
    expect(note.statistics.wordCount).toBe(2);
    expect(note.preview?.replace(/\s+/gu, " ")).toBe("before after");
  });

  it("masks an unclosed comment through EOF", () => {
    const note = parseNote("Notes.md", "Visible\n%% hidden\n+ [ ] Secret #tag [[Target]]");
    expect(note.preview).toBe("Visible");
    expect(note.statistics).toMatchObject({ wordCount: 1, taskTotal: 0, tagCount: 0, linkCount: 0 });
  });

  it.each([
    "%%\n```\n%%\n+ [ ] after 📅 2026-10-17",
    "> %%\n> ```\n> %%\n> + [ ] after 📅 2026-10-17",
    "%% <!-- hidden %%\n+ [ ] after 📅 2026-10-17",
    "<!-- %% hidden -->\n+ [ ] after 📅 2026-10-17",
  ])("does not let syntax inside a comment hide its visible suffix in %s", (content) => {
    expect(parseNote("Notes.md", content).tasks).toMatchObject([{
      text: "after", dueDate: "2026-10-17",
    }]);
  });

  it.each([
    "- [ ] document `%%` syntax\n+ [ ] after",
    "```\n%%\n```\n+ [ ] after",
    "    %%\n\n+ [ ] after",
    "\\%% literal delimiter\n+ [ ] after",
  ])("does not open comments inside code or escaped syntax in %s", (content) => {
    expect(parseNote("Notes.md", content).tasks.at(-1)?.text).toBe("after");
  });
});

describe("Markdown link and tag statistics", () => {
  it.each([
    ["#123 #١٢٣ #०१२", 0],
    [String.raw`\#hidden \\#visible \\\#hidden`, 1],
    ["#y1984 #tag_1 #tag-one #tag/path2 #中文 #مرحبا #cafe\u0301", 7],
    ["[Section](#fragment \"#title\") ![image](image.png#fragment)", 0],
    ["[[#Heading]] [[Note|#Alias]] ![[image.png#fragment]]", 0],
    ["[Text][#ref]\n\n[#ref]: #destination \"#title\"", 0],
    ["[Text][#undefined]", 1],
    ["#visible %% #hidden %% `#code` <!-- #hidden -->", 1],
  ])("counts only body tags in %s", (content, tagCount) => {
    expect(parseNote("Tags.md", content).statistics.tagCount).toBe(tagCount);
  });

  it("counts full, collapsed, shortcut and image references without counting definitions", () => {
    const content = [
      "[One][ref] [Ref][] [REF] ![picture][ref]",
      "[regular](https://example.com/a_(b)#section \"title\")",
      "[undefined] [Another][unknown]",
      "", "[ref]: /target", "[unused]: /unused",
    ].join("\n");
    expect(parseNote("Links.md", content).statistics.linkCount).toBe(5);
  });

  it("matches reference labels across case and whitespace and counts multiline links once", () => {
    const content = "[label][ONE\t TWO]\n[other\nlabel][one two]\n\n[one two]: /target";
    expect(parseNote("Links.md", content).statistics.linkCount).toBe(2);
  });

  it.each([
    "%%\n[hidden]: /target\n%%\n[hidden]",
    "<!--\n[hidden]: /target\n-->\n[hidden]",
    "```\n[hidden]: /target\n```\n[hidden]",
    "`[hidden]: /target`\n\n[hidden]",
    "\\[escaped](https://example.com)",
    "[unused]: /target",
  ])("does not count undefined or hidden links in %s", (content) => {
    expect(parseNote("Links.md", content).statistics.linkCount).toBe(0);
  });

  it("does not count Wiki links or task checkboxes again as shortcut references", () => {
    const content = "[Note]: /target\n[x]: /target\n\n[[Note]] [Note]\n- [x] Work\n[x]";
    const note = parseNote("Links.md", content);
    expect(note.statistics).toMatchObject({ linkCount: 3, taskTotal: 1, taskCompleted: 1 });
  });
});
