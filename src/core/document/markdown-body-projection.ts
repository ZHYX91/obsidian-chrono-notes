export interface MarkdownBodyLineProjection {
  readonly sourceLine: number;
  readonly rawText: string;
  readonly visibleText: string;
  /** Visible body text with inline code spans masked for syntax consumers. */
  readonly semanticText: string;
}

export interface MarkdownBodyProjection {
  readonly lines: readonly MarkdownBodyLineProjection[];
}

interface MarkdownFence {
  readonly marker: "`" | "~";
  readonly length: number;
}

interface MarkdownFenceRegion {
  readonly start: number;
  readonly end: number;
}

interface BacktickRun {
  readonly start: number;
  readonly end: number;
  readonly length: number;
  readonly escaped: boolean;
  readonly segment: number;
}

interface HtmlCommentToken {
  readonly start: number;
  readonly end: number;
  readonly kind: "opening" | "closing";
}

const OPENING_FENCE_PATTERN = /^ {0,3}(`{3,}|~{3,})(.*)$/u;

/**
 * Project normalized Markdown body lines while preserving their source lines.
 *
 * Fenced code and HTML comments are replaced with spaces so downstream
 * consumers cannot interpret hidden syntax while raw text and line positions
 * remain available for safe source rewrites. Code spans remain visible to
 * task display, but are also exposed as a same-length semantic mask so links,
 * tags, embeds, and task dates inside code cannot become note metadata.
 */
export function projectMarkdownBody(
  body: string,
  bodyStartLine: number,
): MarkdownBodyProjection {
  const rawLines = body.split("\n");
  const fenceRegions = collectFenceRegions(rawLines, body.length);
  const backtickRuns = collectBacktickRuns(body, fenceRegions);
  const nextSameLengthRun = getNextSameLengthRuns(backtickRuns);
  const htmlCommentTokens = collectHtmlCommentTokens(body);
  const lines: MarkdownBodyLineProjection[] = [];
  let fence: MarkdownFence | null = null;
  let insideHtmlComment = false;
  let codeSpanClosingRunIndex: number | null = null;
  let runCursor = 0;
  let commentTokenCursor = 0;
  let lineStart = 0;

  for (const [index, rawText] of rawLines.entries()) {
    const lineEnd = lineStart + rawText.length;
    let visibleText = "";
    let semanticText = "";

    if (fence !== null) {
      visibleText = maskLine(rawText);
      semanticText = visibleText;
      runCursor = skipRunsBefore(backtickRuns, runCursor, lineEnd);
      commentTokenCursor = skipTokensBefore(
        htmlCommentTokens,
        commentTokenCursor,
        lineEnd,
      );
      if (isClosingFence(rawText, fence)) fence = null;
    } else {
      const openingFence = insideHtmlComment || codeSpanClosingRunIndex !== null
        ? null
        : parseOpeningFence(rawText);
      if (openingFence !== null) {
        fence = openingFence;
        visibleText = maskLine(rawText);
        semanticText = visibleText;
        runCursor = skipRunsBefore(backtickRuns, runCursor, lineEnd);
        commentTokenCursor = skipTokensBefore(
          htmlCommentTokens,
          commentTokenCursor,
          lineEnd,
        );
      } else {
        let cursor = 0;
        while (cursor < rawText.length) {
          const absoluteCursor = lineStart + cursor;

          if (codeSpanClosingRunIndex !== null) {
            const closingRun = backtickRuns[codeSpanClosingRunIndex];
            if (closingRun === undefined || closingRun.start >= lineEnd) {
              visibleText += rawText.slice(cursor);
              semanticText += " ".repeat(rawText.length - cursor);
              commentTokenCursor = skipTokensBefore(
                htmlCommentTokens,
                commentTokenCursor,
                lineEnd,
              );
              cursor = rawText.length;
            } else {
              const closingEnd = closingRun.end - lineStart;
              visibleText += rawText.slice(cursor, closingEnd);
              semanticText += " ".repeat(closingEnd - cursor);
              commentTokenCursor = skipTokensBefore(
                htmlCommentTokens,
                commentTokenCursor,
                closingRun.end,
              );
              cursor = closingEnd;
              codeSpanClosingRunIndex = null;
            }
            continue;
          }

          if (insideHtmlComment) {
            commentTokenCursor = skipUnavailableCommentTokens(
              htmlCommentTokens,
              commentTokenCursor,
              absoluteCursor,
              "closing",
            );
            const closingToken = htmlCommentTokens[commentTokenCursor];
            if (closingToken === undefined || closingToken.start >= lineEnd) {
              visibleText += " ".repeat(rawText.length - cursor);
              semanticText += " ".repeat(rawText.length - cursor);
              runCursor = skipRunsBefore(backtickRuns, runCursor, lineEnd);
              cursor = rawText.length;
            } else {
              const nextCursor = closingToken.end - lineStart;
              visibleText += " ".repeat(nextCursor - cursor);
              semanticText += " ".repeat(nextCursor - cursor);
              runCursor = skipRunsBefore(
                backtickRuns,
                runCursor,
                lineStart + nextCursor,
              );
              commentTokenCursor += 1;
              cursor = nextCursor;
              insideHtmlComment = false;
            }
            continue;
          }

          runCursor = skipUnavailableOpeningRuns(
            backtickRuns,
            runCursor,
            absoluteCursor,
          );
          const openingRun = backtickRuns[runCursor];
          const openingRunIndex = openingRun !== undefined && openingRun.start < lineEnd
            ? runCursor
            : null;
          commentTokenCursor = skipUnavailableCommentTokens(
            htmlCommentTokens,
            commentTokenCursor,
            absoluteCursor,
            "opening",
          );
          const openingCommentToken = htmlCommentTokens[commentTokenCursor];
          const absoluteCommentStart = openingCommentToken === undefined ||
            openingCommentToken.start >= lineEnd
            ? Number.POSITIVE_INFINITY
            : openingCommentToken.start;

          if (
            openingRunIndex !== null &&
            openingRun !== undefined &&
            openingRun.start < absoluteCommentStart
          ) {
            const closingRunIndex = nextSameLengthRun[openingRunIndex];
            if (
              closingRunIndex === null ||
              closingRunIndex === undefined ||
              backtickRuns[closingRunIndex] === undefined
            ) {
              const openingEnd = openingRun.end - lineStart;
              visibleText += rawText.slice(cursor, openingEnd);
              semanticText += rawText.slice(cursor, openingEnd);
              cursor = openingEnd;
              runCursor = openingRunIndex + 1;
            } else {
              const openingStart = openingRun.start - lineStart;
              const openingEnd = openingRun.end - lineStart;
              visibleText += rawText.slice(cursor, openingEnd);
              semanticText += rawText.slice(cursor, openingStart);
              semanticText += " ".repeat(openingEnd - openingStart);
              cursor = openingEnd;
              codeSpanClosingRunIndex = closingRunIndex;
              runCursor = closingRunIndex + 1;
            }
            continue;
          }

          if (absoluteCommentStart !== Number.POSITIVE_INFINITY) {
            const commentStart = absoluteCommentStart - lineStart;
            const commentEnd = openingCommentToken?.end ?? absoluteCommentStart;
            visibleText += rawText.slice(cursor, commentStart);
            visibleText += " ".repeat(commentEnd - absoluteCommentStart);
            semanticText += rawText.slice(cursor, commentStart);
            semanticText += " ".repeat(commentEnd - absoluteCommentStart);
            cursor = commentEnd - lineStart;
            commentTokenCursor += 1;
            insideHtmlComment = true;
          } else {
            visibleText += rawText.slice(cursor);
            semanticText += rawText.slice(cursor);
            runCursor = skipRunsBefore(backtickRuns, runCursor, lineEnd);
            cursor = rawText.length;
          }
        }
      }
    }

    lines.push(Object.freeze({
      sourceLine: bodyStartLine + index,
      rawText,
      visibleText,
      semanticText,
    }));
    lineStart = lineEnd + 1;
  }

  return Object.freeze({ lines: Object.freeze(lines) });
}

function parseOpeningFence(line: string): MarkdownFence | null {
  const match = OPENING_FENCE_PATTERN.exec(line);
  if (match === null) return null;
  const sequence = match[1];
  if (sequence === undefined) return null;
  const marker = sequence.startsWith("`") ? "`" : "~";
  if (marker === "`" && (match[2] ?? "").includes("`")) return null;
  return Object.freeze({ marker, length: sequence.length });
}

function isClosingFence(line: string, fence: MarkdownFence): boolean {
  let cursor = 0;
  while (cursor < line.length && line[cursor] === " ") cursor += 1;
  if (cursor > 3) return false;

  const markerStart = cursor;
  while (cursor < line.length && line[cursor] === fence.marker) cursor += 1;
  if (cursor - markerStart < fence.length) return false;
  return /^[\t ]*$/u.test(line.slice(cursor));
}

function collectFenceRegions(
  lines: readonly string[],
  bodyLength: number,
): readonly MarkdownFenceRegion[] {
  const regions: MarkdownFenceRegion[] = [];
  let fence: MarkdownFence | null = null;
  let regionStart = 0;
  let lineStart = 0;

  for (const line of lines) {
    const lineEnd = lineStart + line.length;
    if (fence === null) {
      const openingFence = parseOpeningFence(line);
      if (openingFence !== null) {
        fence = openingFence;
        regionStart = lineStart;
      }
    } else if (isClosingFence(line, fence)) {
      regions.push(Object.freeze({ start: regionStart, end: lineEnd }));
      fence = null;
    }
    lineStart = lineEnd + 1;
  }

  if (fence !== null) {
    regions.push(Object.freeze({ start: regionStart, end: bodyLength }));
  }
  return Object.freeze(regions);
}

function collectBacktickRuns(
  body: string,
  fenceRegions: readonly MarkdownFenceRegion[],
): readonly BacktickRun[] {
  const runs: BacktickRun[] = [];
  let cursor = 0;
  let regionCursor = 0;
  while (cursor < body.length) {
    const start = body.indexOf("`", cursor);
    if (start === -1) break;
    let end = start + 1;
    while (end < body.length && body[end] === "`") end += 1;
    while (
      regionCursor < fenceRegions.length &&
      start >= (fenceRegions[regionCursor]?.end ?? body.length)
    ) {
      regionCursor += 1;
    }
    const region = fenceRegions[regionCursor];
    const insideFenceRegion = region !== undefined && start >= region.start;
    runs.push(Object.freeze({
      start,
      end,
      length: end - start,
      escaped: isEscaped(body, start),
      segment: regionCursor * 2 + (insideFenceRegion ? 1 : 0),
    }));
    cursor = end;
  }
  return Object.freeze(runs);
}

