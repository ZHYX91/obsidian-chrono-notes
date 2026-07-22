import type {
  KeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from "react";

import {
  formatLocalDateKey,
  isSameLocalDate,
  type LocalDate,
} from "../../core/periodic/periodic-date";
import type { MonthCalendarDay } from "../../features/calendar/month-calendar-query";
import type { NoteOpenTarget } from "../../features/periodic/periodic-note-commands";
import type { Translator } from "../../shared/i18n";
import type { TodoAnnotationMode } from "../../shared/settings";
import {
  CalendarDayCalendarDetails,
  CalendarDayEvents,
  CalendarDayStatusRow,
} from "./calendar-day-content";
import {
  canPreviewCalendarDay,
  formatCalendarDayLabel,
} from "./calendar-day-presentation";
import { bindLongPress, type LongPressGesture } from "./long-press";
import {
  isDateInMonthRange,
  type MonthRangeDragPreview,
} from "./month-range-drag";

export interface MonthDayCellProps {
  readonly cell: MonthCalendarDay;
  readonly translator: Translator;
  readonly today: LocalDate;
  readonly selected: boolean;
  readonly tabStop: boolean;
  readonly heatmapEnabled: boolean;
  readonly showHoverPreview: boolean;
  readonly showNoteIndicators: boolean;
  readonly taskAnnotationMode: TodoAnnotationMode;
  readonly rangePreview: MonthRangeDragPreview | null;
  readonly activePreviewKey: string | null;
  readonly previewId: string;
  readonly longPress: LongPressGesture;
  readonly onSetButtonRef: (key: string, element: HTMLButtonElement | null) => void;
  readonly onClick: (event: ReactMouseEvent<HTMLButtonElement>, date: LocalDate) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, date: LocalDate) => void;
  readonly onOpenPeriodic: (date: LocalDate, target: NoteOpenTarget) => void;
  readonly onMouseDown: (
    date: LocalDate,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => void;
  readonly onMouseEnter: (
    key: string,
    cell: MonthCalendarDay,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => void;
  readonly onFocus: (
    key: string,
    cell: MonthCalendarDay,
    anchor: HTMLButtonElement,
  ) => void;
  readonly onMouseUp: (
    date: LocalDate,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => void;
  readonly onDismissPreview: () => void;
  readonly onTouchPreviewStart: () => void;
  readonly onContextMenu: (
    cell: MonthCalendarDay,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => void;
}

export function MonthDayCell({
  cell,
  translator,
  today,
  selected,
  tabStop,
  heatmapEnabled,
  showHoverPreview,
  showNoteIndicators,
  taskAnnotationMode,
  rangePreview,
  activePreviewKey,
  previewId,
  longPress,
  onSetButtonRef,
  onClick,
  onKeyDown,
  onOpenPeriodic,
  onMouseDown,
  onMouseEnter,
  onFocus,
  onMouseUp,
  onDismissPreview,
  onTouchPreviewStart,
  onContextMenu,
}: MonthDayCellProps) {
  const key = formatLocalDateKey(cell.date);
  const isToday = isSameLocalDate(cell.date, today);
  const isHiddenHeatmapCell = heatmapEnabled && !cell.inCurrentMonth;
  const isRangePreview = rangePreview !== null &&
    isDateInMonthRange(cell.date, rangePreview);
  const isRangeStart = rangePreview !== null && isSameLocalDate(cell.date, rangePreview.start);
  const isRangeEnd = rangePreview !== null && isSameLocalDate(cell.date, rangePreview.end);
  const hasCustomPreview = showHoverPreview && canPreviewCalendarDay(cell);
  const accessibleLabel = formatCalendarDayLabel(key, cell, {
    includeCalendarOverlays: true,
  }, translator.t);
  const fallbackTitle = formatCalendarDayLabel(key, cell, {
    includeCalendarOverlays: false,
  }, translator.t);
  const touch = bindLongPress(
    longPress,
    () => onOpenPeriodic(cell.date, "default"),
    { preferContextMenu: true },
  );

  return (
    <button
      ref={(element) => onSetButtonRef(key, element)}
      type="button"
      role="gridcell"
      className={`chrono-notes-day${cell.inCurrentMonth ? "" : " is-outside"}${isToday ? " is-current-period" : ""}${selected ? " is-selected" : ""}${heatmapEnabled ? " is-heatmap" : ""}${isRangePreview ? " is-range-preview" : ""}${isRangeStart ? " is-range-start" : ""}${isRangeEnd ? " is-range-end" : ""}`}
      disabled={isHiddenHeatmapCell}
      data-note-state={cell.noteState}
      data-heatmap-level={cell.heatmap?.level ?? "none"}
      data-has-tasks={String(cell.statistics.taskTotal > 0)}
      data-overlay-count={cell.calendarOverlays.length}
      data-regional-marker={cell.regionalMarker?.kind ?? "none"}
      aria-hidden={isHiddenHeatmapCell || undefined}
      aria-label={accessibleLabel}
      aria-current={isToday ? "date" : undefined}
      aria-selected={selected}
      aria-describedby={activePreviewKey === key ? previewId : undefined}
      tabIndex={isHiddenHeatmapCell ? -1 : tabStop ? 0 : -1}
      title={hasCustomPreview ? undefined : fallbackTitle}
      onClick={(event) => onClick(event, cell.date)}
      onDoubleClick={() => onOpenPeriodic(cell.date, "default")}
      onAuxClick={(event) => {
        if (event.button === 1) onOpenPeriodic(cell.date, "tab");
      }}
      onKeyDown={(event) => onKeyDown(event, cell.date)}
      onMouseDown={(event) => onMouseDown(cell.date, event)}
      onMouseEnter={(event) => onMouseEnter(key, cell, event)}
      onMouseUp={(event) => onMouseUp(cell.date, event)}
      onMouseLeave={onDismissPreview}
      onFocus={(event) => onFocus(key, cell, event.currentTarget)}
      onBlur={onDismissPreview}
      onTouchStart={() => {
        onTouchPreviewStart();
        touch.onTouchStart();
      }}
      onTouchMove={touch.onTouchMove}
      onTouchEnd={touch.onTouchEnd}
      onTouchCancel={touch.onTouchCancel}
      onContextMenu={(event) => {
        touch.onContextMenu();
        onContextMenu(cell, event);
      }}
    >
      <span className="chrono-notes-day-main">
        {isHiddenHeatmapCell ? null : heatmapEnabled ? (
          <span className="chrono-notes-day-number">{cell.date.day}</span>
        ) : (
          <>
            <span className="chrono-notes-day-heading">
              <CalendarDayStatusRow
                day={cell}
                showNoteIndicators={showNoteIndicators}
                taskAnnotationMode={taskAnnotationMode}
                translator={translator}
              />
              <span className="chrono-notes-day-number">{cell.date.day}</span>
            </span>
            <span className="chrono-notes-day-content">
              <CalendarDayCalendarDetails day={cell} translator={translator} />
              <CalendarDayEvents events={cell.icsEvents} translator={translator} />
            </span>
          </>
        )}
      </span>
    </button>
  );
}
