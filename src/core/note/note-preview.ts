const NOTE_PREVIEW_MAX_LINES = 4;
const NOTE_PREVIEW_MAX_LENGTH = 280;

const IMAGE_EXTENSIONS = new Set([
  "avif",
  "bmp",
  "gif",
  "jpeg",
  "jpg",
  "png",
  "svg",
  "webp",
]);
const AUDIO_EXTENSIONS = new Set([
  "aac",
  "flac",
  "m4a",
  "mp3",
  "ogg",
  "wav",
]);
const VIDEO_EXTENSIONS = new Set([
  "avi",
  "m4v",
  "mov",
  "mp4",
  "mpeg",
  "webm",
]);

export interface NoteEmbedStatistics {
  readonly imageCount: number;
  readonly pdfCount: number;
  readonly audioCount: number;
  readonly videoCount: number;
  readonly noteCount: number;
  readonly otherCount: number;
}

export interface NotePreviewSummary {
  readonly text: string | null;
  readonly embeds: NoteEmbedStatistics;
}

export const EMPTY_NOTE_EMBED_STATISTICS: NoteEmbedStatistics = Object.freeze({
  imageCount: 0,
  pdfCount: 0,
  audioCount: 0,
  videoCount: 0,
  noteCount: 0,
  otherCount: 0,
});

export function deriveNotePreview(body: string): NotePreviewSummary {
  const withoutCodeFences = body
    .replace(/^```[\s\S]*?^```[ \t]*$/gm, "")
    .replace(/^~~~[\s\S]*?^~~~[ \t]*$/gm, "");
  const counts: MutableNoteEmbedStatistics = {
    imageCount: 0,
    pdfCount: 0,
    audioCount: 0,
    videoCount: 0,
    noteCount: 0,
    otherCount: 0,
  };
  const lines: string[] = [];
  let totalLength = 0;
  let previewComplete = false;

  for (const rawLine of withoutCodeFences.split("\n")) {
    if (previewComplete) {
      stripAndCountEmbeds(rawLine, counts);
      continue;
    }
    const cleaned = cleanPreviewLine(rawLine, counts);
    if (cleaned === null) continue;

    const remaining = NOTE_PREVIEW_MAX_LENGTH - totalLength;
    if (remaining <= 0) {
      previewComplete = true;
      continue;
    }
    const clipped = cleaned.length > remaining
      ? `${cleaned.slice(0, Math.max(0, remaining - 1)).trimEnd()}…`
      : cleaned;
    lines.push(clipped);
    totalLength += clipped.length;
    previewComplete =
      lines.length >= NOTE_PREVIEW_MAX_LINES || clipped.endsWith("…");
  }

  return Object.freeze({
    text: lines.length === 0 ? null : lines.join("\n"),
    embeds: freezeEmbedStatistics(counts),
  });
}

export function summarizeNotePreview(body: string): string | null {
  return deriveNotePreview(body).text;
}

function cleanPreviewLine(
  line: string,
  counts: MutableNoteEmbedStatistics,
): string | null {
  const withoutEmbeds = stripAndCountEmbeds(line, counts);
  const text = withoutEmbeds
    .trim()
    .replace(/^>\s*/, "")
    .replace(/^#{1,6}\s*/, "")
    .replace(/^[-*+]\s+\[[ xX]\]\s+/, "")
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+\.\s+/, "")
    .replace(/^\[!.*?\]\s*/, "")
    .replace(/\[\[([^\]]+)\]\]/g, (_match, target: string) =>
      formatWikiLink(target))
    .replace(/\[([^\]]+)\]\((.*?)\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/\*\*|__|\*|~~|==/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length === 0 ? null : text;
}

function stripAndCountEmbeds(
  line: string,
  counts: MutableNoteEmbedStatistics,
): string {
  let output = "";
  let cursor = 0;
  while (cursor < line.length) {
    const embed = parseEmbedAt(line, cursor);
    if (embed === null) {
      output += line[cursor] ?? "";
      cursor += 1;
      continue;
    }
    incrementEmbedCount(counts, classifyEmbed(embed.target, embed.wiki));
    cursor = embed.nextIndex;
  }
  return output;
}

