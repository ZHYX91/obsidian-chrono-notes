import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Modal, type App } from "obsidian";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot, type Root } from "react-dom/client";

import {
  formatLocalDateKey,
  isSameLocalDate,
  type LocalDate,
  type WeekStartDay,
} from "../../core/periodic/periodic-date";
import {
  createDatePickerModel,
  shiftPickerMonth,
  shiftPickerYear,
  type CalendarMonth,
} from "../../features/calendar/date-picker";
import type { Translator } from "../../shared/i18n";
import { moveCalendarSelection } from "../calendar/calendar-interaction";
import {
  CalendarPickerLayer,
  type CalendarPickerModalHost,
} from "../calendar/calendar-picker-layer";
import {
  formatNarrowWeekdayLabels,
  formatShortMonthLabels,
} from "../date-presentation";
import { getDateModalMessages } from "./date-modal-presentation";
import { createCalendarPickerModalHost } from "./calendar-picker-modal-host";

export interface MiniCalendarModalOptions {
  readonly initialDate: LocalDate;
  readonly today: LocalDate;
  readonly weekStartDay: WeekStartDay;
  readonly translator: Translator;
  readonly onSelect: (date: LocalDate) => void | Promise<void>;
}

export class MiniCalendarModal extends Modal {
  private root: Root | null = null;
  private readonly pickerModalHost: CalendarPickerModalHost;

  constructor(app: App, private readonly options: MiniCalendarModalOptions) {
    super(app);
    this.pickerModalHost = createCalendarPickerModalHost(this.app);
  }

  override onOpen(): void {
    this.titleEl.setText(getDateModalMessages(this.options.translator.t).chooseDate);
    this.modalEl.addClass("chrono-notes-mini-calendar-modal-container");
    this.contentEl.empty();
    const mount = this.contentEl.createDiv();
    this.root = createRoot(mount);
    this.root.render(
      <MiniCalendar
        {...this.options}
        pickerModalHost={this.pickerModalHost}
        onClose={() => this.close()}
      />,
    );
  }

  override onClose(): void {
    this.root?.unmount();
    this.root = null;
    this.contentEl.empty();
  }
}

interface MiniCalendarProps extends MiniCalendarModalOptions {
  readonly pickerModalHost: CalendarPickerModalHost;
  readonly onClose: () => void;
}

