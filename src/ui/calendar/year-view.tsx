import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
} from "react";

import {
  formatLocalDateKey,
  isSameLocalDate,
  isSamePeriod,
  shiftPeriod,
  type LocalDate,
  type PeriodicNoteType,
} from "../../core/periodic/periodic-date";
import type {
  YearHeatmapDay,
  YearCalendarQuery,
  YearPeriodicSummary,
  YearCalendarQuarter,
} from "../../features/calendar/year-calendar-query";
import { hasIndexedPeriodicNote } from "../../features/calendar/indexed-periodic-note";
import type { NoteOpenTarget } from "../../features/periodic/periodic-note-commands";
import type { Translator } from "../../shared/i18n";
import type {
  QuarterNameMode,
  TodoAnnotationMode,
} from "../../shared/settings";
import { formatShortMonthLabels } from "../date-presentation";
import { CalendarNoteIndicator } from "./calendar-note-indicator";
import { bindLongPress, type LongPressGesture } from "./long-press";
import { CalendarPreviewTooltip } from "./calendar-preview-tooltip";
import { useCalendarPreview } from "./use-calendar-preview";
import {
  formatQuarterPlaceholderHeight,
  getInitialRenderedQuarters,
  getQuarterWindow,
  isSelectedDayRendered,
} from "./year-view-virtualization";
import {
  formatYearHeatmapDayLabel,
  formatYearHeatmapGridLabel,
  formatYearPeriodLabel,
  formatYearQuarterLabel,
  resolveYearHeatmapTabIndex,
} from "./year-view-presentation";

const QUARTER_OBSERVER_MARGIN = "220px 0px";
const QUARTER_PLACEHOLDER_HEIGHT_PROPERTY =
  "--chrono-notes-year-quarter-height";

export type CalendarSelectionKind = "day" | "week" | "month" | "quarter";

export interface YearViewProps {
  readonly query: YearCalendarQuery;
  readonly translator: Translator;
  readonly today: LocalDate;
  readonly heatmap: boolean;
  readonly showHoverPreview: boolean;
  readonly showNoteIndicators: boolean;
  readonly taskAnnotationMode: TodoAnnotationMode;
  readonly quarterNameMode: QuarterNameMode;
  readonly selection: Readonly<{
    kind: CalendarSelectionKind;
    date: LocalDate;
  }>;
  readonly monthSelectionRequest: number;
  readonly onSelect: (kind: CalendarSelectionKind, date: LocalDate) => void;
  readonly onOpenPeriodic: (
    date: LocalDate,
    noteType: PeriodicNoteType,
    target: NoteOpenTarget,
  ) => Promise<void>;
  readonly onOpenDateContextMenu: (
    date: LocalDate,
    configured: boolean,
    noteExists: boolean,
    event: globalThis.MouseEvent,
  ) => void;
  readonly longPress: LongPressGesture;
}

