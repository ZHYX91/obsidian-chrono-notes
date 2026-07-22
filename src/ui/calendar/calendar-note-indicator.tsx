import type { NoteStatistics } from "../../core/note/note-statistics";
import type { IndexedPeriodicNoteState } from "../../features/calendar/indexed-periodic-note";
import type { TodoAnnotationMode } from "../../shared/settings";
import { getNoteTaskProgressPresentation } from "../note-task-progress-presentation";

export interface CalendarNoteIndicatorProps {
  readonly show: boolean;
  readonly noteState: IndexedPeriodicNoteState;
  readonly statistics: NoteStatistics;
  readonly taskAnnotationMode: TodoAnnotationMode;
}

export function CalendarNoteIndicator({
  show,
  noteState,
  statistics,
  taskAnnotationMode,
}: CalendarNoteIndicatorProps) {
  if (!show || noteState === "not-configured") return null;

  const progress = getNoteTaskProgressPresentation(statistics);
  if (progress.state === "none" || taskAnnotationMode === "none") {
    return (
      <span
        className="chrono-notes-calendar-indicator is-top is-state"
        data-note-state={noteState}
        aria-hidden="true"
      />
    );
  }

  const text = `${statistics.taskCompleted}/${statistics.taskTotal}`;
  const stateClass = progress.state === "complete"
    ? " is-complete"
    : taskAnnotationMode === "color"
      ? " is-unfinished-color"
      : " is-unfinished-hole";
  return (
    <span
      className={`chrono-notes-calendar-indicator is-top is-progress is-horizontal${stateClass}`}
      data-progress-text={text}
      aria-hidden="true"
    >
      <span
        className="chrono-notes-calendar-indicator-fill"
        style={{ width: `${progress.fraction * 100}%` }}
      />
    </span>
  );
}
