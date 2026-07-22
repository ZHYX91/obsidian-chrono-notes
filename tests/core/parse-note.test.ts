import { describe, expect, it } from "vitest";

import { parseNote } from "../../src/core/note/parsed-note";

describe("parseNote", () => {
  it("aggregates a path and the normalized document parse into one immutable value", () => {
    const note = parseNote(
      "Journal/2026-07-14.md",
      [
        "\uFEFF---",
        "tags: [daily, project]",
        "start: 2026-07-14",
        "end: 2026-07-16",
        "nested:",
        "  owner: Chrono",
        "---",
        "# Entry",
        "- [ ] Ship [[Roadmap|the roadmap]] 📅 2026-07-18 ⏳ 2026-07-16",
        "- [x] Publish notes ✅ 2026-07-14",
        "See [documentation](https://example.com) #release",
      ].join("\r\n"),
    );

    expect(note).toMatchObject({
      path: "Journal/2026-07-14.md",
      state: "has-body",
      frontmatter: {
        tags: ["daily", "project"],
        start: "2026-07-14",
        end: "2026-07-16",
        nested: { owner: "Chrono" },
      },
      frontmatterError: null,
      interval: {
        start: { dateKey: "2026-07-14", hasTime: false },
        end: { dateKey: "2026-07-16", hasTime: false },
        dayCount: 3,
      },
      intervalError: null,
      preview: [
        "Entry",
        "Ship the roadmap 📅 2026-07-18 ⏳ 2026-07-16",
        "Publish notes ✅ 2026-07-14",
        "See documentation #release",
      ].join("\n"),
      tasks: [
        {
          text: "Ship [[Roadmap|the roadmap]]",
          completed: false,
          dueDate: "2026-07-18",
          scheduledDate: "2026-07-16",
          startDate: null,
          doneDate: null,
          path: "Journal/2026-07-14.md",
          line: 8,
        },
        {
          text: "Publish notes",
          completed: true,
          dueDate: null,
          scheduledDate: null,
          startDate: null,
          doneDate: "2026-07-14",
          path: "Journal/2026-07-14.md",
          line: 9,
        },
      ],
      statistics: {
        linkCount: 2,
        tagCount: 1,
        taskTotal: 2,
        taskCompleted: 1,
        taskCompletionRate: 50,
      },
      document: {
        frontmatterStatus: "valid",
        frontmatterText: [
          "tags: [daily, project]",
          "start: 2026-07-14",
          "end: 2026-07-16",
          "nested:",
          "  owner: Chrono",
        ].join("\n"),
        body: [
          "# Entry",
          "- [ ] Ship [[Roadmap|the roadmap]] 📅 2026-07-18 ⏳ 2026-07-16",
          "- [x] Publish notes ✅ 2026-07-14",
          "See [documentation](https://example.com) #release",
        ].join("\n"),
        bodyStartLine: 7,
        hadBom: true,
        lineEnding: "crlf",
      },
    });
    expect(Object.isFrozen(note)).toBe(true);
    expect(Object.isFrozen(note.document)).toBe(true);
    expect(Object.isFrozen(note.frontmatter)).toBe(true);
    expect(Object.isFrozen(note.frontmatter?.tags)).toBe(true);
    expect(Object.isFrozen(note.frontmatter?.nested)).toBe(true);
    expect(Object.isFrozen(note.interval)).toBe(true);
    expect(Object.isFrozen(note.interval?.start)).toBe(true);
    expect(Object.isFrozen(note.tasks)).toBe(true);
    expect(Object.isFrozen(note.tasks[0])).toBe(true);
    expect(Object.isFrozen(note.statistics)).toBe(true);
  });

  it("keeps readable note data when YAML is invalid and exposes a frozen parse failure", () => {
    const note = parseNote(
      "Daily/invalid.md",
      "---\ntags: [daily\n---\nStill readable\n- [ ] Still parsed",
    );

    expect(note).toMatchObject({
      state: "has-body",
      frontmatter: null,
      frontmatterError: {
        name: "YAMLParseError",
      },
      preview: "Still readable\nStill parsed",
      statistics: {
        taskTotal: 1,
        taskCompleted: 0,
        taskCompletionRate: 0,
      },
    });
    expect(note.frontmatterError?.message.length).toBeGreaterThan(0);
    expect(Object.isFrozen(note.frontmatterError)).toBe(true);
  });

  it("keeps valid frontmatter while exposing an invalid interval range", () => {
    const note = parseNote(
      "Ranges/reversed.md",
      "---\nstart: 2026-07-20\nend: 2026-07-10\n---\nReadable body",
    );

    expect(note.frontmatter).toEqual({ start: "2026-07-20", end: "2026-07-10" });
    expect(note.frontmatterError).toBeNull();
    expect(note.interval).toBeNull();
    expect(note.intervalError).toMatchObject({
      name: "NoteIntervalError",
      reason: "reversed-range",
    });
    expect(Object.isFrozen(note.intervalError)).toBe(true);
    expect(note.preview).toBe("Readable body");
  });

  it("derives a timed interval from quoted YAML strings", () => {
    const note = parseNote(
      "Ranges/timed.md",
      [
        "---",
        "start: \"2026-07-14T09:00:00+08:00\"",
        "end: '2026-07-14T17:30:00+08:00'",
        "---",
      ].join("\n"),
    );

    expect(note.interval).toMatchObject({
      start: { value: "2026-07-14T09:00:00+08:00", hasTime: true },
      end: { value: "2026-07-14T17:30:00+08:00", hasTime: true },
      dayCount: 1,
    });
    expect(note.intervalError).toBeNull();
  });

  it("rejects non-mapping YAML roots without discarding the document body", () => {
    const note = parseNote("Daily/list.md", "---\n- daily\n- project\n---\nBody");

    expect(note.frontmatter).toBeNull();
    expect(note.frontmatterError).toEqual({
      name: "FrontmatterTypeError",
      message: "Frontmatter root must be a mapping",
    });
    expect(note.preview).toBe("Body");
  });

  it("reports YAML alias expansion limits without turning a readable note into an index error", () => {
    const note = parseNote(
      "Daily/aliases.md",
      [
        "---",
        "a: &a [one, two, three, four, five, six, seven, eight, nine, ten]",
        "b: &b [*a, *a, *a, *a, *a, *a, *a, *a, *a, *a]",
        "c: [*b, *b, *b, *b, *b, *b, *b, *b, *b, *b]",
        "---",
        "Readable body",
      ].join("\n"),
    );

    expect(note.frontmatter).toBeNull();
    expect(note.frontmatterError?.message).toContain("Excessive alias count");
    expect(note.preview).toBe("Readable body");
  });
});