function MiniCalendar({
  initialDate,
  today,
  weekStartDay,
  translator,
  onSelect,
  onClose,
  pickerModalHost,
}: MiniCalendarProps) {
  const { locale, t } = translator;
  const messages = getDateModalMessages(t);
  const [displayMonth, setDisplayMonth] = useState<CalendarMonth>(() => ({
    year: initialDate.year,
    month: initialDate.month,
  }));
  const [focusedDate, setFocusedDate] = useState(initialDate);
  const [isSelecting, setIsSelecting] = useState(false);
  const [periodPickerOpen, setPeriodPickerOpen] = useState(false);
  const selecting = useRef(false);
  const focusAfterMove = useRef(false);
  const dayButtons = useRef(new Map<string, HTMLButtonElement>());
  const monthButtons = useRef(new Map<number, HTMLButtonElement>());
  const periodTrigger = useRef<HTMLButtonElement>(null);
  const periodPickerId = useId();
  const model = useMemo(
    () => createDatePickerModel(initialDate, displayMonth, weekStartDay),
    [displayMonth, initialDate, weekStartDay],
  );
  const weekdayLabels = useMemo(
    () => formatNarrowWeekdayLabels(locale, weekStartDay),
    [locale, weekStartDay],
  );
  const monthLabels = useMemo(
    () => formatShortMonthLabels(displayMonth.year, locale),
    [displayMonth.year, locale],
  );

  useEffect(() => {
    const key = formatLocalDateKey(focusedDate);
    if (
      !focusAfterMove.current &&
      !isSameLocalDate(focusedDate, initialDate)
    ) return;
    focusAfterMove.current = false;
    const handle = window.setTimeout(
      () => dayButtons.current.get(key)?.focus(),
      0,
    );
    return () => window.clearTimeout(handle);
  }, [focusedDate, initialDate, model.grid]);

  useEffect(() => {
    if (!periodPickerOpen) return;
    const handle = window.setTimeout(
      () => monthButtons.current.get(displayMonth.month)?.focus(),
      0,
    );
    return () => window.clearTimeout(handle);
  }, [displayMonth.month, periodPickerOpen]);

  const selectDate = useCallback(
    async (date: LocalDate) => {
      if (selecting.current) return;
      selecting.current = true;
      setIsSelecting(true);
      try {
        await onSelect(date);
        selecting.current = false;
        setIsSelecting(false);
        onClose();
      } catch (error) {
        selecting.current = false;
        setIsSelecting(false);
        throw error;
      }
    },
    [onClose, onSelect],
  );

  const moveFocus = useCallback((date: LocalDate, key: string) => {
    const next = moveCalendarSelection(date, key);
    if (next === date) return false;
    focusAfterMove.current = true;
    setFocusedDate(next);
    setDisplayMonth({ year: next.year, month: next.month });
    return true;
  }, []);

  const showMonth = useCallback(
    (month: CalendarMonth, focusDay = false) => {
      focusAfterMove.current = focusDay;
      setDisplayMonth(month);
      setFocusedDate(firstDateOfMonth(month));
    },
    [],
  );

  const closePeriodPicker = useCallback(() => {
    setPeriodPickerOpen(false);
    window.setTimeout(() => periodTrigger.current?.focus(), 0);
  }, []);
  const dayRows = Array.from(
    { length: Math.ceil(model.grid.days.length / 7) },
    (_, rowIndex) => model.grid.days.slice(rowIndex * 7, rowIndex * 7 + 7),
  );

  return (
    <div
      className="chrono-notes-mini-calendar"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !periodPickerOpen) return;
        event.preventDefault();
        event.stopPropagation();
        closePeriodPicker();
      }}
    >
      <div className="chrono-notes-mini-calendar-header">
        <div className="chrono-notes-mini-calendar-navigation">
          <button
            type="button"
            aria-label={messages.previousMonth}
            title={messages.previousMonth}
            onClick={() => {
              setPeriodPickerOpen(false);
              showMonth(shiftPickerMonth(displayMonth, -1));
            }}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <button
            ref={periodTrigger}
            type="button"
            className="chrono-notes-mini-calendar-period-trigger"
            aria-label={`${t("calendar.chooseMonth")}: ${formatMonthLabel(
              displayMonth,
              locale,
            )}`}
            aria-expanded={periodPickerOpen}
            aria-controls={periodPickerId}
            onClick={() => setPeriodPickerOpen((open) => !open)}
          >
            <strong aria-live="polite" aria-atomic="true">
              {formatMonthLabel(displayMonth, locale)}
            </strong>
            <ChevronDown size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={messages.nextMonth}
            title={messages.nextMonth}
            onClick={() => {
              setPeriodPickerOpen(false);
              showMonth(shiftPickerMonth(displayMonth, 1));
            }}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          className="chrono-notes-mini-calendar-today"
          onClick={() => void selectDate(today)}
          disabled={isSelecting}
        >
          {messages.today}
        </button>
      </div>
      {periodPickerOpen ? (
        <CalendarPickerLayer
          modalHost={pickerModalHost}
          title={t("calendar.chooseMonth")}
          onClose={closePeriodPicker}
        >
          <div
            id={periodPickerId}
            className="chrono-notes-mini-calendar-period-picker"
            role="group"
            aria-label={t("calendar.chooseMonth")}
          >
            <div className="chrono-notes-mini-calendar-year-navigation">
              <button
                type="button"
                aria-label={messages.previousYear}
                title={messages.previousYear}
                onClick={() => showMonth(shiftPickerYear(displayMonth, -1))}
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <strong aria-live="polite" aria-atomic="true">
                {displayMonth.year}
              </strong>
              <button
                type="button"
                aria-label={messages.nextYear}
                title={messages.nextYear}
                onClick={() => showMonth(shiftPickerYear(displayMonth, 1))}
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="chrono-notes-mini-calendar-month-grid">
              {monthLabels.map((label, index) => {
                const month = index + 1;
                const selected = month === displayMonth.month;
                return (
                  <button
                    ref={(element) => {
                      if (element === null) monthButtons.current.delete(month);
                      else monthButtons.current.set(month, element);
                    }}
                    type="button"
                    className={selected ? "is-selected" : undefined}
                    aria-label={formatMonthLabel(
                      { year: displayMonth.year, month },
                      locale,
                    )}
                    aria-pressed={selected}
                    key={month}
                    onClick={() => {
                      setPeriodPickerOpen(false);
                      showMonth({ year: displayMonth.year, month }, true);
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </CalendarPickerLayer>
      ) : null}
      <div
        className="chrono-notes-mini-calendar-grid"
        role="grid"
        aria-label={formatMonthLabel(displayMonth, locale)}
      >
        <div className="chrono-notes-mini-calendar-row" role="row">
          {weekdayLabels.map((label, index) => (
            <div
              key={`${index}-${label}`}
              role="columnheader"
              className="chrono-notes-mini-calendar-weekday"
            >
              {label}
            </div>
          ))}
        </div>
        {dayRows.map((days) => (
          <div
            className="chrono-notes-mini-calendar-row"
            role="row"
            key={formatLocalDateKey(days[0]!.date)}
          >
            {days.map((day) => {
              const key = formatLocalDateKey(day.date);
              const selected = isSameLocalDate(day.date, initialDate);
              const isToday = isSameLocalDate(day.date, today);
              return (
                <button
                  ref={(element) => {
                    if (element === null) dayButtons.current.delete(key);
                    else dayButtons.current.set(key, element);
                  }}
                  key={key}
                  type="button"
                  role="gridcell"
                  className={[
                    "chrono-notes-mini-calendar-day",
                    day.inCurrentMonth ? "" : "is-outside-month",
                    selected ? "is-selected" : "",
                    isToday ? "is-today" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-label={key}
                  aria-selected={selected}
                  aria-current={isToday ? "date" : undefined}
                  disabled={isSelecting}
                  tabIndex={isSameLocalDate(day.date, focusedDate) ? 0 : -1}
                  onClick={() => void selectDate(day.date)}
                  onKeyDown={(event) => {
                    if (!moveFocus(day.date, event.key)) return;
                    event.preventDefault();
                  }}
                >
                  {day.date.day}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function firstDateOfMonth(month: CalendarMonth): LocalDate {
  return Object.freeze({ year: month.year, month: month.month, day: 1 });
}

function formatMonthLabel(month: CalendarMonth, locale: string): string {
  const value = new Date(0);
  value.setUTCFullYear(month.year, month.month - 1, 1);
  value.setUTCHours(0, 0, 0, 0);
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}
