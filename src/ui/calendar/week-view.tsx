import { CalendarPlus } from "lucide-react";
import {
  useMemo,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

import type { NoteTask } from "../../core/note/note-tasks";
import {
  formatLocalDateKey,
  isSameLocalDate,
  toUtcDate,
  type LocalDate,
  type PeriodicNoteType,
  type WeekStartDay,
} from "../../core/periodic/periodic-date";
import {
  canOpenOrCreateIndexedPeriodicNote,
  hasIndexedPeriodicNote,
} from "../../features/calendar/indexed-periodic-note";
import type { WeekCalendarQuery } from "../../features/calendar/week-calendar-query";
import type { NoteOpenTarget } from "../../features/periodic/periodic-note-commands";
import type { Translator } from "../../shared/i18n";
import { formatNoteTaskProgress } from "../note-task-progress-presentation";
import {
  CalendarDayCalendarDetails,
  CalendarDayEvents,
  CalendarDayStatusRow,
} from "./calendar-day-content";
import { formatCalendarDayLabel } from "./calendar-day-presentation";
import { CalendarNoteIndicator } from "./calendar-note-indicator";
import { IntervalGantt } from "./interval-gantt";
import { bindLongPress, type LongPressGesture } from "./long-press";
import {
  formatDatedTaskCount,
  formatWeekDayVisualLabels,
  formatWeekRangeDuration,
  formatWeekTaskDateKinds,
  formatWeekTaskOverdue,
  formatWeekTaskRescheduleLabel,
  formatWeekTaskToggleLabel,
  getWeekViewMessages,
} from "./week-view-presentation";
import { formatCalendarNoteState } from "./calendar-note-presentation";
import {
  createDailyCalendarPreview,
  createPeriodicCalendarPreview,
} from "./calendar-period-preview";
import type { CalendarPreviewCell } from "./calendar-preview-tooltip";
import type { CalendarSelectionKind } from "./year-view";

export interface WeekViewProps {
  readonly query: WeekCalendarQuery;
  readonly translator: Translator;
  readonly selectionKind: CalendarSelectionKind;
  readonly selectedDate: LocalDate;
  readonly today: LocalDate;
  readonly weekStartDay: WeekStartDay;
  readonly showNoteIndicators: boolean;
  readonly showTaskProgress: boolean;
  readonly activePreviewKey: string | null;
  readonly previewId: string;
  readonly onSelectDate: (date: LocalDate) => void;
  readonly onOpenPeriodic: (
    date: LocalDate,
    noteType: PeriodicNoteType,
    target: NoteOpenTarget,
  ) => Promise<void>;
  readonly onOpenPath: (path: string, target: NoteOpenTarget) => Promise<void>;
  readonly onCreateRange: (initialDate: LocalDate) => void;
  readonly onToggleTask: (task: NoteTask) => Promise<void>;
  readonly onRescheduleTask: (
    task: NoteTask,
    nextDueDate: LocalDate,
  ) => Promise<void>;
  readonly onOpenTaskSource: (
    task: NoteTask,
    target: NoteOpenTarget,
  ) => Promise<void>;
  readonly onSchedulePreview: (
    key: string,
    day: CalendarPreviewCell,
    anchor: HTMLButtonElement,
  ) => void;
  readonly onDismissPreview: () => void;
  readonly onOpenDateContextMenu: (
    date: LocalDate,
    configured: boolean,
    noteExists: boolean,
    event: MouseEvent,
  ) => void;
  readonly longPress: LongPressGesture;
}

export function WeekView({
  query,
  translator,
  selectionKind,
  selectedDate,
  today,
  weekStartDay,
  showNoteIndicators,
  showTaskProgress,
  activePreviewKey,
  previewId,
  onSelectDate,
  onOpenPeriodic,
  onOpenPath,
  onCreateRange,
  onToggleTask,
  onRescheduleTask,
  onOpenTaskSource,
  onSchedulePreview,
  onDismissPreview,
  onOpenDateContextMenu,
  longPress,
}: WeekViewProps) {
  const { locale, t } = translator;
  const messages = getWeekViewMessages(t);
  const [draggedTask, setDraggedTask] = useState<NoteTask | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const {
    weekdayFormatter,
    compactWeekdayFormatter,
    narrowWeekdayFormatter,
  } = useMemo(() => ({
    weekdayFormatter: new Intl.DateTimeFormat(locale, {
      weekday: "long",
      timeZone: "UTC",
    }),
    compactWeekdayFormatter: new Intl.DateTimeFormat(locale, {
      weekday: "short",
      timeZone: "UTC",
    }),
    narrowWeekdayFormatter: new Intl.DateTimeFormat(locale, {
      weekday: "narrow",
      timeZone: "UTC",
    }),
  }), [locale]);
  const weeklyNoteTouch = bindLongPress(
    longPress,
    () => void onOpenPeriodic(query.weekStart, "weekly", "default"),
  );
  const showRangeSection = query.rangeCreationConfigured ||
    (query.rangeNotesVisible && query.intervals.totalCount > 0);
  const datedTaskCountLabel = formatDatedTaskCount(query.tasks.length, t);
  const weeklyPreview = createPeriodicCalendarPreview(
    { ...query.weeklyNote, date: query.weekStart },
    "weekly",
    weekStartDay,
  );
  const weeklyPreviewKey = weeklyPreview.previewTitle;

  return (
    <div className="chrono-notes-week-view">
      <div className="chrono-notes-week-calendar">
        <div
          className="chrono-notes-week-overview"
          role="group"
          aria-label={messages.overview}
        >
          {query.days.map((day) => {
            const dayKey = formatLocalDateKey(day.date);
            const dailyPreview = createDailyCalendarPreview(day);
            const selected = selectionKind === "day" &&
              isSameLocalDate(selectedDate, day.date);
            const isToday = isSameLocalDate(today, day.date);
            const visualLabels = formatWeekDayVisualLabels(day.date, locale);
            const accessibleLabel = formatCalendarDayLabel(
              dayKey,
              day,
              {
                includeCalendarExtensions: true,
              },
              t,
            );
            const accessibleLabelId = `${previewId}-${dayKey}-label`;
            const touch = bindLongPress(
              longPress,
              () => void onOpenPeriodic(day.date, "daily", "default"),
              { preferContextMenu: true },
            );
            return (
              <button
                type="button"
                className={`chrono-notes-week-day${selected ? " is-selected" : ""}${isToday ? " is-current-period" : ""}${dropTarget === dayKey ? " is-drop-target" : ""}`}
                data-note-state={day.noteState}
                data-show-note-indicators={String(showNoteIndicators)}
                data-calendar-extension-count={day.calendarExtensions.length}
                data-has-ics={String(day.icsEvents.length > 0)}
                data-regional-marker={day.regionalMarker?.kind ?? "none"}
                aria-pressed={selected}
                aria-current={isToday ? "date" : undefined}
                aria-labelledby={accessibleLabelId}
                aria-describedby={
                  activePreviewKey === dayKey ? previewId : undefined
                }
                key={dayKey}
                onClick={(event) => {
                  if (touch.consumeClick()) {
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                  }
                  handleDayClick(event, day.date, onSelectDate, onOpenPeriodic);
                }}
                onDoubleClick={() =>
                  void onOpenPeriodic(day.date, "daily", "default")
                }
                onAuxClick={(event) => {
                  if (event.button === 1)
                    void onOpenPeriodic(day.date, "daily", "tab");
                }}
                onKeyDown={(event) =>
                  handleDayKeyDown(event, day.date, onOpenPeriodic)
                }
                onTouchStart={touch.onTouchStart}
                onTouchMove={touch.onTouchMove}
                onTouchEnd={touch.onTouchEnd}
                onTouchCancel={touch.onTouchCancel}
                onMouseEnter={(event) =>
                  onSchedulePreview(dayKey, dailyPreview, event.currentTarget)
                }
                onMouseLeave={onDismissPreview}
                onFocus={(event) =>
                  onSchedulePreview(dayKey, dailyPreview, event.currentTarget)
                }
                onBlur={onDismissPreview}
                onContextMenu={(event) => {
                  touch.onContextMenu();
                  event.preventDefault();
                  event.stopPropagation();
                  onDismissPreview();
                  onSelectDate(day.date);
                  onOpenDateContextMenu(
                    day.date,
                    canOpenOrCreateIndexedPeriodicNote(day.noteState),
                    hasIndexedPeriodicNote(day.noteState),
                    event.nativeEvent,
                  );
                }}
                onDragOver={(event) => {
                  if (draggedTask?.dueDate === null || draggedTask === null)
                    return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDragEnter={() => {
                  if (draggedTask?.dueDate !== null && draggedTask !== null)
                    setDropTarget(dayKey);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const task = draggedTask;
                  setDraggedTask(null);
                  setDropTarget(null);
                  if (task !== null && task.dueDate !== dayKey) {
                    void onRescheduleTask(task, day.date);
                  }
                }}
              >
                <span
                  id={accessibleLabelId}
                  className="chrono-notes-visually-hidden"
                >
                  {accessibleLabel}
                </span>
                <CalendarDayStatusRow
                  day={day}
                  showNoteIndicators={showNoteIndicators}
                  showTaskProgress={showTaskProgress}
                  translator={translator}
                />
                <span className="chrono-notes-week-day-name">
                  <span className="is-full">
                    {weekdayFormatter.format(toUtcDate(day.date))}
                  </span>
                  <span className="is-medium">
                    {compactWeekdayFormatter.format(toUtcDate(day.date))}
                  </span>
                  <span className="is-compact">
                    {narrowWeekdayFormatter.format(toUtcDate(day.date))}
                  </span>
                </span>
                <strong className="chrono-notes-week-day-date">
                  <span className="is-full">{visualLabels.full}</span>
                  <span className="is-compact">{visualLabels.compact}</span>
                </strong>
                <span className="chrono-notes-week-day-content">
                  <CalendarDayCalendarDetails
                    day={day}
                    translator={translator}
                  />
                  <CalendarDayEvents
                    events={day.icsEvents}
                    translator={translator}
                    responsive
                  />
                </span>
              </button>
            );
          })}
        </div>
        {showRangeSection ? (
          <section
            className="chrono-notes-week-ranges"
            aria-label={messages.rangeNotes}
          >
            <header>
              <h3>{messages.rangeNotes}</h3>
              {query.rangeCreationConfigured ? (
                <button
                  type="button"
                  className="chrono-notes-week-create-range"
                  aria-label={messages.createRange}
                  title={messages.createRange}
                  onClick={() => onCreateRange(query.weekStart)}
                >
                  <CalendarPlus size={15} aria-hidden="true" />
                </button>
              ) : null}
            </header>
            {query.rangeNotesVisible && query.intervals.totalCount > 0 ? (
              <IntervalGantt
                data={query.intervals}
                variant="week"
                ariaLabel={messages.rangeNotes}
                formatDuration={(count) => formatWeekRangeDuration(count, t)}
                formatMore={(count) => t("navbar.moreRelated", { count })}
                formatTaskProgress={(statistics) =>
                  formatNoteTaskProgress(statistics, t)}
                onOpenPath={onOpenPath}
              />
            ) : null}
          </section>
        ) : null}
      </div>

      <button
          type="button"
          className={`chrono-notes-weekly-note${selectionKind === "week" ? " is-selected" : ""}`}
          data-note-state={query.weeklyNote.noteState}
          aria-pressed={selectionKind === "week"}
          aria-describedby={
            activePreviewKey === weeklyPreviewKey ? previewId : undefined
          }
          onClick={(event) => {
            if (weeklyNoteTouch.consumeClick()) {
              event.preventDefault();
              event.stopPropagation();
              return;
            }
            void onOpenPeriodic(query.weekStart, "weekly", "default");
          }}
          onAuxClick={(event) => {
            if (event.button === 1)
              void onOpenPeriodic(query.weekStart, "weekly", "tab");
          }}
          onTouchStart={weeklyNoteTouch.onTouchStart}
          onTouchMove={weeklyNoteTouch.onTouchMove}
          onTouchEnd={weeklyNoteTouch.onTouchEnd}
          onTouchCancel={weeklyNoteTouch.onTouchCancel}
          onMouseEnter={(event) =>
            onSchedulePreview(
              weeklyPreviewKey,
              weeklyPreview,
              event.currentTarget,
            )}
          onMouseLeave={onDismissPreview}
          onFocus={(event) =>
            onSchedulePreview(
              weeklyPreviewKey,
              weeklyPreview,
              event.currentTarget,
            )}
          onBlur={onDismissPreview}
        >
          <span className="chrono-notes-weekly-note-heading">
            <CalendarNoteIndicator
              show={showNoteIndicators}
              noteState={query.weeklyNote.noteState}
              statistics={query.weeklyNote.statistics}
              showTaskProgress={showTaskProgress}
            />
            <span>{messages.weeklyNote}</span>
          </span>
          <small>
            {formatCalendarNoteState(
              query.weeklyNote.noteState,
              query.weeklyNote.errorMessage,
              t,
            )}
          </small>
          {query.weeklyNote.statistics.taskTotal === 0 ? null : (
            <strong>
              {query.weeklyNote.statistics.taskCompleted}/
              {query.weeklyNote.statistics.taskTotal}
            </strong>
          )}
      </button>

      <section
        className="chrono-notes-week-tasks"
        aria-label={messages.datedTasks}
      >
        <header>
          <h3>{messages.datedTasks}</h3>
          <span aria-label={datedTaskCountLabel} title={datedTaskCountLabel}>
            {query.tasks.length}
          </span>
        </header>
        {query.tasks.length === 0 ? (
          <div className="chrono-notes-week-tasks-empty">
            <strong>{messages.emptyDatedTasks}</strong>
            <span>{messages.datedTaskScope}</span>
          </div>
        ) : (
          <div className="chrono-notes-week-task-list">
            {query.tasks.map((occurrence) => {
              const overdueLabel = formatWeekTaskOverdue(occurrence.overdue, t);
              return (
                <div
                  className="chrono-notes-week-task"
                  data-completed={String(occurrence.task.completed)}
                  data-overdue={occurrence.overdue}
                  key={`${occurrence.task.path}:${occurrence.task.line}:${occurrence.dateKey}`}
                  draggable={occurrence.task.dueDate === occurrence.dateKey}
                  onDragStart={(event) => {
                    if (occurrence.task.dueDate !== occurrence.dateKey) {
                      event.preventDefault();
                      return;
                    }
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData(
                      "text/plain",
                      `${occurrence.task.path}:${occurrence.task.line}`,
                    );
                    setDraggedTask(occurrence.task);
                  }}
                  onDragEnd={() => {
                    setDraggedTask(null);
                    setDropTarget(null);
                  }}
                >
                  <label className="chrono-notes-week-task-toggle">
                    <input
                      type="checkbox"
                      checked={occurrence.task.completed}
                      aria-label={formatWeekTaskToggleLabel(
                        occurrence.task.text,
                        occurrence.dateKinds,
                        occurrence.overdue,
                        t,
                      )}
                      onChange={() => void onToggleTask(occurrence.task)}
                    />
                  </label>
                  {occurrence.task.dueDate === occurrence.dateKey ? (
                    <select
                      className="chrono-notes-week-task-due"
                      value={occurrence.task.dueDate}
                      aria-label={formatWeekTaskRescheduleLabel(
                        occurrence.task.text,
                        t,
                      )}
                      title={formatWeekTaskRescheduleLabel(
                        occurrence.task.text,
                        t,
                      )}
                      draggable={false}
                      onDragStart={(event) => event.stopPropagation()}
                      onChange={(event) => {
                        const nextDay = query.days.find(
                          (day) =>
                            formatLocalDateKey(day.date) ===
                            event.currentTarget.value,
                        );
                        if (
                          nextDay !== undefined &&
                          occurrence.task.dueDate !== event.currentTarget.value
                        ) {
                          void onRescheduleTask(occurrence.task, nextDay.date);
                        }
                      }}
                    >
                      {query.days.map((day) => {
                        const dateKey = formatLocalDateKey(day.date);
                        return (
                          <option value={dateKey} key={dateKey}>
                            {formatWeekDayVisualLabels(day.date, locale).full}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <time dateTime={occurrence.dateKey}>
                      {occurrence.dateKey.slice(5)}
                    </time>
                  )}
                  <button
                    type="button"
                    className="chrono-notes-week-task-source"
                    title={`${occurrence.task.path}:${occurrence.task.line + 1}`}
                    onClick={() =>
                      void onOpenTaskSource(occurrence.task, "tab")
                    }
                  >
                    {occurrence.task.text}
                  </button>
                  <small>
                    <span className="chrono-notes-week-task-kind">
                      {formatWeekTaskDateKinds(occurrence.dateKinds, t)}
                    </span>
                    {overdueLabel === null ? null : (
                      <span className="chrono-notes-week-task-overdue">
                        {overdueLabel}
                      </span>
                    )}
                  </small>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function handleDayClick(
  event: ReactMouseEvent<HTMLButtonElement>,
  date: LocalDate,
  onSelectDate: (date: LocalDate) => void,
  onOpenPeriodic: WeekViewProps["onOpenPeriodic"],
): void {
  onSelectDate(date);
  if (event.ctrlKey || event.metaKey) void onOpenPeriodic(date, "daily", "tab");
}

function handleDayKeyDown(
  event: KeyboardEvent<HTMLButtonElement>,
  date: LocalDate,
  onOpenPeriodic: WeekViewProps["onOpenPeriodic"],
): void {
  if (event.key !== "Enter") return;
  event.preventDefault();
  void onOpenPeriodic(date, "daily", "default");
}
