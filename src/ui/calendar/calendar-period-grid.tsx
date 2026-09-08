import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { LocalDate, PeriodicNoteType } from "../../core/periodic/periodic-date";
import type { NoteOpenTarget } from "../../features/periodic/periodic-note-commands";
import type { Translator } from "../../shared/i18n";
import { useHostEnvironment } from "../host-environment";
import {
  formatPeriodPickerTargetLabel,
  getPeriodPickerAnchor,
  getPeriodPickerWindow,
  resolvePeriodGridNavigation,
  type PeriodGridKind,
} from "./calendar-period-picker";
import { PeriodTargetButton } from "./period-target-button";

interface CalendarPeriodGridProps {
  readonly kind: PeriodGridKind;
  readonly year: number;
  readonly currentYear: number;
  readonly translator: Translator;
  readonly weekYear?: boolean;
  readonly onSelect: (year: number) => void;
  readonly onOpen?: (date: LocalDate, type: PeriodicNoteType, target: NoteOpenTarget) => Promise<void>;
}

/** Shared paging, selection and keyboard navigation for year and longer periods. */
export function CalendarPeriodGrid({
  kind, year, currentYear, translator, weekYear = false, onSelect, onOpen,
}: CalendarPeriodGridProps) {
  const host = useHostEnvironment();
  const { t } = translator;
  const PreviousIcon = translator.direction === "rtl" ? ChevronRight : ChevronLeft;
  const NextIcon = translator.direction === "rtl" ? ChevronLeft : ChevronRight;
  const [pageYear, setPageYear] = useState(year);
  const page = useMemo(() => getPeriodPickerWindow(kind, pageYear), [kind, pageYear]);
  const selected = getPeriodPickerAnchor(kind, year);
  const current = getPeriodPickerAnchor(kind, currentYear);
  const [focused, setFocused] = useState(selected);
  const gridRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<number | null>(null);
  const tabStop = page.items.some((item) => item.start === focused) ? focused
    : page.items.some((item) => item.start === selected) ? selected : page.items[0]?.start;

  useEffect(() => {
    const index = pendingFocus.current;
    if (index === null) return;
    pendingFocus.current = null;
    const target = gridRef.current?.querySelectorAll<HTMLButtonElement>("button")[
      Math.min(index, page.items.length - 1)
    ];
    target?.focus();
    target?.scrollIntoView({ block: "nearest" });
  }, [page]);

  const navigate = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      const next = event.key === "PageUp" ? page.previousYear : page.nextYear;
      if (next !== null) {
        pendingFocus.current = index;
        setPageYear(next);
      }
      return;
    }
    const grid = gridRef.current;
    if (grid === null) return;
    const tracks = host.window.getComputedStyle(grid).gridTemplateColumns
      .split(" ").filter((track) => /^[\d.]+px$/.test(track));
    const targetIndex = resolvePeriodGridNavigation(
      event.key, index, page.items.length, tracks.length || (kind === "year" ? 5 : 2),
      translator.direction === "rtl",
    );
    if (targetIndex === null) return;
    event.preventDefault();
    const target = grid.querySelectorAll<HTMLButtonElement>("button")[targetIndex];
    target?.focus();
    target?.scrollIntoView({ block: "nearest" });
  };

  return (
    <>
      <div className="chrono-notes-period-picker-nav">
        <button type="button" disabled={page.previousYear === null}
          aria-label={t(kind === "year" ? "calendar.previousYearWindow" : `calendar.picker.${kind}.previous`)}
          onClick={() => { if (page.previousYear !== null) setPageYear(page.previousYear); }}>
          <PreviousIcon size={15} aria-hidden="true" />
        </button>
        <strong aria-live="polite" dir="ltr">{page.title}</strong>
        <button type="button" disabled={page.nextYear === null}
          aria-label={t(kind === "year" ? "calendar.nextYearWindow" : `calendar.picker.${kind}.next`)}
          onClick={() => { if (page.nextYear !== null) setPageYear(page.nextYear); }}>
          <NextIcon size={15} aria-hidden="true" />
        </button>
      </div>
      <div ref={gridRef} className={kind === "year"
        ? "chrono-notes-year-picker-grid" : "chrono-notes-long-period-picker-grid"}>
        {page.items.map((item, index) => {
          const targetLabel = kind === "year"
            ? t(weekYear ? "calendar.selectWeekYear" : "calendar.selectYear", { year: item.start })
            : t(`calendar.picker.${kind}.select`, { period: `${item.label} · ${item.detail}` });
          return (
            <PeriodTargetButton key={item.start}
              ariaLabel={formatPeriodPickerTargetLabel(targetLabel, item.start === current, translator)}
              current={item.start === current} selected={item.start === selected}
              date={{ year: item.start, month: 1, day: 1 }}
              noteType={kind === "century" ? "century" : "yearly"}
              tabIndex={item.start === tabStop ? 0 : -1}
              onFocus={() => setFocused(item.start)}
              onNavigate={(event) => navigate(event, index)}
              onSelect={() => onSelect(Math.max(1, item.start))}
              {...(onOpen === undefined ? {} : { onOpen })}>
              {item.detail === null ? item.label : (
                <>
                  <span className="chrono-notes-period-picker-label" dir="ltr">{item.label}</span>
                  <span className="chrono-notes-period-picker-detail" dir="ltr">{item.detail}</span>
                </>
              )}
            </PeriodTargetButton>
          );
        })}
      </div>
    </>
  );
}
