const NOTE_PREVIEW_MAX_LINES = 4;
const NOTE_PREVIEW_MAX_LENGTH = 280;

export function summarizeNotePreview(body: string): string | null {
  const withoutCodeFences = body
    .replace(/^```[\s\S]*?^```[ \t]*$/gm, "")
    .replace(/^~~~[\s\S]*?^~~~[ \t]*$/gm, "");
  const lines: string[] = [];
  let totalLength = 0;

  for (const rawLine of withoutCodeFences.split("\n")) {
    const cleaned = cleanPreviewLine(rawLine);
    if (cleaned === null) continue;

    const remaining = NOTE_PREVIEW_MAX_LENGTH - totalLength;
    if (remaining <= 0) break;
    const clipped = cleaned.length > remaining
      ? `${cleaned.slice(0, Math.max(0, remaining - 1)).trimEnd()}…`
      : cleaned;
    lines.push(clipped);
    totalLength += clipped.length;
    if (lines.length >= NOTE_PREVIEW_MAX_LINES || clipped.endsWith("…")) break;
  }

  return lines.length === 0 ? null : lines.join("\n");
}

function cleanPreviewLine(line: string): string | null {
  const text = line
    .trim()
    .replace(/^>\s*/, "")
    .replace(/^#{1,6}\s*/, "")
    .replace(/^[-*+]\s+\[[ xX]\]\s+/, "")
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+\.\s+/, "")
    .replace(/^\[!.*?\]\s*/, "")
    .replace(/!\[\[([^\]]+)\]\]/g, (_match, target: string) => formatAttachment(target))
    .replace(/\[\[([^\]]+)\]\]/g, (_match, target: string) => formatWikiLink(target))
    .replace(/!\[([^\]]*)\]\((.*?)\)/g, (_match, alt: string, target: string) =>
      formatAttachment(target, alt),
    )
    .replace(/\[([^\]]+)\]\((.*?)\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/\*\*|__|\*|~~|==/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length === 0 ? null : text;
}

function formatWikiLink(target: string): string {
  const parts = target.split("|");
  return (parts[1] ?? parts[0] ?? "").trim();
}

function formatAttachment(target: string, altText = ""): string {
  const attachmentName = getAttachmentName(target);
  const displayName = altText.trim() || attachmentName;
  return `${getAttachmentKindLabel(attachmentName)}: ${displayName}`;
}

function getAttachmentName(target: string): string {
  const withoutAlias = target.split("|")[0]?.trim() ?? "";
  const withoutAnchor = withoutAlias.split("#")[0]?.trim() ?? "";
  try {
    const url = new URL(withoutAnchor);
    const pathnameName = url.pathname.split("/").filter(Boolean).pop();
    return decodeURIComponent(pathnameName || url.hostname || withoutAnchor);
  } catch {
    return withoutAnchor.split(/[\\/]/).filter(Boolean).pop() ?? withoutAnchor;
  }
}

function getAttachmentKindLabel(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["avif", "bmp", "gif", "jpeg", "jpg", "png", "svg", "webp"].includes(extension)) {
    return "Image";
  }
  if (extension === "pdf") return "PDF";
  if (["aac", "flac", "m4a", "mp3", "ogg", "wav"].includes(extension)) return "Audio";
  if (["avi", "m4v", "mov", "mp4", "mpeg", "webm"].includes(extension)) return "Video";
  return "Attachment";
}
