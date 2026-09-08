import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flame,
} from "lucide-react";

import {
  getCalendarWeek,
  getCalendarWeekIdentity,
  moveDateToCalendarWeek,
  moveDateToCalendarWeekYear,
} from "../../core/periodic/calendar-week";
import {
  getPeriodAnchor,
  getCenturyNumber,
  shiftPeriod,
  type LocalDate,
  type PeriodicNoteType,
} from "../../core/periodic/periodic-date";
import type { StatisticDisplayDimension } from "../../core/statistics/heatmap";
import type { NoteTask } from "../../core/note/note-tasks";
import { normalizeIntervalNoteFolder } from "../../core/note/interval-note-spec";
import { CalendarDecorationCache } from "../../features/calendar/calendar-decoration-cache";
import {
  CalendarQueryStore,
  type CalendarQueryRequest,
  type MonthCalendarQueryRequest,
  type WeekCalendarQueryRequest,
  type YearCalendarQueryRequest,
  type CenturyCalendarQueryRequest,
} from "../../features/calendar/calendar-query-store";
import type { IcsEventIndex } from "../../features/calendar/ics-event-index";
import type { NoteIndex } from "../../features/notes/note-index";
import type { NoteOpenTarget } from "../../features/periodic/periodic-note-commands";
import type { Translator } from "../../shared/i18n";
import { getCurrentLocalDate } from "../../shared/local-date-clock";
import type { ChronoNotesSettings } from "../../shared/settings";
import { getCalendarFontVariables } from "./calendar-font-size";
import { LongPressGesture } from "./long-press";
import { CalendarPreviewTooltip } from "./calendar-preview-tooltip";
import type { CalendarPreviewCell } from "./calendar-preview-tooltip";
import { YearView } from "./year-view";
import { getPeriodicSelectionKind, type CalendarSelectionKind } from "./calendar-selection";
import { WeekView } from "./week-view";
import { CalendarPeriodPickerPopover } from "./calendar-period-picker-popover";
import { CalendarCenturyPickerPopover } from "./calendar-century-picker-popover";
import { CalendarWeekPickerPopover } from "./calendar-week-picker-popover";
import {
  CalendarPickerLayer,
  type CalendarPickerModalHost,
} from "./calendar-picker-layer";
import { createWeekPickerLabelFormatter } from "./week-view-presentation";
import { useLocalToday } from "../use-local-today";
import { useCalendarPreview } from "./use-calendar-preview";
import { MonthView } from "./month-view";
import { CenturyView } from "./century-view";

import {
  formatNarrowWeekdayLabels,
  formatShortMonthLabel,
  formatShortMonthLabels,
} from "../date-presentation";
import { useHostEnvironment } from "../host-environment";

type CalendarViewMode = "week" | "month" | "year" | "century";
const CALENDAR_VIEW_MODES: readonly CalendarViewMode[] = ["week", "month", "year", "century"];
const PICKER_TITLES = {
  year: "calendar.chooseYear",
  month: "calendar.chooseMonth",
  "week-year": "calendar.chooseWeekYear",
  week: "calendar.chooseWeek",
  century: "calendar.picker.century.choose",
} as const;
type CalendarPickerKind = keyof typeof PICKER_TITLES;


export interface CalendarAppProps {
  readonly pickerModalHost?: CalendarPickerModalHost;
  readonly noteIndex: NoteIndex;
  readonly icsEventIndex: IcsEventIndex;
  readonly getSettings: () => ChronoNotesSettings;
  readonly getTranslator: () => Translator;
  readonly onOpenPeriodic: (
    date: LocalDate,
    noteType: PeriodicNoteType,
    target: NoteOpenTarget,
  ) => Promise<void>;
  readonly onSetYearHeatmap: (enabled: boolean) => Promise<void>;
  readonly onSetStatisticDimension: (
    dimension: StatisticDisplayDimension,
  ) => Promise<void>;
  readonly onOpenPath: (path: string, target: NoteOpenTarget) => Promise<void>;
  readonly onCreateRange: (
    initialDate: LocalDate,
    initialEndDate?: LocalDate,
  ) => void;
  readonly onToggleTask: (task: NoteTask) => Promise<void>;
  readonly onRescheduleTask: (
    task: NoteTask,
    nextDueDate: LocalDate,
  ) => Promise<void>;
  readonly onOpenTaskSource: (
    task: NoteTask,
    target: NoteOpenTarget,
  ) => Promise<void>;
  readonly onOpenDateContextMenu: (
    date: LocalDate,
    configured: boolean,
    noteExists: boolean | null,
    event: MouseEvent,
  ) => void;
  readonly navigationRequest: CalendarNavigationRequest | null;
}

