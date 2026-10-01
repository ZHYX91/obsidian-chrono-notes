import { parser } from "@lezer/markdown";

export interface MarkdownBodyLineProjection {
  readonly sourceLine: number;
  readonly rawText: string;
  readonly visibleText: string;
  /** Visible body text with inline code spans masked for syntax consumers. */
  readonly semanticText: string;
  readonly taskMarkerEligible: boolean;
}

export interface MarkdownBodyProjection {
  readonly lines: readonly MarkdownBodyLineProjection[];
}

interface MaskRange {
  readonly from: number;
  readonly to: number;
}

/**
 * CommonMark block/container boundaries determine code spans and list markers.
 * Hidden text is replaced with spaces, retaining UTF-16 offsets and newlines.
 * Task labels retain inline code, while writable markers and metadata do not.
 */
export function projectMarkdownBody(
  body: string,
  bodyStartLine: number,
): MarkdownBodyProjection {
  const comments = collectCommentRanges(body);
  const uncommented = maskRanges(body, comments);
  const rawLines = body.split("\n");
  // A hidden comment prefix is not indentation. Keep a non-space sentinel
  // solely in the parser input so its visible suffix cannot become code.
  const syntax = uncommented.split("\n").map((line, index) => {
    const leading = /^ */u.exec(line)?.[0].length ?? 0;
    const hiddenPrefix = rawLines[index]?.slice(0, leading).search(/\S/u) ?? -1;
    return hiddenPrefix < 0 ? line :
      `${line.slice(0, hiddenPrefix)}a${line.slice(hiddenPrefix + 1)}`;
  }).join("\n");
  const blocks: MaskRange[] = [];
  const inline: MaskRange[] = [];
  const markers = new Set<number>();
  parser.parse(syntax).iterate({
    enter(node) {
      if (node.name === "FencedCode" || node.name === "CodeBlock") {
        blocks.push({ from: node.from, to: node.to });
        return false;
      }
      if (node.name === "InlineCode") {
        inline.push({ from: node.from, to: node.to });
        return false;
      }
      if (node.name === "ListMark") markers.add(node.from);
    },
  });
  const visible = maskRanges(uncommented, blocks);
  const visibleLines = visible.split("\n");
  const semanticLines = maskRanges(visible, inline).split("\n");
  let offset = 0;
  const lines = rawLines.map((rawText, index) => {
    const visibleText = visibleLines[index] ?? "";
    const semanticText = semanticLines[index] ?? "";
    const marker = /^\s*[-*]/u.exec(visibleText);
    const taskMarkerEligible = marker !== null && markers.has(offset + marker[0].length - 1);
    offset += rawText.length + 1;
    return Object.freeze({
      sourceLine: bodyStartLine + index,
      rawText, visibleText, semanticText, taskMarkerEligible,
    });
  });
  return Object.freeze({ lines: Object.freeze(lines) });
}

function collectCommentRanges(body: string): readonly MaskRange[] {
  const codes: MaskRange[] = [];
  parser.parse(body).iterate({
    enter(node) {
      if (node.name === "FencedCode" || node.name === "CodeBlock" || node.name === "InlineCode") {
        codes.push({ from: node.from, to: node.to });
        return false;
      }
    },
  });
  const comments: MaskRange[] = [];
  const discardedCodes = new Set<MaskRange>();
  let cursor = 0;
  let codeCursor = 0;
  let discardCursor = 0;
  while (cursor < body.length) {
    const from = body.indexOf("<!--", cursor);
    if (from === -1) break;
    while (codeCursor < codes.length && (codes[codeCursor]?.to ?? 0) <= from) codeCursor += 1;
    const code = codes[codeCursor];
    if (code !== undefined && code.from <= from && !discardedCodes.has(code)) {
      cursor = code.to;
      continue;
    }
    // An actual comment owns everything through its raw closing delimiter.
    // A fence inside an unclosed inline comment must not hide that delimiter
    // or keep hiding later body text after the comment has ended.
    const closing = body.indexOf("-->", from + 4);
    const to = closing === -1 ? body.length : closing + 3;
    comments.push({ from, to });
    while (discardCursor < codes.length && (codes[discardCursor]?.from ?? body.length) < to) {
      const candidate = codes[discardCursor];
      if (candidate !== undefined && candidate.from >= from) discardedCodes.add(candidate);
      discardCursor += 1;
    }
    cursor = to;
  }
  return comments;
}

function maskRanges(body: string, ranges: readonly MaskRange[]): string {
  if (ranges.length === 0) return body;
  const parts: string[] = [];
  let cursor = 0;
  for (const range of ranges) {
    parts.push(body.slice(cursor, range.from));
    // Replace each UTF-16 code unit, including both halves of an emoji.
    parts.push(body.slice(range.from, range.to).replace(/[^\n]/g, " "));
    cursor = range.to;
  }
  parts.push(body.slice(cursor));
  return parts.join("");
}
