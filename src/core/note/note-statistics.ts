import type { NoteTask } from "./note-tasks";

export interface NoteStatistics {
  readonly wordCount: number;
  readonly linkCount: number;
  readonly tagCount: number;
  readonly taskTotal: number;
  readonly taskCompleted: number;
  readonly taskCompletionRate: number;
}

const WORD_PATTERN = /[一-鿿㐀-䶿豈-﫿]|[a-zA-Z''-]+|[0-9]+(?:[,.][0-9]+)*/g;
const WIKI_LINK_PATTERN = /!?\[\[[^[\]]+\]\]/g;
const MARKDOWN_LINK_PATTERN = /!?\[[^\]]+\]\([^)]+\)/g;
const TAG_PATTERN = /(^|[^\p{L}\p{N}_/])#([\p{L}\p{N}_/-]+)/gu;

export function calculateNoteStatistics(
  body: string,
  tasks: readonly NoteTask[],
): NoteStatistics {
  const taskCompleted = tasks.filter((task) => task.completed).length;
  return Object.freeze({
    wordCount: body.match(WORD_PATTERN)?.length ?? 0,
    linkCount:
      (body.match(WIKI_LINK_PATTERN)?.length ?? 0) +
      (body.match(MARKDOWN_LINK_PATTERN)?.length ?? 0),
    tagCount: Array.from(body.matchAll(TAG_PATTERN)).length,
    taskTotal: tasks.length,
    taskCompleted,
    taskCompletionRate:
      tasks.length === 0 ? 0 : Math.round((taskCompleted / tasks.length) * 100),
  });
}
