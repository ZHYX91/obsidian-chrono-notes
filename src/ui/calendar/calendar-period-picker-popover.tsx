import {
  useMemo,
  type RefObject,
} from "react";

import type { LocalDate, PeriodicNoteType } from "../../core/periodic/periodic-date";
import type { NoteOpenTarget } from "../../features/periodic/periodic-note-commands";
import type { Translator } from "../../shared/i18n";
import type { QuarterNameMode } from "../../shared/settings";
import { formatShortMonthLabel } from "../date-presentation";
import {
  buildMonthPickerRows,
  formatPeriodPickerTargetLabel,
} from "./calendar-period-picker";
import { formatYearQuarterLabel } from "./year-view-presentation";
import { PeriodTargetButton } from "./period-target-button";
import { CalendarPeriodGrid } from "./calendar-period-grid";
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
      dir={translator.direction}
      aria-label={translator.t(
        kind === "year" ? "calendar.yearPicker" : "calendar.monthPicker",
      )}
    >
      {kind === "year" ? (
        <CalendarPeriodGrid
          kind="year" year={year} currentYear={today.year} translator={translator}
          onSelect={onSelectYear}
          onOpen={(date, noteType, target) => {
            onClose();
            return onOpenPeriodic(date, noteType, target);
          }}
        />
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