function getNextSameLengthRuns(
  runs: readonly BacktickRun[],
): readonly (number | null)[] {
  const nextRuns = Array<number | null>(runs.length).fill(null);
  const nextBySegmentAndLength = new Map<number, Map<number, number>>();
  for (let index = runs.length - 1; index >= 0; index -= 1) {
    const run = runs[index];
    if (run === undefined) continue;
    const nextByLength = nextBySegmentAndLength.get(run.segment) ??
      new Map<number, number>();
    nextRuns[index] = nextByLength.get(run.length) ?? null;
    nextByLength.set(run.length, index);
    nextBySegmentAndLength.set(run.segment, nextByLength);
  }
  return nextRuns;
}

function collectHtmlCommentTokens(body: string): readonly HtmlCommentToken[] {
  const tokens: HtmlCommentToken[] = [];
  let cursor = 0;
  while (cursor < body.length) {
    if (body.startsWith("<!--", cursor)) {
      tokens.push(Object.freeze({
        start: cursor,
        end: cursor + 4,
        kind: "opening",
      }));
      cursor += 4;
    } else if (body.startsWith("-->", cursor)) {
      tokens.push(Object.freeze({
        start: cursor,
        end: cursor + 3,
        kind: "closing",
      }));
      cursor += 3;
    } else {
      cursor += 1;
    }
  }
  return Object.freeze(tokens);
}

