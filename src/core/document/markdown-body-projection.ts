import { parser } from "@lezer/markdown";

export interface MarkdownTaskMarker {
  /** UTF-16 offsets within the source line, excluding a file BOM. */
  readonly checkboxOffset: number;
  readonly contentOffset: number;
}

export interface MarkdownBodyLineProjection {
  readonly sourceLine: number;
  readonly rawText: string;
  readonly visibleText: string;
  /** Visible body text with inline code spans masked for syntax consumers. */
  readonly semanticText: string;
  /** Semantic text with escaped syntax and link metadata masked for tags. */
  readonly tagText: string;
  readonly taskMarker: MarkdownTaskMarker | null;
}

export interface MarkdownBodyProjection {
  readonly lines: readonly MarkdownBodyLineProjection[];
  readonly linkCount: number;
}

interface MaskRange {
  readonly from: number;
  readonly to: number;
}

interface ContainerMark extends MaskRange {
  readonly containerFrom: number;
}

interface MarkdownLink extends MaskRange {
  readonly reference: string | null;
  readonly label: MaskRange | null;
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
  const { comments, containerMarks, originalBlocks } = collectSyntaxContext(body);
  const uncommented = maskRanges(body, comments);
  const rawLines = body.split("\n");
  const syntax = createSyntaxInput(body, uncommented, rawLines, comments, containerMarks);
  const blocks: MaskRange[] = [];
  const inline: MaskRange[] = [];
  const markers: MaskRange[] = [];
  const tagMasks: MaskRange[] = [];
  const references: { label: string; from: number }[] = [];
  const links: MarkdownLink[] = [];
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
      if (node.name === "ListMark") markers.push({ from: node.from, to: node.to });
      if (node.name === "URL" || node.name === "LinkTitle" || node.name === "Escape") {
        tagMasks.push({ from: node.from, to: node.to });
      }
      if (node.name === "LinkReference") {
        const label = node.node.getChild("LinkLabel");
        if (label !== null) {
          references.push({
            label: normalizeReference(syntax.slice(label.from + 1, label.to - 1)),
            from: node.from,
          });
        }
        tagMasks.push({ from: node.from, to: node.to });
      }
      if (node.name === "Link" || node.name === "Image") {
        const marks = node.node.getChildren("LinkMark");
        const opening = marks[0];
        const closing = marks[1];
        if (opening === undefined || closing === undefined) return;
        const label = node.node.getChild("LinkLabel");
        const explicitLabel = label === null ? "" : syntax.slice(label.from + 1, label.to - 1);
        const isInline = marks.some((mark) => syntax.slice(mark.from, mark.to) === "(");
        links.push({
          from: node.from, to: node.to,
          reference: isInline ? null : normalizeReference(
            explicitLabel || syntax.slice(opening.to, closing.from),
          ),
          label: label === null ? null : { from: label.from, to: label.to },
        });
      }
    },
  });
  // Comment suffixes can become paragraphs in the syntax input. Genuine code
  // blocks from the original tree must not become paragraph continuations.
  const codeBlocks = [...originalBlocks, ...blocks].sort((left, right) => left.from - right.from);
  const visible = maskRanges(uncommented, codeBlocks);
  const visibleLines = visible.split("\n");
  const semantic = maskRanges(visible, inline);
  const semanticLines = semantic.split("\n");
  const referenceLabels = new Set(references
    .filter((reference) => semantic[reference.from] === "[")
    .map((reference) => reference.label));
  const wikiLinks = Array.from(semantic.matchAll(/!?\[\[[^[\]\n]+\]\]/gu))
    .filter((match) => !isEscaped(semantic, match.index))
    .map((match) => ({ from: match.index, to: match.index + match[0].length }));
  const resolvedLinks = links.filter((link) =>
    (semantic[link.from] === "[" || semantic[link.from] === "!") &&
    !containsOffset(wikiLinks, link.from) &&
    (link.reference === null || referenceLabels.has(link.reference)));
  const linkLabels = resolvedLinks.flatMap((link) => link.label === null ? [] : [link.label]);
  const tagLines = maskRanges(semantic, [...tagMasks, ...wikiLinks, ...linkLabels]
    .sort((left, right) => left.from - right.from)).split("\n");
  let offset = 0;
  let markerCursor = 0;
  const taskCheckboxes = new Set<number>();
  const lines = rawLines.map((rawText, index) => {
    const visibleText = visibleLines[index] ?? "";
    const semanticText = semanticLines[index] ?? "";
    let taskMarker: MarkdownTaskMarker | null = null;
    while (markerCursor < markers.length && markers[markerCursor]!.from < offset + rawText.length) {
      const marker = markers[markerCursor++]!;
      const from = marker.from - offset;
      const to = marker.to - offset;
      if (from < 0 || semanticText.slice(from, to).trim().length === 0) continue;
      const prefix = /^([\t ]+)\[([ xX])\][\t ]+/u.exec(visibleText.slice(to));
      if (prefix === null) continue;
      const contentOffset = to + prefix[0].length;
      if (semanticText.slice(from, contentOffset) !== visibleText.slice(from, contentOffset)) continue;
      if (visibleText.slice(contentOffset).length === 0) continue;
      taskMarker = Object.freeze({
        checkboxOffset: to + prefix[1]!.length + 1,
        contentOffset,
      });
      taskCheckboxes.add(offset + taskMarker.checkboxOffset - 1);
    }
    offset += rawText.length + 1;
    return Object.freeze({
      sourceLine: bodyStartLine + index,
      rawText, visibleText, semanticText, tagText: tagLines[index] ?? "", taskMarker,
    });
  });
  return Object.freeze({
    lines: Object.freeze(lines),
    linkCount: wikiLinks.length + resolvedLinks.filter((link) => !taskCheckboxes.has(link.from)).length,
  });
}

