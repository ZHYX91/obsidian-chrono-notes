import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

import {
  formatLocalDateKey,
  isSameLocalDate,
  isSamePeriod,
  type LocalDate,
  type PeriodicNoteType,
  type WeekStartDay,
} from "../../core/periodic/periodic-date";
import type { CalendarDay } from "../../features/calendar/calendar-day-query";
import {
  canOpenOrCreateIndexedPeriodicNote,
  hasIndexedPeriodicNote,
} from "../../features/calendar/indexed-periodic-note";
import type { MonthCalendarQuery } from "../../features/calendar/month-calendar-query";
import type { NoteOpenTarget } from "../../features/periodic/periodic-note-commands";
import type { Translator } from "../../shared/i18n";
import type { TodoAnnotationMode } from "../../shared/settings";
import { formatNoteTaskProgress } from "../note-task-progress-presentation";
import { formatCalendarNoteState } from "./calendar-note-presentation";
import { moveCalendarSelection } from "./calendar-interaction";
import type { LongPressGesture } from "./long-press";
import { MonthDayCell } from "./month-day-cell";
import { MonthIntervalStrip } from "./month-interval-strip";
import {
  MonthRangeDragGesture,
  type MonthRangeDragCompletion,
  type MonthRangeDragPreview,
} from "./month-range-drag";
import { MonthWeekNumber } from "./month-week-number";
import type { CalendarSelectionKind } from "./year-view";

const TOUCH_PREVIEW_SUPPRESSION_MS = 750;

export interface MonthViewProps {
  readonly query: MonthCalendarQuery;
  readonly translator: Translator;
  readonly today: LocalDate;
  readonly weekdayLabels: readonly string[];
  readonly selection: Readonly<{
    kind: CalendarSelectionKind;
    date: LocalDate;
  }>;
  readonly weekStartDay: WeekStartDay;
  readonly heatmapEnabled: boolean;
  readonly showHoverPreview: boolean;
  readonly showNoteIndicators: boolean;
  readonly taskAnnotationMode: TodoAnnotationMode;
  readonly rangeCreationConfigured: boolean;
  readonly longPress: LongPressGesture;
  readonly preview: Readonly<{
    activeKey: string | null;
    id: string;
    schedule: (key: string, cell: CalendarDay, anchor: HTMLElement) => void;
    dismiss: () => void;
    suppressFor: (durationMs: number) => void;
  }>;
  readonly onSelect: (kind: CalendarSelectionKind, date: LocalDate) => void;
  readonly onMoveSelection: (date: LocalDate) => void;
  readonly onOpenPeriodic: (
    date: LocalDate,
    noteType: PeriodicNoteType,
    target: NoteOpenTarget,
  ) => Promise<void>;
  readonly onOpenPath: (path: string, target: NoteOpenTarget) => Promise<void>;
  readonly onCreateRange: (
    initialDate: LocalDate,
    initialEndDate: LocalDate,
  ) => void;
  readonly onOpenDateContextMenu: (
    date: LocalDate,
    configured: boolean,
    noteExists: boolean,
    event: globalThis.MouseEvent,
  ) => void;
}

