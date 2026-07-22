import {
  useMemo,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { LocalDate, PeriodicNoteType } from "../../core/periodic/periodic-date";
import type { NoteOpenTarget } from "../../features/periodic/periodic-note-commands";
import type { Translator } from "../../shared/i18n";
import type { QuarterNameMode } from "../../shared/settings";
import { formatShortMonthLabel } from "../date-presentation";
import {
  buildMonthPickerRows,
  formatPeriodPickerTargetLabel,
  getYearPickerWindow,
  resolvePeriodPickerAction,
  resolvePeriodPickerKeyboardAction,
  shiftYearPickerWindow,
} from "./calendar-period-picker";
import { formatYearQuarterLabel } from "./year-view-presentation";
import { useCalendarPickerDialog } from "./use-calendar-picker-dialog";

interface CalendarPeriodPickerPopoverProps {
  readonly kind: "year" | "month";
  readonly year: number;
  readonly month: number;
  readonly today: LocalDate;
  readonly selectedQuarter: number | null;
  readonly quarterNameMode: QuarterNameMode;
  readonly anchorRef: RefObject<HTMLElement>;
  readonly translator: Translator;
  readonly onSelectYear: (year: number) => void;
  readonly onSelectMonth: (month: number) => void;
  readonly onSelectQuarter: (quarter: number) => void;
  readonly onOpenPeriodic: (
    date: LocalDate,
    noteType: PeriodicNoteType,
    target: NoteOpenTarget,
  ) => Promise<void>;
  readonly onClose: () => void;
}

export function CalendarPeriodPickerPopover(
  props: CalendarPeriodPickerPopoverProps,
) {
  const {
    anchorRef,
    kind,
    month,
    onClose,
    onOpenPeriodic,
    onSelectMonth,
    onSelectQuarter,
    onSelectYear,
    quarterNameMode,
    selectedQuarter,
    today,
    translator,
    year,
  } = props;
  const rootRef = useCalendarPickerDialog(anchorRef, onClose);
  const [yearWindow, setYearWindow] = useState(() => getYearPickerWindow(year));
  const monthRows = useMemo(
    () => buildMonthPickerRows(
      (quarter) => formatYearQuarterLabel(quarter, quarterNameMode, translator.t),
      (value) => formatShortMonthLabel(year, value, translator.locale),
    ),
    [quarterNameMode, translator, year],
  );

  return (
    <div
      ref={rootRef}
      className="chrono-notes-period-picker"
      role="dialog"
      aria-label={translator.t(
        kind === "year" ? "calendar.yearPicker" : "calendar.monthPicker",
      )}
    >
      {kind === "year" ? (
        <>
          <div className="chrono-notes-period-picker-nav">
            <button
              type="button"
              aria-label={translator.t("calendar.previousYearWindow")}
              onClick={() => setYearWindow((current) => shiftYearPickerWindow(current, -1))}
            >
              <ChevronLeft size={15} aria-hidden="true" />
            </button>
            <strong>{yearWindow.start} - {yearWindow.end}</strong>
            <button
              type="button"
              aria-label={translator.t("calendar.nextYearWindow")}
              onClick={() => setYearWindow((current) => shiftYearPickerWindow(current, 1))}
            >
              <ChevronRight size={15} aria-hidden="true" />
            </button>
          </div>
          <div className="chrono-notes-year-picker-grid">
            {yearWindow.years.map((value) => {
              const current = value === today.year;
              const targetLabel = translator.t("calendar.selectYear", {
                year: value,
              });
              return (
                <PeriodTargetButton
                  key={value}
                  current={current}
                  selected={value === year}
                  ariaLabel={formatPeriodPickerTargetLabel(
                    targetLabel,
                    current,
                    translator,
                  )}
                  date={{ year: value, month: 1, day: 1 }}
                  noteType="yearly"
                  onSelect={() => onSelectYear(value)}
                  onOpen={onOpenPeriodic}
                  onClose={onClose}
                >
                  {value}
                </PeriodTargetButton>
              );
            })}
          </div>
        </>
      ) : (
        <div className="chrono-notes-month-picker-grid">
          {monthRows.map((row) => (
            <div className="chrono-notes-month-picker-row" key={row.quarter}>
              <PeriodTargetButton
                className="chrono-notes-quarter-picker-button"
                current={false}
                selected={selectedQuarter === row.quarter}
                ariaLabel={translator.t("calendar.selectQuarter", {
                  quarter: row.quarterLabel,
                })}
                date={{ year, month: (row.quarter - 1) * 3 + 1, day: 1 }}
                noteType="quarterly"
                onSelect={() => onSelectQuarter(row.quarter)}
                onOpen={onOpenPeriodic}
                onClose={onClose}
              >
                {row.quarterLabel}
              </PeriodTargetButton>
              {row.months.map((item) => {
                const current = year === today.year &&
                  item.month === today.month;
                const targetLabel = translator.t("calendar.selectMonth", {
                  month: item.label,
                });
                return (
                  <PeriodTargetButton
                    key={item.month}
                    current={current}
                    selected={item.month === month}
                    ariaLabel={formatPeriodPickerTargetLabel(
                      targetLabel,
                      current,
                      translator,
                    )}
                    date={{ year, month: item.month, day: 1 }}
                    noteType="monthly"
                    onSelect={() => onSelectMonth(item.month)}
                    onOpen={onOpenPeriodic}
                    onClose={onClose}
                  >
                    {item.label}
                  </PeriodTargetButton>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface PeriodTargetButtonProps {
  readonly ariaLabel: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly current: boolean;
  readonly date: LocalDate;
  readonly noteType: "monthly" | "quarterly" | "yearly";
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly onOpen: (
    date: LocalDate,
    noteType: PeriodicNoteType,
    target: NoteOpenTarget,
  ) => Promise<void>;
  readonly onClose: () => void;
}

function PeriodTargetButton(props: PeriodTargetButtonProps) {
  const {
    ariaLabel,
    children,
    className = "",
    current,
    date,
    noteType,
    onClose,
    onOpen,
    onSelect,
    selected,
  } = props;

  const runAction = (action: ReturnType<typeof resolvePeriodPickerAction>) => {
    if (action === "select") {
      onSelect();
    } else if (action === "open-default" || action === "open-tab") {
      onClose();
      void onOpen(date, noteType, action === "open-tab" ? "tab" : "default");
    }
  };

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    const action = resolvePeriodPickerAction(event);
    if (action === "open-tab") event.preventDefault();
    runAction(action);
  };
  const handleAuxClick = (event: MouseEvent<HTMLButtonElement>) => {
    const action = resolvePeriodPickerAction(event);
    if (action !== "ignore") event.preventDefault();
    runAction(action);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const action = resolvePeriodPickerKeyboardAction(event);
    if (action === null) return;
    event.preventDefault();
    onClose();
    void onOpen(
      date,
      noteType,
      action === "open-tab" ? "tab" : "default",
    );
  };

  return (
    <button
      type="button"
      className={[
        className,
        current ? "is-current" : "",
        selected ? "is-selected" : "",
      ].filter(Boolean).join(" ")}
      data-selected={String(selected)}
      aria-current={current ? "true" : undefined}
      aria-label={ariaLabel}
      aria-pressed={selected}
      onClick={handleClick}
      onAuxClick={handleAuxClick}
      onMouseDown={(event) => {
        if (event.button === 1) event.preventDefault();
      }}
      onKeyDown={handleKeyDown}
    >
      {children}
    </button>
  );
}