function collectSyntaxContext(body: string): Readonly<{
  comments: readonly MaskRange[];
  containerMarks: readonly ContainerMark[];
  originalBlocks: readonly MaskRange[];
}> {
  const codes: MaskRange[] = [];
  const originalBlocks: MaskRange[] = [];
  const marks: ContainerMark[] = [];
  parser.parse(body).iterate({
    enter(node) {
      if (node.name === "FencedCode" || node.name === "CodeBlock" || node.name === "InlineCode") {
        const code = { from: node.from, to: node.to };
        codes.push(code);
        if (node.name !== "InlineCode") originalBlocks.push(code);
        return false;
      }
      if (node.name === "ListMark" || node.name === "QuoteMark") {
        const containerName = node.name === "ListMark" ? "ListItem" : "Blockquote";
        let container = node.node.parent;
        while (container !== null && container.name !== containerName) container = container.parent;
        marks.push({
          from: node.from, to: node.to, containerFrom: container?.from ?? node.from,
        });
      }
    },
  });
  const comments: MaskRange[] = [];
  const discardedCodes = new Set<MaskRange>();
  let cursor = 0;
  let codeCursor = 0;
  let discardCursor = 0;
  while (cursor < body.length) {
    const html = body.indexOf("<!--", cursor);
    const obsidian = body.indexOf("%%", cursor);
    if (html === -1 && obsidian === -1) break;
    const isHtml = html !== -1 && (obsidian === -1 || html < obsidian);
    const from = isHtml ? html : obsidian;
    if (isEscaped(body, from)) {
      cursor = from + (isHtml ? 4 : 2);
      continue;
    }
    while (codeCursor < codes.length && (codes[codeCursor]?.to ?? 0) <= from) codeCursor += 1;
    const code = codes[codeCursor];
    if (code !== undefined && code.from <= from && !discardedCodes.has(code)) {
      cursor = code.to;
      continue;
    }
    // An actual comment owns everything through its raw closing delimiter.
    // A fence inside an unclosed inline comment must not hide that delimiter
    // or keep hiding later body text after the comment has ended.
    const delimiter = isHtml ? "-->" : "%%";
    const closing = body.indexOf(delimiter, from + (isHtml ? 4 : 2));
    const to = closing === -1 ? body.length : closing + delimiter.length;
    comments.push({ from, to });
    while (discardCursor < codes.length && (codes[discardCursor]?.from ?? body.length) < to) {
      const candidate = codes[discardCursor];
      if (candidate !== undefined && candidate.from >= from) discardedCodes.add(candidate);
      discardCursor += 1;
    }
    cursor = to;
  }
  // Continuation quote marks can lie within the raw comment range. Retain
  // their real outer container, but never revive containers begun in a comment.
  const containerMarks = marks.filter((mark) => !containsOffset(comments, mark.containerFrom));
  return {
    comments, containerMarks,
    originalBlocks: originalBlocks.filter((block) => !discardedCodes.has(block)),
  };
}

function normalizeReference(label: string): string {
  return label.trim().replace(/\s+/gu, " ").toUpperCase().toLowerCase();
}

function isEscaped(text: string, offset: number): boolean {
  let backslashes = 0;
  for (let index = offset - 1; text[index] === "\\"; index -= 1) backslashes += 1;
  return backslashes % 2 === 1;
}

function createSyntaxInput(
  body: string,
  uncommented: string,
  rawLines: readonly string[],
  comments: readonly MaskRange[],
  containerMarks: readonly ContainerMark[],
): string {
  if (comments.length === 0) return body;
  const characters = uncommented.split("");
  for (const mark of containerMarks) {
    for (let index = mark.from; index < mark.to; index += 1) characters[index] = body[index]!;
  }
  const contentLines = maskRanges(uncommented, containerMarks).split("\n");
  let offset = 0;
  for (const [index, line] of rawLines.entries()) {
    // A hidden comment is not code indentation inside a list or quote. A
    // placeholder only precedes real visible content; blank containers stay blank.
    if ((contentLines[index] ?? "").trim().length > 0) {
      for (let column = 0; column < line.length; column += 1) {
        const character = line[column]!;
        if (characters[offset + column] !== character && /\S/u.test(character)) {
          characters[offset + column] = "a";
          break;
        }
      }
    }
    offset += line.length + 1;
  }
  return characters.join("");
}

function containsOffset(ranges: readonly MaskRange[], offset: number): boolean {
  let low = 0;
  let high = ranges.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const range = ranges[middle]!;
    if (offset < range.from) high = middle - 1;
    else if (offset >= range.to) low = middle + 1;
    else return true;
  }
  return false;
}

function maskRanges(body: string, ranges: readonly MaskRange[]): string {
  if (ranges.length === 0) return body;
  const parts: string[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.to <= cursor) continue;
    const from = Math.max(cursor, range.from);
    parts.push(body.slice(cursor, from));
    // Replace each UTF-16 code unit, including both halves of an emoji.
    parts.push(body.slice(from, range.to).replace(/[^\n]/g, " "));
    cursor = range.to;
  }
  parts.push(body.slice(cursor));
  return parts.join("");
}