export function MonthView({
  query,
  translator,
  today,
  weekdayLabels,
  selection,
  weekStartDay,
  heatmapEnabled,
  showHoverPreview,
  showNoteIndicators,
  taskAnnotationMode,
  rangeCreationConfigured,
  longPress,
  preview,
  onSelect,
  onMoveSelection,
  onOpenPeriodic,
  onOpenPath,
  onCreateRange,
  onOpenDateContextMenu,
}: MonthViewProps) {
  const [hoveredIntervalPath, setHoveredIntervalPath] =
    useState<string | null>(null);
  const [focusedIntervalPath, setFocusedIntervalPath] =
    useState<string | null>(null);
  const [rangePreview, setRangePreview] =
    useState<MonthRangeDragPreview | null>(null);
  const rangeDrag = useMemo(() => new MonthRangeDragGesture(), []);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const focusAfterMove = useRef(false);
  const activeIntervalPath = hoveredIntervalPath ?? focusedIntervalPath;
  const { kind: selectionKind, date: selected } = selection;
  const {
    activeKey: activePreviewKey,
    id: previewId,
    schedule: schedulePreview,
    dismiss: dismissPreview,
    suppressFor: suppressPreviewFor,
  } = preview;
  const { t } = translator;
  const tabStopKey = useMemo(() => {
    const visibleDays = query.weeks
      .flatMap((week) => week.days)
      .filter((cell) => !heatmapEnabled || cell.inCurrentMonth);
    const visibleKeys = new Set(
      visibleDays.map((cell) => formatLocalDateKey(cell.date)),
    );
    const selectedKey = formatLocalDateKey(selected);
    if (visibleKeys.has(selectedKey)) return selectedKey;
    const todayKey = formatLocalDateKey(today);
    if (visibleKeys.has(todayKey)) return todayKey;
    const fallback = visibleDays.find((cell) => cell.inCurrentMonth)
      ?? visibleDays[0];
    return fallback === undefined ? null : formatLocalDateKey(fallback.date);
  }, [heatmapEnabled, query.weeks, selected, today]);

  useEffect(() => {
    setHoveredIntervalPath(null);
    setFocusedIntervalPath(null);
  }, [heatmapEnabled, query.month, query.year]);

  useEffect(() => {
    if (!focusAfterMove.current) return;
    focusAfterMove.current = false;
    buttons.current.get(formatLocalDateKey(selected))?.focus();
  }, [query.month, query.year, selected, selectionKind]);

  const completeRangeDrag = useCallback(
    (completion: MonthRangeDragCompletion | null) => {
      setRangePreview(null);
      if (completion === null) return false;
      dismissPreview();
      onSelect("day", completion.end);
      onCreateRange(completion.start, completion.end);
      return true;
    },
    [dismissPreview, onCreateRange, onSelect],
  );

  useEffect(() => {
    const handleWindowMouseUp = (event: globalThis.MouseEvent) => {
      completeRangeDrag(rangeDrag.finish(undefined, event.button));
    };
    window.addEventListener("mouseup", handleWindowMouseUp);
    return () => window.removeEventListener("mouseup", handleWindowMouseUp);
  }, [completeRangeDrag, rangeDrag]);
  useEffect(() => () => rangeDrag.cancel(), [rangeDrag]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, date: LocalDate) => {
      if (event.key === "Escape" && rangeDrag.isActive()) {
        event.preventDefault();
        rangeDrag.cancel();
        setRangePreview(null);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        void onOpenPeriodic(date, "daily", "default");
        return;
      }
      const next = moveCalendarSelection(date, event.key);
      if (next === date) return;
      event.preventDefault();
      focusAfterMove.current = true;
      onMoveSelection(next);
    },
    [onMoveSelection, onOpenPeriodic, rangeDrag],
  );

  const handleClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>, date: LocalDate) => {
      if (rangeDrag.consumeClick()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      onSelect("day", date);
      if (event.ctrlKey || event.metaKey)
        void onOpenPeriodic(date, "daily", "tab");
    },
    [onOpenPeriodic, onSelect, rangeDrag],
  );

  return (
    <div
      className="chrono-notes-month-grid"
      role="grid"
      aria-rowcount={query.weeks.length + 1}
      aria-colcount={8}
    >
      <div className="chrono-notes-week-row" role="row">
        <div
          className="chrono-notes-week-heading"
          role="columnheader"
          aria-label={t("calendar.weekNumber")}
        >
          {t("calendar.weekAbbreviation")}
        </div>
        <span className="chrono-notes-week-date-spacer" role="presentation" />
        {weekdayLabels.map((label, index) => (
          <div
            className="chrono-notes-weekday"
            role="columnheader"
            key={`${index}-${label}`}
          >
            {label}
          </div>
        ))}
      </div>
      {query.weeks.map((week) => {
        const intervalData = week.intervals;
        return (
          <div
            className="chrono-notes-week-block"
            key={`${week.weekYear}-${week.weekNumber}`}
          >
            <div className="chrono-notes-week-row" role="row">
              <MonthWeekNumber
                week={week}
                current={isSamePeriod(
                  today,
                  week.weekStart,
                  "weekly",
                  weekStartDay,
                )}
                selected={
                  selectionKind === "week" &&
                  isSameLocalDate(selected, week.weekStart)
                }
                showNoteIndicators={!heatmapEnabled && showNoteIndicators}
                taskAnnotationMode={taskAnnotationMode}
                ariaLabel={t("calendar.weekLabel", {
                  week: week.weekNumber,
                  weekYear: week.weekYear,
                  details: [
                    formatCalendarNoteState(
                      week.weeklyNote.noteState,
                      week.weeklyNote.errorMessage,
                      t,
                    ),
                    ...(week.weeklyNote.statistics.taskTotal === 0
                      ? []
                      : [
                          formatNoteTaskProgress(
                            week.weeklyNote.statistics,
                            t,
                          ),
                        ]),
                  ].join(t("calendar.itemSeparator")),
                })}
                longPress={longPress}
                onSelect={() => onSelect("week", week.weekStart)}
                onOpen={(target) =>
                  void onOpenPeriodic(week.weekStart, "weekly", target)
                }
                onMoveToDay={() => {
                  const target = week.days.find(
                    (cell) => !heatmapEnabled || cell.inCurrentMonth,
                  );
                  if (target === undefined) return;
                  focusAfterMove.current = true;
                  onMoveSelection(target.date);
                }}
              />
              <span
                className="chrono-notes-week-date-spacer"
                role="presentation"
              />
              {week.days.map((cell) => {
                const key = formatLocalDateKey(cell.date);
                return (
                  <MonthDayCell
                    key={key}
                    cell={cell}
                    translator={translator}
                    today={today}
                    selected={
                      selectionKind === "day" &&
                      isSameLocalDate(selected, cell.date)
                    }
                    tabStop={tabStopKey === key}
                    heatmapEnabled={heatmapEnabled}
                    showHoverPreview={showHoverPreview}
                    showNoteIndicators={showNoteIndicators}
                    taskAnnotationMode={taskAnnotationMode}
                    rangePreview={rangePreview}
                    activePreviewKey={activePreviewKey}
                    previewId={previewId}
                    longPress={longPress}
                    onSetButtonRef={(buttonKey, element) => {
                      if (element === null) buttons.current.delete(buttonKey);
                      else buttons.current.set(buttonKey, element);
                    }}
                    onClick={(event, date) => {
                      if (longPress.consumeClick()) {
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                      }
                      handleClick(event, date);
                    }}
                    onKeyDown={handleKeyDown}
                    onOpenPeriodic={(date, target) =>
                      void onOpenPeriodic(date, "daily", target)
                    }
                    onMouseDown={(date, event) => {
                      const nextPreview = rangeDrag.start(date, event);
                      if (!rangeCreationConfigured) {
                        rangeDrag.cancel();
                        return;
                      }
                      if (nextPreview === null) return;
                      dismissPreview();
                      setRangePreview(nextPreview);
                    }}
                    onMouseEnter={(dayKey, day, event) => {
                      if (!rangeDrag.isActive()) {
                        schedulePreview(dayKey, day, event.currentTarget);
                        return;
                      }
                      dismissPreview();
                      setRangePreview(rangeDrag.move(day.date, event.buttons));
                    }}
                    onFocus={(dayKey, day, anchor) => {
                      schedulePreview(dayKey, day, anchor);
                    }}
                    onMouseUp={(date, event) => {
                      if (!completeRangeDrag(rangeDrag.finish(date, event.button)))
                        return;
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onDismissPreview={dismissPreview}
                    onTouchPreviewStart={() => {
                      suppressPreviewFor(TOUCH_PREVIEW_SUPPRESSION_MS);
                      dismissPreview();
                    }}
                    onContextMenu={(day, event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      dismissPreview();
                      onSelect("day", day.date);
                      onOpenDateContextMenu(
                        day.date,
                        canOpenOrCreateIndexedPeriodicNote(day.noteState),
                        hasIndexedPeriodicNote(day.noteState),
                        event.nativeEvent,
                      );
                    }}
                  />
                );
              })}
            </div>
            {heatmapEnabled ? null : (
              <MonthIntervalStrip
                data={intervalData}
                translator={translator}
                activePath={activeIntervalPath}
                onHoverPathChange={setHoveredIntervalPath}
                onFocusPathChange={setFocusedIntervalPath}
                onOpenPath={onOpenPath}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
