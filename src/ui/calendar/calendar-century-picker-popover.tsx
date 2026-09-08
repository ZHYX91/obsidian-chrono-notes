import type { RefObject } from "react";

import type { Translator } from "../../shared/i18n";
import { CalendarPeriodGrid } from "./calendar-period-grid";
import { useCalendarPickerDialog } from "./use-calendar-picker-dialog";

interface CalendarCenturyPickerPopoverProps {
  readonly year: number;
  readonly currentYear: number;
  readonly anchorRef: RefObject<HTMLElement>;
  readonly translator: Translator;
  readonly onSelect: (year: number) => void;
  readonly onClose: () => void;
}

export function CalendarCenturyPickerPopover({
  year, currentYear, anchorRef, translator, onSelect, onClose,
}: CalendarCenturyPickerPopoverProps) {
  const rootRef = useCalendarPickerDialog(anchorRef, onClose);
  return (
    <div ref={rootRef} className="chrono-notes-period-picker chrono-notes-long-period-picker"
      role="dialog" dir={translator.direction}
      aria-label={translator.t("calendar.picker.century.choose")}>
      <CalendarPeriodGrid kind="century" year={Math.max(1, year)} currentYear={currentYear}
        translator={translator} onSelect={(nextYear) => {
          onSelect(nextYear);
          onClose();
        }} />
    </div>
  );
}
