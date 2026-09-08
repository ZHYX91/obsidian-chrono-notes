import { isSamePeriod, type LocalDate, type PeriodicNoteType, type WeekStartDay } from "../../core/periodic/periodic-date";
import { canOpenOrCreateIndexedPeriodicNote, type IndexedPeriodicNote } from "../../features/calendar/indexed-periodic-note";
import type { NoteOpenTarget } from "../../features/periodic/periodic-note-commands";
import type { Translator } from "../../shared/i18n";
import { CalendarNoteIndicator } from "./calendar-note-indicator";
import { createPeriodicCalendarPreview } from "./calendar-period-preview";
import { getPeriodicSelectionKind } from "./calendar-selection";
import type { CalendarPreviewCell } from "./calendar-preview-tooltip";
import { bindLongPress, type LongPressGesture } from "./long-press";
import { formatCalendarPeriodLabel } from "./calendar-note-presentation";

export interface CalendarPeriodCellProps {
  readonly summary: IndexedPeriodicNote;
  readonly noteType: PeriodicNoteType;
  readonly label: string;
  readonly selectionDetail?: string | undefined;
  readonly translator: Translator;
  readonly showNoteIndicators: boolean;
  readonly showTaskProgress: boolean;
  readonly today: LocalDate;
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly onOpenPeriodic: (date: LocalDate, noteType: PeriodicNoteType, target: NoteOpenTarget) => Promise<void>;
  readonly weekStartDay: WeekStartDay;
  readonly activePreviewKey: string | null;
  readonly previewId: string;
  readonly onSchedulePreview: (key: string, cell: CalendarPreviewCell, anchor: HTMLButtonElement) => void;
  readonly onDismissPreview: () => void;
  readonly longPress: LongPressGesture;
}

export function CalendarPeriodCell({
  summary, noteType, label, selectionDetail, translator, showNoteIndicators, showTaskProgress,
  today, selected, onSelect, onOpenPeriodic, weekStartDay, activePreviewKey, previewId,
  onSchedulePreview, onDismissPreview, longPress,
}: CalendarPeriodCellProps) {
  const kind = getPeriodicSelectionKind(noteType);
  const current = isSamePeriod(today, summary.date, noteType, weekStartDay);
  const open = (target: NoteOpenTarget) => {
    if (canOpenOrCreateIndexedPeriodicNote(summary.noteState)) {
      void onOpenPeriodic(summary.date, noteType, target);
    }
  };
  const touch = bindLongPress(longPress, () => open("default"));
  const periodPreview = createPeriodicCalendarPreview(summary, noteType, weekStartDay);
  const previewKey = periodPreview.previewTitle;
  const accessibleLabel = formatCalendarPeriodLabel(
    selectionDetail === undefined ? label : `${label} ${selectionDetail}`,
    summary.noteState, summary.errorMessage, summary.statistics, translator.t,
  );
  return (
    <button type="button"
      className={`chrono-notes-period-cell${current ? " is-current-period" : ""}${selected ? " is-selected" : ""}`}
      data-period-kind={kind} data-period-year={summary.date.year} data-period-month={summary.date.month}
      data-note-state={summary.noteState} data-show-note-indicators={String(showNoteIndicators)}
      aria-label={accessibleLabel} aria-describedby={activePreviewKey === previewKey ? previewId : undefined}
      aria-current={current ? "true" : undefined} aria-pressed={selected}
      onClick={(event) => {
        if (touch.consumeClick()) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onSelect();
        if (event.ctrlKey || event.metaKey) open("tab");
      }}
      onDoubleClick={() => open("default")}
      onMouseDown={(event) => { if (event.button === 1) event.preventDefault(); }}
      onAuxClick={(event) => {
        if (event.button !== 1) return;
        event.preventDefault();
        open("tab");
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        onSelect();
        open("default");
      }}
      onTouchStart={touch.onTouchStart} onTouchMove={touch.onTouchMove}
      onTouchEnd={touch.onTouchEnd} onTouchCancel={touch.onTouchCancel}
      onMouseEnter={(event) => onSchedulePreview(previewKey, periodPreview, event.currentTarget)}
      onMouseLeave={onDismissPreview}
      onFocus={(event) => onSchedulePreview(previewKey, periodPreview, event.currentTarget)}
      onBlur={onDismissPreview}>
      {showNoteIndicators && summary.noteState !== "not-configured" ? (
        <span className="chrono-notes-period-cell-status">
          <CalendarNoteIndicator show noteState={summary.noteState}
            statistics={summary.statistics} showTaskProgress={showTaskProgress} />
        </span>
      ) : null}
      <span className="chrono-notes-period-cell-label">{label}</span>
    </button>
  );
}
