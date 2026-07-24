import type { NoteEmbedStatistics } from "../../src/core/note/note-preview";

export function noteEmbeds(
  overrides: Partial<NoteEmbedStatistics> = {},
): NoteEmbedStatistics {
  return Object.freeze({
    imageCount: 0,
    pdfCount: 0,
    audioCount: 0,
    videoCount: 0,
    noteCount: 0,
    otherCount: 0,
    ...overrides,
  });
}