function parseEmbedAt(
  line: string,
  startIndex: number,
): Readonly<{ target: string; wiki: boolean; nextIndex: number }> | null {
  if (line.startsWith("![[", startIndex)) {
    const endIndex = findWikiEmbedEnd(line, startIndex + 3);
    return endIndex === null
      ? null
      : Object.freeze({
          target: line.slice(startIndex + 3, endIndex),
          wiki: true,
          nextIndex: endIndex + 2,
        });
  }
  if (!line.startsWith("![", startIndex)) return null;
  const altEnd = findUnescapedCharacter(line, startIndex + 2, "]");
  if (altEnd === null || line[altEnd + 1] !== "(") return null;
  const destinationEnd = findBalancedDestinationEnd(line, altEnd + 2);
  return destinationEnd === null
    ? null
    : Object.freeze({
        target: extractMarkdownDestination(
          line.slice(altEnd + 2, destinationEnd),
        ),
        wiki: false,
        nextIndex: destinationEnd + 1,
      });
}

function findWikiEmbedEnd(line: string, startIndex: number): number | null {
  for (let index = startIndex; index < line.length - 1; index += 1) {
    if (line[index] === "\\") {
      index += 1;
      continue;
    }
    if (line[index] === "]" && line[index + 1] === "]") return index;
  }
  return null;
}

function findUnescapedCharacter(
  line: string,
  startIndex: number,
  target: string,
): number | null {
  for (let index = startIndex; index < line.length; index += 1) {
    if (line[index] === "\\") {
      index += 1;
      continue;
    }
    if (line[index] === target) return index;
  }
  return null;
}

function findBalancedDestinationEnd(
  line: string,
  startIndex: number,
): number | null {
  let depth = 1;
  for (let index = startIndex; index < line.length; index += 1) {
    const character = line[index];
    if (character === "\\") {
      index += 1;
      continue;
    }
    if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return null;
}

function extractMarkdownDestination(target: string): string {
  const trimmed = target.trim();
  if (trimmed.startsWith("<")) {
    const closing = trimmed.indexOf(">");
    if (closing > 0) return trimmed.slice(1, closing);
  }
  return trimmed.replace(/\s+(?=["'(]).*$/, "");
}

function formatWikiLink(target: string): string {
  const parts = target.split("|");
  return (parts[1] ?? parts[0] ?? "").trim();
}

type NoteEmbedKind = "image" | "pdf" | "audio" | "video" | "note" | "other";

interface MutableNoteEmbedStatistics {
  imageCount: number;
  pdfCount: number;
  audioCount: number;
  videoCount: number;
  noteCount: number;
  otherCount: number;
}

function classifyEmbed(target: string, wikiEmbed: boolean): NoteEmbedKind {
  const name = getEmbedName(target);
  const extension = getExtension(name);
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  if (extension === "pdf") return "pdf";
  if (AUDIO_EXTENSIONS.has(extension)) return "audio";
  if (VIDEO_EXTENSIONS.has(extension)) return "video";
  if (wikiEmbed && (extension.length === 0 || extension === "md"))
    return "note";
  return "other";
}

function getEmbedName(target: string): string {
  const withoutAlias = target.split("|")[0]?.trim() ?? "";
  const withoutAnchor = withoutAlias.split("#")[0]?.trim() ?? "";
  const withoutQuery = withoutAnchor.split("?")[0]?.trim() ?? "";
  try {
    const url = new URL(withoutQuery);
    const pathnameName = url.pathname.split("/").filter(Boolean).pop();
    return decodeURIComponent(pathnameName || url.hostname || withoutQuery);
  } catch {
    return withoutQuery.split(/[\\/]/).filter(Boolean).pop() ?? withoutQuery;
  }
}

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  return lastDot <= 0 ? "" : filename.slice(lastDot + 1).toLowerCase();
}

function incrementEmbedCount(
  counts: MutableNoteEmbedStatistics,
  kind: NoteEmbedKind,
): void {
  switch (kind) {
    case "image":
      counts.imageCount += 1;
      break;
    case "pdf":
      counts.pdfCount += 1;
      break;
    case "audio":
      counts.audioCount += 1;
      break;
    case "video":
      counts.videoCount += 1;
      break;
    case "note":
      counts.noteCount += 1;
      break;
    case "other":
      counts.otherCount += 1;
      break;
  }
}

function freezeEmbedStatistics(
  counts: MutableNoteEmbedStatistics,
): NoteEmbedStatistics {
  const total = counts.imageCount +
    counts.pdfCount +
    counts.audioCount +
    counts.videoCount +
    counts.noteCount +
    counts.otherCount;
  return total === 0 ? EMPTY_NOTE_EMBED_STATISTICS : Object.freeze({ ...counts });
}
