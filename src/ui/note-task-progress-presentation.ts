import type { NoteStatistics } from "../core/note/note-statistics";
import type { Translator } from "../shared/i18n";

export type NoteTaskProgressState =
  | "none"
  | "not-started"
  | "in-progress"
  | "complete";

export interface NoteTaskProgressPresentation {
  readonly state: NoteTaskProgressState;
  readonly fraction: number;
}

export function getNoteTaskProgressPresentation(
  statistics: Pick<NoteStatistics, "taskCompleted" | "taskTotal">,
): NoteTaskProgressPresentation {
  const total = Math.max(0, statistics.taskTotal);
  const completed = Math.max(0, statistics.taskCompleted);
  const state: NoteTaskProgressState = total === 0
    ? "none"
    : completed === 0
      ? "not-started"
      : completed >= total
        ? "complete"
        : "in-progress";
  return Object.freeze({
    state,
    fraction: total === 0 ? 0 : Math.min(1, completed / total),
  });
}

export function formatNoteTaskProgress(
  statistics: Pick<NoteStatistics, "taskCompleted" | "taskTotal">,
  t: Translator["t"],
): string {
  if (statistics.taskTotal === 0) return t("noteTaskProgress.none");
  return t("calendar.taskProgress", {
    completed: statistics.taskCompleted,
    total: statistics.taskTotal,
    count: statistics.taskTotal,
  });
}

export function formatCompactNoteTaskProgress(
  statistics: Pick<NoteStatistics, "taskCompleted" | "taskTotal">,
  t: Translator["t"],
): string {
  return statistics.taskTotal === 0
    ? t("noteTaskProgress.none")
    : `${statistics.taskCompleted}/${statistics.taskTotal}`;
}
