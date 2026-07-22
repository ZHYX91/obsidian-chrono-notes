export type NoteContentState = "empty" | "yaml-only" | "has-body";
export type FrontmatterStatus = "none" | "valid" | "unterminated";
export type LineEnding = "lf" | "crlf" | "cr" | "none" | "mixed";

export interface ParsedNoteDocument {
  readonly state: NoteContentState;
  readonly frontmatterStatus: FrontmatterStatus;
  readonly frontmatterText: string | null;
  readonly body: string;
  readonly bodyStartLine: number;
  readonly hadBom: boolean;
  readonly lineEnding: LineEnding;
}

const OPENING_DELIMITER = /^---[\t ]*$/;
const CLOSING_DELIMITER = /^(?:---|\.\.\.)[\t ]*$/;

/**
 * Parse the structural boundary of an Obsidian Markdown note.
 *
 * The parser deliberately normalizes BOM and line endings before classifying
 * content, so equivalent files have the same state on every platform.
 */
export function parseNoteDocument(content: string): ParsedNoteDocument {
  const lineEnding = detectLineEnding(content);
  const hadBom = content.startsWith("\uFEFF");
  const withoutBom = hadBom ? content.slice(1) : content;
  const normalized = withoutBom.replace(/\r\n?/g, "\n");

  if (normalized.trim().length === 0) {
    return Object.freeze({
      state: "empty",
      frontmatterStatus: "none",
      frontmatterText: null,
      body: "",
      bodyStartLine: 0,
      hadBom,
      lineEnding,
    });
  }

  const lines = normalized.split("\n");
  if (!OPENING_DELIMITER.test(lines[0] ?? "")) {
    return Object.freeze({
      state: "has-body",
      frontmatterStatus: "none",
      frontmatterText: null,
      body: normalized,
      bodyStartLine: 0,
      hadBom,
      lineEnding,
    });
  }

  const closingIndex = lines.findIndex(
    (line, index) => index > 0 && CLOSING_DELIMITER.test(line),
  );
  if (closingIndex === -1) {
    return Object.freeze({
      state: "has-body",
      frontmatterStatus: "unterminated",
      frontmatterText: null,
      body: normalized,
      bodyStartLine: 0,
      hadBom,
      lineEnding,
    });
  }

  const frontmatterText = lines.slice(1, closingIndex).join("\n");
  const body = lines.slice(closingIndex + 1).join("\n");
  return Object.freeze({
    state: body.trim().length === 0 ? "yaml-only" : "has-body",
    frontmatterStatus: "valid",
    frontmatterText,
    body,
    bodyStartLine: closingIndex + 1,
    hadBom,
    lineEnding,
  });
}

function detectLineEnding(content: string): LineEnding {
  const hasCrlf = content.includes("\r\n");
  const withoutCrlf = content.replace(/\r\n/g, "");
  const hasLf = withoutCrlf.includes("\n");
  const hasCr = withoutCrlf.includes("\r");
  const kinds = Number(hasCrlf) + Number(hasLf) + Number(hasCr);

  if (kinds === 0) return "none";
  if (kinds > 1) return "mixed";
  if (hasCrlf) return "crlf";
  if (hasLf) return "lf";
  return "cr";
}
