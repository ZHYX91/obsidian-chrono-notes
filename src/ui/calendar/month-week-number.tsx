import type { KeyboardEvent, MouseEvent } from "react";

import type { MonthCalendarWeek } from "../../features/calendar/month-calendar-query";
import type { NoteOpenTarget } from "../../features/periodic/periodic-note-commands";
import type { TodoAnnotationMode } from "../../shared/settings";
import { CalendarNoteIndicator } from "./calendar-note-indicator";
import { bindLongPress, type LongPressGesture } from "./long-press";

export interface MonthWeekNumberProps {
  readonly week: MonthCalendarWeek;
  readonly current: boolean;
  readonly selected: boolean;
  readonly showNoteIndicators: boolean;
  readonly taskAnnotationMode: TodoAnnotationMode;
  readonly ariaLabel: string;
  readonly longPress: LongPressGesture;
  readonly onSelect: () => void;
  readonly onOpen: (target: NoteOpenTarget) => void;
  readonly onMoveToDay: () => void;
}

export function MonthWeekNumber({
  week,
  current,
  selected,
  showNoteIndicators,
  taskAnnotationMode,
  ariaLabel,
  longPress,
  onSelect,
  onOpen,
  onMoveToDay,
}: MonthWeekNumberProps) {
  const touch = bindLongPress(longPress, () => onOpen("default"));
  const note = week.weeklyNote;
  const showStatus = showNoteIndicators && note.noteState !== "not-configured";

  return (
    <div className="chrono-notes-week-number" role="rowheader">
      <button
        type="button"
        className={`chrono-notes-week-number-button${current ? " is-current-period" : ""}${selected ? " is-selected" : ""}`}
        data-note-state={note.noteState}
        data-show-note-indicators={String(showNoteIndicators)}
        aria-label={ariaLabel}
        aria-current={current ? "true" : undefined}
        aria-pressed={selected}
        tabIndex={selected ? 0 : -1}
        onClick={(event) => handleClick(event, touch.consumeClick, onSelect, onOpen)}
        onDoubleClick={() => onOpen("default")}
        onAuxClick={(event) => {
          if (event.button === 1) onOpen("tab");
        }}
        onKeyDown={(event) => {
          handleKeyDown(event, onOpen, onMoveToDay);
        }}
        onTouchStart={touch.onTouchStart}
        onTouchMove={touch.onTouchMove}
        onTouchEnd={touch.onTouchEnd}
        onTouchCancel={touch.onTouchCancel}
      >
        {showStatus ? (
          <span className="chrono-notes-week-number-status">
            <CalendarNoteIndicator
              show
              noteState={note.noteState}
              statistics={note.statistics}
              taskAnnotationMode={taskAnnotationMode}
            />
          </span>
        ) : null}
        <span className="chrono-notes-week-number-label">W{week.weekNumber}</span>
      </button>
    </div>
  );
}

function handleKeyDown(
  event: KeyboardEvent<HTMLButtonElement>,
  onOpen: (target: NoteOpenTarget) => void,
  onMoveToDay: () => void,
): void {
  if (event.key === "ArrowRight") {
    event.preventDefault();
    onMoveToDay();
    return;
  }
  if (event.key !== "Enter") return;
  event.preventDefault();
  onOpen("default");
}

function handleClick(
  event: MouseEvent<HTMLButtonElement>,
  consumeLongPressClick: () => boolean,
  onSelect: () => void,
  onOpen: (target: NoteOpenTarget) => void,
): void {
  if (consumeLongPressClick()) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  onSelect();
  if (event.ctrlKey || event.metaKey) onOpen("tab");
}
