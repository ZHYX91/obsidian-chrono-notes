import type { NoteStatistics } from "../../src/core/note/note-statistics";

export function noteStatistics(
  overrides: Partial<NoteStatistics> = {},
): NoteStatistics {
  return Object.freeze({
    wordCount: 0,
    linkCount: 0,
    tagCount: 0,
    taskTotal: 0,
    taskCompleted: 0,
    taskCompletionRate: 0,
    ...overrides,
  });
}
