import { describe, expect, it } from "vitest";

import { parseNoteDocument } from "../../src/core/document/parse-note-document";

describe("parseNoteDocument", () => {
  it("classifies whitespace-only files as empty", () => {
    expect(parseNoteDocument(" \n\t")).toMatchObject({
      state: "empty",
      frontmatterStatus: "none",
    });
  });

  it("classifies LF frontmatter ending at EOF as yaml-only", () => {
    expect(parseNoteDocument("---\ntag: journal\n---")).toMatchObject({
      state: "yaml-only",
      frontmatterStatus: "valid",
      frontmatterText: "tag: journal",
      body: "",
      bodyStartLine: 3,
      lineEnding: "lf",
    });
  });

  it("normalizes CRLF frontmatter", () => {
    expect(parseNoteDocument("---\r\ntag: journal\r\n---\r\n")).toMatchObject({
      state: "yaml-only",
      frontmatterStatus: "valid",
      lineEnding: "crlf",
    });
  });

  it("accepts a UTF-8 BOM before frontmatter", () => {
    expect(parseNoteDocument("\uFEFF---\ntag: journal\n---\n")).toMatchObject({
      state: "yaml-only",
      frontmatterStatus: "valid",
      hadBom: true,
    });
  });

  it("classifies non-whitespace body content consistently", () => {
    expect(parseNoteDocument("---\ntag: journal\n---\n# Entry\n")).toMatchObject({
      state: "has-body",
      frontmatterStatus: "valid",
      body: "# Entry\n",
      bodyStartLine: 3,
    });
  });

  it("reports unterminated frontmatter conservatively as body content", () => {
    expect(parseNoteDocument("---\ntag: journal")).toMatchObject({
      state: "has-body",
      frontmatterStatus: "unterminated",
      bodyStartLine: 0,
    });
  });

  it("accepts the YAML document-end marker", () => {
    expect(parseNoteDocument("---\ntag: journal\n...\n")).toMatchObject({
      state: "yaml-only",
      frontmatterStatus: "valid",
    });
  });
});