export interface CalendarNavigationRequest {
  readonly revision: number;
  readonly date: LocalDate;
  readonly noteType: PeriodicNoteType;
  readonly mode: "jump" | "sync";
}

export function CalendarApp({
  pickerModalHost,
  noteIndex,
  icsEventIndex,
  getSettings,
  getTranslator,
  onOpenPeriodic,
  onSetYearHeatmap,
  onSetStatisticDimension,
  onOpenPath,
  onCreateRange,
  onToggleTask,
  onRescheduleTask,
  onOpenTaskSource,
  onOpenDateContextMenu,
  navigationRequest,
}: CalendarAppProps) {
  const host = useHostEnvironment();
  const today = useLocalToday();
  const [visibleMonth, setVisibleMonth] = useState(() => ({
    year: today.year,
    month: today.month,
  }));
  const [selected, setSelected] = useState<LocalDate>(today);
  const [selectionKind, setSelectionKind] =
    useState<CalendarSelectionKind>("day");
  const [monthSelectionRequest, setMonthSelectionRequest] = useState(0);
  const [centuryRevealRequest, setCenturyRevealRequest] = useState(() => ({ year: today.year, revision: 0 }));
  const revealCenturyYear = useCallback((year: number) => {
    setCenturyRevealRequest((request) => ({ year, revision: request.revision + 1 }));
  }, []);
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [monthHeatmapEnabled, setMonthHeatmapEnabled] = useState(false);
  const [openPeriodPicker, setOpenPeriodPicker] = useState<CalendarPickerKind | null>(null);
  const longPress = useMemo(
    () =>
      new LongPressGesture({
        setTimeout: (callback, delay) => host.window.setTimeout(callback, delay),
        clearTimeout: (handle) => host.window.clearTimeout(handle),
      }),
    [host.window],
  );
  const decorationCache = useMemo(() => new CalendarDecorationCache(), []);
  const periodPickerAnchor = useRef<HTMLDivElement>(null);
  const closePeriodPicker = useCallback(() => setOpenPeriodPicker(null), []);
  const jumpToDate = useCallback((date: LocalDate) => {
    setOpenPeriodPicker(null);
    setSelected(date);
    setSelectionKind("day");
    setVisibleMonth({ year: date.year, month: date.month });
    setViewMode("month");
  }, []);
  const settings = getSettings();
  const selectPeriodicNote = useCallback((
    date: LocalDate,
    noteType: PeriodicNoteType,
  ) => {
    const anchor = getPeriodAnchor(date, noteType, settings.weekStartDay);
    const selectionDate = noteType === "weekly"
      ? shiftPeriod(anchor, "daily", 3, settings.weekStartDay)
      : anchor;
    setOpenPeriodPicker(null);
    setSelected(selectionDate);
    setSelectionKind(getPeriodicSelectionKind(noteType));
    if (noteType === "decadal" || noteType === "century") setViewMode("century");
    revealCenturyYear(selectionDate.year);
    setVisibleMonth({
      year: selectionDate.year,
      month: selectionDate.month,
    });
  }, [revealCenturyYear, settings.weekStartDay]);
  const openPeriodic = useCallback((
    date: LocalDate,
    noteType: PeriodicNoteType,
    target: NoteOpenTarget,
  ) => {
    selectPeriodicNote(date, noteType);
    return onOpenPeriodic(date, noteType, target);
  }, [onOpenPeriodic, selectPeriodicNote]);
  const {
    activePreview,
    activePreviewKey,
    previewId,
    schedulePreview,
    dismissPreview,
    suppressPreviewFor,
  } = useCalendarPreview<CalendarPreviewCell>({
    enabled: settings.showHoverPreview,
    dismissOnDisable: true,
  });
  const calendarExtensionKey = settings.calendarExtensions.join("\u0000");
  const holidayRegionKey = settings.holidayRegions.join("\u0000");
  const rangeCreationConfigured =
    normalizeIntervalNoteFolder(settings.rangeNotes.folder).length > 0;
  const translator = useMemo(
    () => getTranslator(),
    [getTranslator, settings.locale],
  );
  const { locale, t } = translator;
  const monthQueryRequest = useMemo<MonthCalendarQueryRequest>(() =>
    Object.freeze({
      kind: "month",
      target: Object.freeze({ ...visibleMonth }),
      options: Object.freeze({
        locale,
        weekStartDay: settings.weekStartDay,
        calendarExtensions: Object.freeze([...settings.calendarExtensions]),
        holidayRegions: Object.freeze([...settings.holidayRegions]),
        heatmap: monthHeatmapEnabled
          ? Object.freeze({
              dimension: settings.statisticDisplayDimension,
              valueStep: settings.statisticValueStep,
            })
          : null,
        daily: Object.freeze({ ...settings.periodicNotes.daily }),
        weekly: Object.freeze({ ...settings.periodicNotes.weekly }),
        rangeNotes: Object.freeze({ ...settings.rangeNotes }),
        decorationCache,
      }),
    }),
    [
      locale,
      decorationCache,
      monthHeatmapEnabled,
      calendarExtensionKey,
      holidayRegionKey,
      settings.periodicNotes.daily.enabled,
      settings.periodicNotes.daily.pattern,
      settings.periodicNotes.weekly.enabled,
      settings.periodicNotes.weekly.pattern,
      settings.rangeNotes.customFolder,
      settings.rangeNotes.folder,
      settings.rangeNotes.monthViewLimit,
      settings.rangeNotes.scanScope,
      settings.rangeNotes.showInCalendar,
      settings.rangeNotes.weekViewLimit,
      settings.statisticDisplayDimension,
      settings.statisticValueStep,
      settings.weekStartDay,
      visibleMonth,
    ],
  );
  const weekQueryRequest = useMemo<WeekCalendarQueryRequest>(() =>
    Object.freeze({
      kind: "week",
      selectedDate: Object.freeze({ ...selected }),
      options: Object.freeze({
        locale,
        weekStartDay: settings.weekStartDay,
        today: Object.freeze({ ...today }),
        calendarExtensions: Object.freeze([...settings.calendarExtensions]),
        holidayRegions: Object.freeze([...settings.holidayRegions]),
        daily: Object.freeze({ ...settings.periodicNotes.daily }),
        weekly: Object.freeze({ ...settings.periodicNotes.weekly }),
        rangeNotes: Object.freeze({ ...settings.rangeNotes }),
        decorationCache,
      }),
    }), [
      locale,
      decorationCache,
      calendarExtensionKey,
      holidayRegionKey,
      selected,
      settings.periodicNotes.daily.enabled,
      settings.periodicNotes.daily.pattern,
      settings.periodicNotes.weekly.enabled,
      settings.periodicNotes.weekly.pattern,
      settings.rangeNotes.customFolder,
      settings.rangeNotes.folder,
      settings.rangeNotes.monthViewLimit,
      settings.rangeNotes.scanScope,
      settings.rangeNotes.showInCalendar,
      settings.rangeNotes.weekViewLimit,
      settings.weekStartDay,
      today,
    ]);
  const yearQueryRequest = useMemo<YearCalendarQueryRequest>(() =>
    Object.freeze({
      kind: "year",
      year: visibleMonth.year,
      heatmap: settings.yearViewHeatmap,
      options: Object.freeze({
        locale,
        weekStartDay: settings.weekStartDay,
        statisticDisplayDimension: settings.statisticDisplayDimension,
        statisticValueStep: settings.statisticValueStep,
        daily: Object.freeze({ ...settings.periodicNotes.daily }),
        monthly: Object.freeze({ ...settings.periodicNotes.monthly }),
        quarterly: Object.freeze({ ...settings.periodicNotes.quarterly }),
      }),
    }), [
      locale,
      settings.periodicNotes.daily.enabled,
      settings.periodicNotes.daily.pattern,
      settings.periodicNotes.monthly.enabled,
      settings.periodicNotes.monthly.pattern,
      settings.periodicNotes.quarterly.enabled,
      settings.periodicNotes.quarterly.pattern,
      settings.statisticDisplayDimension,
      settings.statisticValueStep,
      settings.weekStartDay,
      settings.yearViewHeatmap,
      visibleMonth.year,
    ]);
  const centuryQueryRequest = useMemo<CenturyCalendarQueryRequest>(() => ({
    kind: "century",
    year: Math.max(1, Math.min(9999, visibleMonth.year)),
    options: {
      locale, weekStartDay: settings.weekStartDay,
      yearly: { ...settings.periodicNotes.yearly },
      decadal: { ...settings.periodicNotes.decadal },
      century: { ...settings.periodicNotes.century },
    },
  }), [locale, settings.weekStartDay, visibleMonth.year,
    settings.periodicNotes.yearly.enabled, settings.periodicNotes.yearly.pattern,
    settings.periodicNotes.decadal.enabled, settings.periodicNotes.decadal.pattern,
    settings.periodicNotes.century.enabled, settings.periodicNotes.century.pattern]);
  const queryRequest: CalendarQueryRequest = viewMode === "century"
    ? centuryQueryRequest : viewMode === "week"
    ? weekQueryRequest
    : viewMode === "year"
      ? yearQueryRequest
      : monthQueryRequest;
  const queryStore = useMemo(
    () => new CalendarQueryStore(noteIndex, icsEventIndex, queryRequest),
    [icsEventIndex, noteIndex, queryRequest],
  );
  const querySnapshot = useSyncExternalStore(
    queryStore.subscribe,
    queryStore.getSnapshot,
    queryStore.getSnapshot,
  );
  const monthQuery = querySnapshot.kind === "month" ? querySnapshot.query : null;
  const weekQuery = querySnapshot.kind === "week" ? querySnapshot.query : null;
  const yearQuery = querySnapshot.kind === "year" ? querySnapshot.query : null;
  const centuryQuery = querySnapshot.kind === "century" ? querySnapshot.query : null;
  const selectedWeekIdentity = useMemo(
    () => getCalendarWeekIdentity(selected, settings.weekStartDay),
    [selected, settings.weekStartDay],
  );
  const headerWeek = useMemo(
    () => {
      if (weekQuery !== null) {
        return Object.freeze({
          start: weekQuery.weekStart,
          end: weekQuery.weekEnd,
          weekNumber: weekQuery.weekNumber,
          weekYear: weekQuery.weekYear,
        });
      }
      return getCalendarWeek(
        selectedWeekIdentity.weekYear,
        selectedWeekIdentity.weekNumber,
        settings.weekStartDay,
      );
    },
    [selectedWeekIdentity, settings.weekStartDay, weekQuery],
  );
  const formatWeekPickerLabels = useMemo(
    () => createWeekPickerLabelFormatter(translator),
    [translator],
  );
  const weekPickerLabels = useMemo(
    () => formatWeekPickerLabels(
      headerWeek.start,
      headerWeek.end,
      headerWeek.weekNumber,
      headerWeek.weekYear,
    ),
    [formatWeekPickerLabels, headerWeek],
  );
  const activeQuery = monthQuery ?? weekQuery ?? yearQuery ?? centuryQuery;
  const weekdayLabels = useMemo(
    () => formatNarrowWeekdayLabels(locale, settings.weekStartDay),
    [locale, settings.weekStartDay],
  );
  useEffect(() => () => longPress.dispose(), [longPress]);
  useEffect(() => {
    const cancelLongPress = () => longPress.cancel();
    const cancelHiddenLongPress = () => {
      if (host.document.visibilityState === "hidden") cancelLongPress();
    };
    host.window.addEventListener("blur", cancelLongPress);
    host.document.addEventListener("visibilitychange", cancelHiddenLongPress);
    return () => {
      host.window.removeEventListener("blur", cancelLongPress);
      host.document.removeEventListener("visibilitychange", cancelHiddenLongPress);
    };
  }, [host.document, host.window, longPress]);
  useEffect(() => () => decorationCache.clear(), [decorationCache]);
  useEffect(() => () => queryStore.dispose(), [queryStore]);
  useEffect(() => {
    longPress.cancel();
    setOpenPeriodPicker(null);
  }, [longPress, viewMode]);
  useEffect(() => {
    if (navigationRequest === null) return;
    if (navigationRequest.mode === "jump" && navigationRequest.noteType !== "decadal" &&
      navigationRequest.noteType !== "century") jumpToDate(navigationRequest.date);
    else selectPeriodicNote(navigationRequest.date, navigationRequest.noteType);
  }, [jumpToDate, navigationRequest, selectPeriodicNote]);
  useEffect(() => {
    dismissPreview();
  }, [activeQuery, dismissPreview]);
  useEffect(() => {
    dismissPreview();
  }, [dismissPreview, viewMode]);

  const showPeriod = useCallback(
    (amount: number) => {
      setOpenPeriodPicker(null);
      if (viewMode === "week") {
        const next = shiftPeriod(
          selected,
          "daily",
          amount * 7,
          settings.weekStartDay,
        );
        setSelected(next);
        setSelectionKind("day");
        setVisibleMonth({ year: next.year, month: next.month });
        return;
      }
      const next = shiftPeriod(
        { year: visibleMonth.year, month: visibleMonth.month, day: 1 },
        viewMode === "century" ? "century" : viewMode === "year" ? "yearly" : "monthly",
        amount,
        "monday",
      );
      if (next.year < 1 || next.year > 9999) return;
      setVisibleMonth({ year: next.year, month: next.month });
      if (viewMode === "century") revealCenturyYear(next.year);
    },
    [revealCenturyYear, selected, settings.weekStartDay, viewMode, visibleMonth],
  );

  const showToday = useCallback(() => {
    setOpenPeriodPicker(null);
    const current = getCurrentLocalDate();
    if (viewMode === "year") {
      setMonthSelectionRequest((request) => request + 1);
    }
    if (viewMode === "century") revealCenturyYear(current.year);
    setSelected(viewMode === "year"
      ? { year: current.year, month: current.month, day: 1 }
      : current);
    setSelectionKind(viewMode === "year" ? "month" : "day");
    setVisibleMonth({ year: current.year, month: current.month });
  }, [revealCenturyYear, viewMode]);
  const selectWeekYear = useCallback((weekYear: number) => {
    const next = moveDateToCalendarWeekYear(
      selected,
      weekYear,
      settings.weekStartDay,
    );
    setSelected(next);
    setSelectionKind("day");
    setVisibleMonth({ year: next.year, month: next.month });
  }, [selected, settings.weekStartDay]);
  const selectWeek = useCallback((weekNumber: number) => {
    const next = moveDateToCalendarWeek(
      selected,
      headerWeek.weekYear,
      weekNumber,
      settings.weekStartDay,
    );
    setSelected(next);
    setSelectionKind("day");
    setVisibleMonth({ year: next.year, month: next.month });
  }, [headerWeek.weekYear, selected, settings.weekStartDay]);
  const selectMonthItem = useCallback(
    (kind: CalendarSelectionKind, date: LocalDate) => {
      setSelected(date);
      setSelectionKind(kind);
    },
    [],
  );
  const moveMonthSelection = useCallback((date: LocalDate) => {
    setSelected(date);
    setSelectionKind("day");
    setVisibleMonth({ year: date.year, month: date.month });
  }, []);

  const heatmapEnabled =
    viewMode === "year"
      ? settings.yearViewHeatmap
      : viewMode === "month"
        ? monthHeatmapEnabled
        : false;
  const periodLabel = t(`calendar.period.${viewMode}`);
  const primaryPickerKind = viewMode === "week" ? "week-year"
    : viewMode === "century" ? "century" : "year";
  const headerPeriodSelected = selectionKind === (primaryPickerKind === "week-year" ? "year" : primaryPickerKind) && (centuryQuery !== null
    ? selected.year >= centuryQuery.range.start.year && selected.year <= centuryQuery.range.end.year
    : selected.year === (viewMode === "week" ? headerWeek.weekYear : visibleMonth.year));
  const heatmapPeriodLabel =
    viewMode === "year"
      ? t("calendar.heatmap.period.year")
      : viewMode === "week"
        ? t("calendar.heatmap.period.week")
        : t("calendar.heatmap.period.month");
  const selectedPickerQuarter =
    selectionKind === "quarter" && selected.year === visibleMonth.year
      ? Math.floor((selected.month - 1) / 3) + 1
      : null;
  const fontVariables = getCalendarFontVariables(
    settings.fontSizeMode,
    settings.immutableFontSizeFactor,
  );
  const thisMonthActionLabel = t("calendar.selectThisMonth", {
    year: today.year,
    month: formatShortMonthLabel(today.year, today.month, locale),
  });
  const monthTriggerLabels = useMemo(
    () => formatShortMonthLabels(visibleMonth.year, locale),
    [locale, visibleMonth.year],
  );
  const calendarLabelId = `${previewId}-calendar-label`;

  return (
    <div
      className="chrono-notes-calendar"
      role="region"
      dir={translator.direction}
      data-font-size-mode={settings.fontSizeMode}
      style={fontVariables}
      aria-labelledby={calendarLabelId}
    >
      <span
        id={calendarLabelId}
        className="chrono-notes-visually-hidden"
      >
        {t("calendar.ariaLabel")}
      </span>
      <header className="chrono-notes-calendar-header">
        <div className="chrono-notes-calendar-navigation">
          <button
            type="button"
            aria-label={t("calendar.previous", { period: periodLabel })}
            disabled={centuryQuery !== null && centuryQuery.range.start.year <= 1}
            onClick={() => showPeriod(-1)}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <div
            ref={periodPickerAnchor}
            className="chrono-notes-calendar-period-anchor"
          >
            <button
              type="button"
              className={`chrono-notes-calendar-picker-trigger${
                headerPeriodSelected
                  ? " is-selected"
                  : ""
              }`}
              aria-label={viewMode === "week"
                ? `${t("calendar.chooseWeekYear")}: ${headerWeek.weekYear}`
                : t(PICKER_TITLES[primaryPickerKind])}
              aria-expanded={openPeriodPicker === primaryPickerKind}
              aria-pressed={headerPeriodSelected}
              onClick={() => {
                setOpenPeriodPicker((current) => current === primaryPickerKind ? null : primaryPickerKind);
              }}
            >
              <span>
                {centuryQuery !== null
                  ? `C${getCenturyNumber(centuryQuery.range.start.year)} · ${centuryQuery.range.start.year}–${centuryQuery.range.end.year}`
                  : viewMode === "week" ? headerWeek.weekYear : visibleMonth.year}
              </span>
              <ChevronDown size={13} aria-hidden="true" />
            </button>
            {viewMode === "month" ? (
              <button
                type="button"
                className={`chrono-notes-calendar-picker-trigger is-month${
                  selectionKind === "month" &&
                  selected.year === visibleMonth.year &&
                  selected.month === visibleMonth.month
                    ? " is-selected"
                    : ""
                }`}
                aria-label={t("calendar.chooseMonth")}
                aria-expanded={openPeriodPicker === "month"}
                aria-pressed={selectionKind === "month"}
                onClick={() =>
                  setOpenPeriodPicker((current) =>
                    current === "month" ? null : "month",
                  )
                }
              >
                <span
                  className="chrono-notes-calendar-month-label-stack"
                  aria-hidden="true"
                >
                  {monthTriggerLabels.map((label, index) => (
                    <span
                      className={index + 1 === visibleMonth.month
                        ? "is-visible"
                        : undefined}
                      key={index}
                    >
                      {label}
                    </span>
                  ))}
                </span>
                <ChevronDown size={13} aria-hidden="true" />
              </button>
            ) : viewMode === "week" ? (
              <button
                type="button"
                className={`chrono-notes-calendar-picker-trigger${
                  selectionKind === "week" ? " is-selected" : ""
                }`}
                aria-label={`${t("calendar.chooseWeek")}: ${weekPickerLabels.accessible}`}
                aria-expanded={openPeriodPicker === "week"}
                aria-pressed={selectionKind === "week"}
                title={weekPickerLabels.accessible}
                onClick={() =>
                  setOpenPeriodPicker((current) =>
                    current === "week" ? null : "week",
                  )
                }
              >
                <span>{weekPickerLabels.trigger}</span>
                <ChevronDown size={13} aria-hidden="true" />
              </button>
            ) : null}
            {openPeriodPicker !== null ? (
              <CalendarPickerLayer modalHost={pickerModalHost}
                title={t(PICKER_TITLES[openPeriodPicker])} onClose={closePeriodPicker}>
                {openPeriodPicker === "week-year" || openPeriodPicker === "week" ? (
                  <CalendarWeekPickerPopover
                    key={openPeriodPicker}
                    kind={openPeriodPicker === "week-year" ? "year" : "week"}
                    weekYear={headerWeek.weekYear}
                    weekNumber={headerWeek.weekNumber}
                    weekStartDay={settings.weekStartDay}
                    today={today}
                    anchorRef={periodPickerAnchor}
                    translator={translator}
                    onSelectWeekYear={selectWeekYear}
                    onSelectWeek={selectWeek}
                    onClose={closePeriodPicker}
                  />
                ) : openPeriodPicker === "century" ? (
                  <CalendarCenturyPickerPopover
                    year={visibleMonth.year} currentYear={today.year} translator={translator}
                    anchorRef={periodPickerAnchor} onClose={closePeriodPicker}
                    onSelect={(year) => {
                      setVisibleMonth({ year, month: 1 });
                      setSelected({ year, month: 1, day: 1 });
                      setSelectionKind(openPeriodPicker);
                      revealCenturyYear(year);
                    }} />
                ) : (
                  <CalendarPeriodPickerPopover
                    key={openPeriodPicker}
                    kind={openPeriodPicker}
                    year={visibleMonth.year}
                    month={visibleMonth.month}
                    today={today}
                    selectedQuarter={selectedPickerQuarter}
                    quarterNameMode={settings.quarterNameMode}
                    anchorRef={periodPickerAnchor}
                    translator={translator}
                    onSelectYear={(year) => {
                      setVisibleMonth((current) => ({ ...current, year }));
                      setSelected((current) => ({
                        year,
                        month: current.month,
                        day: 1,
                      }));
                      setSelectionKind("day");
                    }}
                    onSelectMonth={(month) => {
                      setVisibleMonth((current) => ({ ...current, month }));
                      setSelected({ year: visibleMonth.year, month, day: 1 });
                      setSelectionKind("day");
                    }}
                    onSelectQuarter={(quarter) => {
                      setSelected({
                        year: visibleMonth.year,
                        month: (quarter - 1) * 3 + 1,
                        day: 1,
                      });
                      setSelectionKind("quarter");
                    }}
                    onOpenPeriodic={openPeriodic}
                    onClose={closePeriodPicker}
                  />
                )}
              </CalendarPickerLayer>
            ) : null}
          </div>
          <button
            type="button"
            aria-label={t("calendar.next", { period: periodLabel })}
            disabled={centuryQuery !== null && centuryQuery.range.end.year >= 9999}
            onClick={() => showPeriod(1)}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          className="chrono-notes-today"
          aria-label={viewMode === "year"
            ? thisMonthActionLabel
            : undefined}
          title={viewMode === "year"
            ? thisMonthActionLabel
            : undefined}
          onClick={showToday}
        >
          {t(viewMode === "century" ? "calendar.long.thisCentury"
            : viewMode === "year" ? "calendar.thisMonth" : "calendar.today")}
        </button>
      </header>
      <div
        className="chrono-notes-calendar-toolbar"
        data-view-mode={viewMode}
        role="toolbar"
        aria-label={t("calendar.toolbar")}
      >
        <div
          className="chrono-notes-view-mode"
          role="group"
          aria-label={t("calendar.view.label")}
        >
          {CALENDAR_VIEW_MODES.map((mode) => (
            <button key={mode} type="button" className={viewMode === mode ? "is-active" : ""}
              aria-pressed={viewMode === mode} onClick={() => {
                setOpenPeriodPicker(null);
                if (mode === "century") revealCenturyYear(selected.year);
                if (mode === "century" || viewMode === "century") {
                  setVisibleMonth({ year: Math.max(1, selected.year), month: selected.month });
                  if (mode === "year" || mode === "month" || mode === "week") {
                    setSelectionKind(mode === "year" ? "year" : "day");
                  }
                }
                setViewMode(mode);
              }}>
              {t(`calendar.view.${mode}`)}
            </button>
          ))}
        </div>
        {viewMode !== "month" && viewMode !== "year" ? null : (
          <div
            className="chrono-notes-heatmap-tools"
            data-view-mode={viewMode}
          >
            {heatmapEnabled ? (
              <>
                <label className="chrono-notes-heatmap-dimension">
                  <span className="chrono-notes-visually-hidden">
                    {t("calendar.heatmap.statistic")}
                  </span>
                  <select
                    aria-label={t("calendar.heatmap.statistic")}
                    value={settings.statisticDisplayDimension}
                    onChange={(event) =>
                      void onSetStatisticDimension(
                        event.currentTarget.value as StatisticDisplayDimension,
                      )
                    }
                  >
                    <option value="word-count">
                      {t("calendar.statistic.words")}
                    </option>
                    <option value="link-count">
                      {t("calendar.statistic.links")}
                    </option>
                    <option value="tag-count">
                      {t("calendar.statistic.tags")}
                    </option>
                    <option value="task-completion-rate">
                      {t("calendar.statistic.tasks")}
                    </option>
                  </select>
                </label>
                <div
                  className="chrono-notes-heatmap-legend"
                  aria-label={t("calendar.heatmap.legend")}
                >
                  {Array.from({ length: 5 }, (_, level) => (
                    <span
                      key={level}
                      data-heatmap-level={level}
                      title={t("calendar.heatmap.level", { level })}
                    />
                  ))}
                </div>
              </>
            ) : null}
            <button
              type="button"
              className={`chrono-notes-heatmap-toggle${heatmapEnabled ? " is-active" : ""}`}
              aria-label={t("calendar.heatmap.toggle", {
                period: heatmapPeriodLabel,
              })}
              aria-pressed={heatmapEnabled}
              title={t("calendar.heatmap.toggle", {
                period: heatmapPeriodLabel,
              })}
              onClick={() => {
                if (viewMode === "year")
                  void onSetYearHeatmap(!settings.yearViewHeatmap);
                else setMonthHeatmapEnabled((enabled) => !enabled);
              }}
            >
              <Flame size={16} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      {centuryQuery !== null ? (
        <CenturyView query={centuryQuery} translator={translator} today={today}
          revealRequest={centuryRevealRequest}
          selection={{ kind: selectionKind, date: selected }} onOpenPeriodic={onOpenPeriodic}
          showNoteIndicators={settings.showNoteIndicators} showTaskProgress={settings.showTaskProgress}
          weekStartDay={settings.weekStartDay} longPress={longPress}
          activePreviewKey={activePreviewKey} previewId={previewId}
          onSchedulePreview={schedulePreview} onDismissPreview={dismissPreview}
          onSelect={(kind, date) => {
            setSelectionKind(kind);
            setSelected({ ...date, year: Math.max(1, date.year) });
          }} />
      ) : yearQuery !== null ? (
        <YearView
          query={yearQuery}
          translator={translator}
          today={today}
          heatmap={settings.yearViewHeatmap}
          showHoverPreview={settings.showHoverPreview}
          showNoteIndicators={settings.showNoteIndicators}
          showTaskProgress={settings.showTaskProgress}
          quarterNameMode={settings.quarterNameMode}
          weekStartDay={settings.weekStartDay}
          selection={{ kind: selectionKind, date: selected }}
          monthSelectionRequest={monthSelectionRequest}
          onSelect={(kind, date) => {
            setSelectionKind(kind);
            setSelected(date);
            setVisibleMonth({ year: date.year, month: date.month });
          }}
          onOpenPeriodic={openPeriodic}
          onOpenDateContextMenu={onOpenDateContextMenu}
          longPress={longPress}
        />
      ) : weekQuery !== null ? (
        <WeekView
          query={weekQuery}
          translator={translator}
          selectionKind={selectionKind}
          selectedDate={selected}
          today={today}
          weekStartDay={settings.weekStartDay}
          showNoteIndicators={settings.showNoteIndicators}
          showTaskProgress={settings.showTaskProgress}
          activePreviewKey={activePreviewKey}
          previewId={previewId}
          onSelectDate={(date) => {
            setSelected(date);
            setSelectionKind("day");
            setVisibleMonth({ year: date.year, month: date.month });
          }}
          onOpenPeriodic={openPeriodic}
          onOpenPath={onOpenPath}
          onCreateRange={onCreateRange}
          onToggleTask={onToggleTask}
          onRescheduleTask={onRescheduleTask}
          onOpenTaskSource={onOpenTaskSource}
          onSchedulePreview={schedulePreview}
          onDismissPreview={dismissPreview}
          onOpenDateContextMenu={onOpenDateContextMenu}
          longPress={longPress}
        />
      ) : monthQuery !== null ? (
        <MonthView
          query={monthQuery}
          translator={translator}
          today={today}
          weekdayLabels={weekdayLabels}
          selection={{ kind: selectionKind, date: selected }}
          weekStartDay={settings.weekStartDay}
          heatmapEnabled={heatmapEnabled}
          showNoteIndicators={settings.showNoteIndicators}
          showTaskProgress={settings.showTaskProgress}
          rangeCreationConfigured={rangeCreationConfigured}
          longPress={longPress}
          preview={{
            activeKey: activePreviewKey,
            id: previewId,
            schedule: schedulePreview,
            dismiss: dismissPreview,
            suppressFor: suppressPreviewFor,
          }}
          onSelect={selectMonthItem}
          onMoveSelection={moveMonthSelection}
          onOpenPeriodic={openPeriodic}
          onOpenPath={onOpenPath}
          onCreateRange={onCreateRange}
          onOpenDateContextMenu={onOpenDateContextMenu}
        />
      ) : null}
      {activePreview === null ? null : (
        <CalendarPreviewTooltip
          id={previewId}
          preview={activePreview}
          translator={translator}
        />
      )}
    </div>
  );
}