function skipUnavailableOpeningRuns(
  runs: readonly BacktickRun[],
  startIndex: number,
  minimumOffset: number,
): number {
  let index = startIndex;
  while (index < runs.length) {
    const run = runs[index];
    if (run === undefined || (run.start >= minimumOffset && !run.escaped)) break;
    index += 1;
  }
  return index;
}

function skipRunsBefore(
  runs: readonly BacktickRun[],
  startIndex: number,
  exclusiveMaximumOffset: number,
): number {
  let index = startIndex;
  while (index < runs.length) {
    const run = runs[index];
    if (run === undefined || run.start >= exclusiveMaximumOffset) break;
    index += 1;
  }
  return index;
}

function skipUnavailableCommentTokens(
  tokens: readonly HtmlCommentToken[],
  startIndex: number,
  minimumOffset: number,
  kind: HtmlCommentToken["kind"],
): number {
  let index = startIndex;
  while (index < tokens.length) {
    const token = tokens[index];
    if (token === undefined || (token.start >= minimumOffset && token.kind === kind)) break;
    index += 1;
  }
  return index;
}

function skipTokensBefore(
  tokens: readonly HtmlCommentToken[],
  startIndex: number,
  exclusiveMaximumOffset: number,
): number {
  let index = startIndex;
  while (index < tokens.length) {
    const token = tokens[index];
    if (token === undefined || token.start >= exclusiveMaximumOffset) break;
    index += 1;
  }
  return index;
}

function isEscaped(body: string, offset: number): boolean {
  let backslashCount = 0;
  for (let index = offset - 1; index >= 0 && body[index] === "\\"; index -= 1) {
    backslashCount += 1;
  }
  return backslashCount % 2 === 1;
}

function maskLine(line: string): string {
  return " ".repeat(line.length);
}