export function YearView({
  query,
  translator,
  today,
  heatmap,
  showHoverPreview,
  showNoteIndicators,
  taskAnnotationMode,
  quarterNameMode,
  selection,
  monthSelectionRequest,
  onSelect,
  onOpenPeriodic,
  onOpenDateContextMenu,
  longPress,
}: YearViewProps) {
  const [renderedQuarters, setRenderedQuarters] = useState(
    () => getInitialRenderedQuarters(
      selection.kind === "month" && selection.date.year === query.year
        ? selection.date.month
        : null,
    ),
  );
  const root = useRef<HTMLDivElement>(null);
  const dayButtons = useRef(new Map<string, HTMLButtonElement>());
  const handledMonthSelection = useRef<string | null>(null);
  const previewEnabled = heatmap && showHoverPreview;
  const {
    activePreview,
    activePreviewKey,
    previewId,
    schedulePreview,
    dismissPreview,
  } = useCalendarPreview<YearHeatmapDay>({
    enabled: previewEnabled,
    dismissOnDisable: true,
  });
  const monthLabels = useMemo(
    () => formatShortMonthLabels(query.year, translator.locale),
    [query.year, translator.locale],
  );
  const visiblePreview = previewEnabled &&
    activePreview?.key.startsWith(`${query.year}-`)
    ? activePreview
    : null;

  useEffect(() => {
    handledMonthSelection.current = null;
    setRenderedQuarters(getInitialRenderedQuarters(
      selection.kind === "month" && selection.date.year === query.year
        ? selection.date.month
        : null,
    ));
    dismissPreview();
  }, [dismissPreview, query.year]);

  useLayoutEffect(() => {
    const view = root.current;
    const measuredQuarter = view?.querySelector<HTMLElement>(
      ":scope > .chrono-notes-year-quarter-section",
    );
    if (
      view === null ||
      measuredQuarter === null ||
      measuredQuarter === undefined
    )
      return;
    const updatePlaceholderHeight = () => {
      const height = formatQuarterPlaceholderHeight(
        measuredQuarter.getBoundingClientRect().height,
      );
      if (height !== null)
        view.style.setProperty(QUARTER_PLACEHOLDER_HEIGHT_PROPERTY, height);
    };
    updatePlaceholderHeight();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updatePlaceholderHeight);
    observer.observe(measuredQuarter);
    return () => observer.disconnect();
  }, [heatmap, query.year]);

  const revealQuarter = useCallback((quarter: number) => {
    setRenderedQuarters((current) => {
      const next = new Set(current);
      let changed = false;
      for (const visibleQuarter of getQuarterWindow(quarter)) {
        if (!next.has(visibleQuarter)) {
          next.add(visibleQuarter);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, []);

  useEffect(() => {
    if (selection.kind !== "month" || selection.date.year !== query.year) {
      handledMonthSelection.current = null;
      return;
    }
    const selectionKey = `${selection.date.year}-${selection.date.month}-${monthSelectionRequest}`;
    if (handledMonthSelection.current === selectionKey) return;
    const quarter = Math.ceil(selection.date.month / 3);
    if (!renderedQuarters.has(quarter)) {
      revealQuarter(quarter);
      return;
    }
    handledMonthSelection.current = selectionKey;
    const frame = window.requestAnimationFrame(() => {
      root.current?.querySelector<HTMLElement>(
        `[data-period-kind="month"][data-period-month="${selection.date.month}"]`,
      )?.scrollIntoView({ block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    query.year,
    monthSelectionRequest,
    renderedQuarters,
    revealQuarter,
    selection.date.month,
    selection.date.year,
    selection.kind,
  ]);

  const moveDay = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, date: LocalDate) => {
      const amount =
        event.key === "ArrowLeft"
          ? -7
          : event.key === "ArrowRight"
            ? 7
            : event.key === "ArrowUp"
              ? -1
              : event.key === "ArrowDown"
                ? 1
                : 0;
      if (amount === 0) return;
      const next = shiftPeriod(date, "daily", amount, "monday");
      if (next.year !== query.year) return;
      event.preventDefault();
      dismissPreview();
      revealQuarter(Math.ceil(next.month / 3));
      onSelect("day", next);
      window.requestAnimationFrame(() =>
        dayButtons.current.get(formatLocalDateKey(next))?.focus(),
      );
    },
    [dismissPreview, onSelect, query.year, revealQuarter],
  );

  return (
    <div
      ref={root}
      className="chrono-notes-year-view"
      data-mode={heatmap ? "heatmap" : "summary"}
    >
      {query.quarters.map((quarter) => (
        <LazyQuarter
          key={`${query.year}-${quarter.quarter}`}
          quarter={quarter}
          translator={translator}
          monthLabels={monthLabels}
          today={today}
          showNoteIndicators={showNoteIndicators}
          taskAnnotationMode={taskAnnotationMode}
          quarterNameMode={quarterNameMode}
          heatmap={heatmap}
          rendered={renderedQuarters.has(quarter.quarter)}
          selection={selection}
          hasRenderedDaySelection={isSelectedDayRendered(
            selection.kind === "day" && selection.date.year === query.year,
            selection.date.month,
            renderedQuarters,
          )}
          dayButtons={dayButtons}
          onVisible={revealQuarter}
          onSelect={onSelect}
          onOpenPeriodic={onOpenPeriodic}
          onOpenDateContextMenu={onOpenDateContextMenu}
          onMoveDay={moveDay}
          onSchedulePreview={schedulePreview}
          onDismissPreview={dismissPreview}
          previewId={previewId}
          activePreviewKey={activePreviewKey}
          longPress={longPress}
        />
      ))}
      {visiblePreview === null ? null : (
        <CalendarPreviewTooltip
          id={previewId}
          preview={visiblePreview}
          translator={translator}
        />
      )}
    </div>
  );
}

interface LazyQuarterProps {
  readonly quarter: YearCalendarQuarter;
  readonly translator: Translator;
  readonly monthLabels: readonly string[];
  readonly today: LocalDate;
  readonly showNoteIndicators: boolean;
  readonly taskAnnotationMode: TodoAnnotationMode;
  readonly quarterNameMode: QuarterNameMode;
  readonly heatmap: boolean;
  readonly rendered: boolean;
  readonly selection: YearViewProps["selection"];
  readonly hasRenderedDaySelection: boolean;
  readonly dayButtons: MutableRefObject<Map<string, HTMLButtonElement>>;
  readonly onVisible: (quarter: number) => void;
  readonly onSelect: YearViewProps["onSelect"];
  readonly onOpenPeriodic: YearViewProps["onOpenPeriodic"];
  readonly onOpenDateContextMenu: YearViewProps["onOpenDateContextMenu"];
  readonly onMoveDay: (
    event: KeyboardEvent<HTMLButtonElement>,
    date: LocalDate,
  ) => void;
  readonly onSchedulePreview: (
    key: string,
    cell: YearHeatmapDay,
    anchor: HTMLButtonElement,
  ) => void;
  readonly onDismissPreview: () => void;
  readonly previewId: string;
  readonly activePreviewKey: string | null;
  readonly longPress: LongPressGesture;
}

function LazyQuarter(props: LazyQuarterProps) {
  const root = useRef<HTMLElement>(null);
  const { onVisible, quarter, rendered } = props;
  useEffect(() => {
    if (rendered) return;
    const element = root.current;
    if (element === null) return;
    if (typeof IntersectionObserver === "undefined") {
      onVisible(quarter.quarter);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting))
          onVisible(quarter.quarter);
      },
      { rootMargin: QUARTER_OBSERVER_MARGIN, threshold: 0 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [onVisible, quarter.quarter, rendered]);

  return (
    <section ref={root} className="chrono-notes-year-quarter-section">
      {rendered ? (
        props.heatmap ? (
          <HeatmapQuarter {...props} />
        ) : (
          <SummaryQuarter {...props} />
        )
      ) : (
        <div
          className={`chrono-notes-year-placeholder is-${props.heatmap ? "heatmap" : "summary"}`}
          aria-hidden="true"
        />
      )}
    </section>
  );
}

function SummaryQuarter({
  quarter,
  translator,
  monthLabels,
  showNoteIndicators,
  taskAnnotationMode,
  quarterNameMode,
  today,
  selection,
  onSelect,
  onOpenPeriodic,
  longPress,
}: LazyQuarterProps) {
  return (
    <div className="chrono-notes-year-summary-row">
      <PeriodButton
        summary={quarter.summary}
        label={formatYearQuarterLabel(
          quarter.quarter,
          quarterNameMode,
          translator.t,
        )}
        translator={translator}
        showNoteIndicators={showNoteIndicators}
        taskAnnotationMode={taskAnnotationMode}
        today={today}
        selected={isSelected(selection, "quarter", quarter.summary.date)}
        onSelect={onSelect}
        onOpenPeriodic={onOpenPeriodic}
        longPress={longPress}
      />
      {quarter.months.map((month) => (
        <PeriodButton
          key={month.month}
          summary={month.summary}
          label={monthLabels[month.month - 1] ?? ""}
          translator={translator}
          showNoteIndicators={showNoteIndicators}
          taskAnnotationMode={taskAnnotationMode}
          today={today}
          selected={isSelected(selection, "month", month.summary.date)}
          onSelect={onSelect}
          onOpenPeriodic={onOpenPeriodic}
          longPress={longPress}
        />
      ))}
    </div>
  );
}

function PeriodButton({
  summary,
  label,
  translator,
  showNoteIndicators,
  taskAnnotationMode,
  today,
  selected,
  onSelect,
  onOpenPeriodic,
  longPress,
}: Readonly<{
  summary: YearPeriodicSummary;
  label: string;
  translator: Translator;
  showNoteIndicators: boolean;
  taskAnnotationMode: TodoAnnotationMode;
  today: LocalDate;
  selected: boolean;
  onSelect: YearViewProps["onSelect"];
  onOpenPeriodic: YearViewProps["onOpenPeriodic"];
  longPress: LongPressGesture;
}>) {
  const accessibleLabel = formatYearPeriodLabel(
    label,
    summary.noteState,
    summary.errorMessage,
    summary.statistics,
    translator.t,
  );
  const kind = summary.noteType === "monthly" ? "month" : "quarter";
  const current = isSamePeriod(today, summary.date, summary.noteType, "monday");
  const select = () => onSelect(kind, summary.date);
  const open = (target: NoteOpenTarget) =>
    onOpenPeriodic(summary.date, summary.noteType, target);
  const touch = bindLongPress(longPress, () => void open("default"));
  const showStatus =
    showNoteIndicators && summary.noteState !== "not-configured";
  return (
    <button
      type="button"
      className={`chrono-notes-year-period${current ? " is-current-period" : ""}${selected ? " is-selected" : ""}`}
      data-period-kind={kind}
      data-period-month={summary.date.month}
      data-note-state={summary.noteState}
      data-show-note-indicators={String(showNoteIndicators)}
      aria-label={accessibleLabel}
      aria-current={current ? "true" : undefined}
      aria-pressed={selected}
      title={accessibleLabel}
      onClick={(event) => {
        if (touch.consumeClick()) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        select();
        if (event.ctrlKey || event.metaKey) void open("tab");
      }}
      onDoubleClick={() => void open("default")}
      onAuxClick={(event) => {
        if (event.button === 1) void open("tab");
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        select();
        void open("default");
      }}
      onTouchStart={touch.onTouchStart}
      onTouchMove={touch.onTouchMove}
      onTouchEnd={touch.onTouchEnd}
      onTouchCancel={touch.onTouchCancel}
    >
      {showStatus ? (
        <span className="chrono-notes-year-period-status">
          <CalendarNoteIndicator
            show
            noteState={summary.noteState}
            statistics={summary.statistics}
            taskAnnotationMode={taskAnnotationMode}
          />
        </span>
      ) : null}
      <span className="chrono-notes-year-period-label">{label}</span>
    </button>
  );
}

function HeatmapQuarter(props: LazyQuarterProps) {
  const {
    quarter,
    translator,
    monthLabels,
    taskAnnotationMode,
    quarterNameMode,
    today,
    selection,
    dayButtons,
    onSelect,
    onOpenPeriodic,
    onOpenDateContextMenu,
    onMoveDay,
    onSchedulePreview,
    onDismissPreview,
    previewId,
    activePreviewKey,
    hasRenderedDaySelection,
    longPress,
  } = props;
  return (
    <div className="chrono-notes-year-heatmap-quarter">
      <PeriodButton
        summary={quarter.summary}
        label={formatYearQuarterLabel(
          quarter.quarter,
          quarterNameMode,
          translator.t,
        )}
        translator={translator}
        showNoteIndicators={false}
        taskAnnotationMode={taskAnnotationMode}
        today={today}
        selected={isSelected(selection, "quarter", quarter.summary.date)}
        onSelect={onSelect}
        onOpenPeriodic={onOpenPeriodic}
        longPress={longPress}
      />
      <div className="chrono-notes-year-heatmap-months">
        {quarter.months.map((month) => (
          <div className="chrono-notes-year-heatmap-month" key={month.month}>
            <PeriodButton
              summary={month.summary}
              label={monthLabels[month.month - 1] ?? ""}
              translator={translator}
              showNoteIndicators={false}
              taskAnnotationMode={taskAnnotationMode}
              today={today}
              selected={isSelected(selection, "month", month.summary.date)}
              onSelect={onSelect}
              onOpenPeriodic={onOpenPeriodic}
              longPress={longPress}
            />
            <div
              className="chrono-notes-year-heatmap-grid"
              role="grid"
              aria-rowcount={7}
              aria-colcount={Math.ceil(month.heatmapCells.length / 7)}
              aria-label={formatYearHeatmapGridLabel(
                monthLabels[month.month - 1] ?? "",
                translator.t,
              )}
            >
              {Array.from({ length: 7 }, (_, rowIndex) => (
                <div
                  className="chrono-notes-year-heatmap-row"
                  role="row"
                  key={rowIndex}
                >
                  {month.heatmapCells.map((cell, index) => {
                    if (index % 7 !== rowIndex) return null;
                    const gridColumn = Math.floor(index / 7) + 1;
                    return cell === null ? (
                      <span
                        className="chrono-notes-year-heatmap-gap"
                        aria-hidden="true"
                        key={`gap-${index}`}
                        style={{ gridColumn, gridRow: rowIndex + 1 }}
                      />
                    ) : (
                      <HeatmapDayButton
                        key={formatLocalDateKey(cell.date)}
                        cell={cell}
                        translator={translator}
                        isToday={isSameLocalDate(today, cell.date)}
                        selected={isSelected(selection, "day", cell.date)}
                        fallbackTabStop={
                          cell.date.month === 1 && cell.date.day === 1
                        }
                        hasDaySelection={hasRenderedDaySelection}
                        gridColumn={gridColumn}
                        gridRow={rowIndex + 1}
                        dayButtons={dayButtons}
                        onSelect={onSelect}
                        onOpenPeriodic={onOpenPeriodic}
                        onOpenDateContextMenu={onOpenDateContextMenu}
                        onMoveDay={onMoveDay}
                        onSchedulePreview={onSchedulePreview}
                        onDismissPreview={onDismissPreview}
                        previewId={previewId}
                        previewActive={
                          activePreviewKey === formatLocalDateKey(cell.date)
                        }
                        longPress={longPress}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeatmapDayButton({
  cell,
  translator,
  isToday,
  selected,
  fallbackTabStop,
  hasDaySelection,
  gridColumn,
  gridRow,
  dayButtons,
  onSelect,
  onOpenPeriodic,
  onOpenDateContextMenu,
  onMoveDay,
  onSchedulePreview,
  onDismissPreview,
  previewId,
  previewActive,
  longPress,
}: Readonly<{
  cell: YearHeatmapDay;
  translator: Translator;
  isToday: boolean;
  selected: boolean;
  fallbackTabStop: boolean;
  hasDaySelection: boolean;
  gridColumn: number;
  gridRow: number;
  dayButtons: MutableRefObject<Map<string, HTMLButtonElement>>;
  onSelect: YearViewProps["onSelect"];
  onOpenPeriodic: YearViewProps["onOpenPeriodic"];
  onOpenDateContextMenu: YearViewProps["onOpenDateContextMenu"];
  onMoveDay: (event: KeyboardEvent<HTMLButtonElement>, date: LocalDate) => void;
  onSchedulePreview: LazyQuarterProps["onSchedulePreview"];
  onDismissPreview: () => void;
  previewId: string;
  previewActive: boolean;
  longPress: LongPressGesture;
}>) {
  const key = formatLocalDateKey(cell.date);
  const open = (target: NoteOpenTarget) =>
    onOpenPeriodic(cell.date, "daily", target);
  const touch = bindLongPress(
    longPress,
    () => void open("default"),
    { preferContextMenu: true },
  );
  return (
    <button
      ref={(element) => {
        if (element === null) dayButtons.current.delete(key);
        else dayButtons.current.set(key, element);
      }}
      type="button"
      role="gridcell"
      className={`chrono-notes-year-heatmap-day${isToday ? " is-current-period" : ""}${selected ? " is-selected" : ""}`}
      data-heatmap-level={cell.heatmap.level}
      style={{ gridColumn, gridRow }}
      aria-label={formatYearHeatmapDayLabel(key, cell, translator.t)}
      aria-current={isToday ? "date" : undefined}
      aria-selected={selected}
      aria-describedby={previewActive ? previewId : undefined}
      tabIndex={resolveYearHeatmapTabIndex(
        selected,
        fallbackTabStop,
        hasDaySelection,
      )}
      title={formatYearHeatmapDayLabel(key, cell, translator.t)}
      onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
        if (touch.consumeClick()) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onSelect("day", cell.date);
        if (event.ctrlKey || event.metaKey) void open("tab");
      }}
      onDoubleClick={() => void open("default")}
      onAuxClick={(event) => {
        if (event.button === 1) void open("tab");
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void open("default");
          return;
        }
        onMoveDay(event, cell.date);
      }}
      onContextMenu={(event) => {
        touch.onContextMenu();
        event.preventDefault();
        event.stopPropagation();
        onDismissPreview();
        onSelect("day", cell.date);
        onOpenDateContextMenu(
          cell.date,
          cell.noteState !== "not-configured",
          hasIndexedPeriodicNote(cell.noteState),
          event.nativeEvent,
        );
      }}
      onMouseEnter={(event) =>
        onSchedulePreview(key, cell, event.currentTarget)
      }
      onMouseLeave={onDismissPreview}
      onFocus={(event) => onSchedulePreview(key, cell, event.currentTarget)}
      onBlur={onDismissPreview}
      onTouchStart={() => {
        onDismissPreview();
        touch.onTouchStart();
      }}
      onTouchMove={touch.onTouchMove}
      onTouchEnd={touch.onTouchEnd}
      onTouchCancel={touch.onTouchCancel}
    />
  );
}

function isSelected(
  selection: YearViewProps["selection"],
  kind: CalendarSelectionKind,
  date: LocalDate,
): boolean {
  if (selection.kind !== kind || selection.date.year !== date.year)
    return false;
  if (kind === "quarter") {
    return (
      Math.floor((selection.date.month - 1) / 3) ===
      Math.floor((date.month - 1) / 3)
    );
  }
  if (selection.date.month !== date.month) return false;
  return kind !== "day" || selection.date.day === date.day;
}
