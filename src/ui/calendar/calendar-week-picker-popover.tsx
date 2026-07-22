import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  buildCalendarWeeks,
  getCalendarWeekIdentity,
} from "../../core/periodic/calendar-week";
import type {
  LocalDate,
  WeekStartDay,
} from "../../core/periodic/periodic-date";
import type { Translator } from "../../shared/i18n";
import {
  formatPeriodPickerTargetLabel,
  getYearPickerWindow,
  shiftYearPickerWindow,
} from "./calendar-period-picker";
import {
  getWeekPickerContentBoxWidth,
  getWeekPickerColumnCount,
  resolveWeekPickerNavigation,
  resolveWeekPickerTypeahead,
  type WeekPickerColumnCount,
} from "./calendar-week-picker";
import { createWeekPickerLabelFormatter } from "./week-view-presentation";
import { useCalendarPickerDialog } from "./use-calendar-picker-dialog";

interface CalendarWeekPickerPopoverProps {
  readonly kind: "year" | "week";
  readonly weekYear: number;
  readonly weekNumber: number;
  readonly weekStartDay: WeekStartDay;
  readonly today: LocalDate;
  readonly anchorRef: RefObject<HTMLElement>;
  readonly translator: Translator;
  readonly onSelectWeekYear: (weekYear: number) => void;
  readonly onSelectWeek: (weekNumber: number) => void;
  readonly onClose: () => void;
}

export function CalendarWeekPickerPopover(
  props: CalendarWeekPickerPopoverProps,
) {
  const {
    anchorRef,
    kind,
    onClose,
    onSelectWeek,
    onSelectWeekYear,
    today,
    translator,
    weekNumber,
    weekStartDay,
    weekYear,
  } = props;
  const rootRef = useCalendarPickerDialog(anchorRef, onClose, kind === "week");
  const [yearWindow, setYearWindow] = useState(() => getYearPickerWindow(weekYear));
  const [columns, setColumns] = useState<WeekPickerColumnCount>(3);
  const typeaheadRef = useRef("");
  const typeaheadTimerRef = useRef<number | null>(null);
  const currentWeek = useMemo(
    () => getCalendarWeekIdentity(today, weekStartDay),
    [today, weekStartDay],
  );
  const weeks = useMemo(
    () => buildCalendarWeeks(weekYear, weekStartDay),
    [weekStartDay, weekYear],
  );
  const formatLabels = useMemo(
    () => createWeekPickerLabelFormatter(translator),
    [translator],
  );
  const weekItems = useMemo(
    () => weeks.map((week) => Object.freeze({
      ...week,
      labels: formatLabels(
        week.start,
        week.end,
        week.weekNumber,
        week.weekYear,
      ),
    })),
    [formatLabels, weeks],
  );

  useEffect(() => {
    if (kind !== "week") return undefined;
    const root = rootRef.current;
    if (root === null) return undefined;
    const updateColumns = (width: number) => {
      setColumns(getWeekPickerColumnCount(width));
    };
    const style = window.getComputedStyle(root);
    updateColumns(getWeekPickerContentBoxWidth(
      root.getBoundingClientRect().width,
      Number.parseFloat(style.paddingLeft) || 0,
      Number.parseFloat(style.paddingRight) || 0,
      Number.parseFloat(style.borderLeftWidth) || 0,
      Number.parseFloat(style.borderRightWidth) || 0,
    ));
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width !== undefined) updateColumns(width);
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [kind, rootRef]);

  useEffect(() => () => {
    if (typeaheadTimerRef.current !== null) {
      window.clearTimeout(typeaheadTimerRef.current);
    }
  }, []);

  const focusWeek = (index: number) => {
    const target = rootRef.current?.querySelector<HTMLButtonElement>(
      `[data-week-index="${index}"]`,
    );
    target?.focus();
    target?.scrollIntoView({ block: "nearest" });
  };

  const handleWeekKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    const typeahead = !event.ctrlKey && !event.metaKey
      ? resolveWeekPickerTypeahead(
          typeaheadRef.current,
          event.key,
          weekItems.length,
        )
      : null;
    if (typeahead !== null) {
      event.preventDefault();
      typeaheadRef.current = typeahead.buffer;
      if (typeaheadTimerRef.current !== null) {
        window.clearTimeout(typeaheadTimerRef.current);
      }
      typeaheadTimerRef.current = window.setTimeout(() => {
        typeaheadRef.current = "";
        typeaheadTimerRef.current = null;
      }, 700);
      if (typeahead.targetIndex !== null) focusWeek(typeahead.targetIndex);
      return;
    }
    const targetIndex = resolveWeekPickerNavigation({
      key: event.key,
      currentIndex,
      itemCount: weekItems.length,
      columns,
    });
    if (targetIndex === null) return;
    event.preventDefault();
    focusWeek(targetIndex);
  };

  return (
    <div
      ref={rootRef}
      className={`chrono-notes-period-picker${kind === "week" ? " chrono-notes-week-picker" : ""}`}
      role="dialog"
      aria-label={translator.t(
        kind === "year" ? "calendar.weekYearPicker" : "calendar.weekPicker",
      )}
    >
      {kind === "year" ? (
        <>
          <div className="chrono-notes-period-picker-nav">
            <button
              type="button"
              aria-label={translator.t("calendar.previousYearWindow")}
              onClick={() => setYearWindow((current) =>
                shiftYearPickerWindow(current, -1))}
            >
              <ChevronLeft size={15} aria-hidden="true" />
            </button>
            <strong>{yearWindow.start} - {yearWindow.end}</strong>
            <button
              type="button"
              aria-label={translator.t("calendar.nextYearWindow")}
              onClick={() => setYearWindow((current) =>
                shiftYearPickerWindow(current, 1))}
            >
              <ChevronRight size={15} aria-hidden="true" />
            </button>
          </div>
          <div className="chrono-notes-year-picker-grid">
            {yearWindow.years.map((value) => {
              const selected = value === weekYear;
              const current = value === currentWeek.weekYear;
              const targetLabel = translator.t("calendar.selectWeekYear", {
                year: value,
              });
              return (
                <button
                  type="button"
                  key={value}
                  className={[
                    current ? "is-current" : "",
                    selected ? "is-selected" : "",
                  ].filter(Boolean).join(" ")}
                  data-selected={String(selected)}
                  aria-current={current ? "true" : undefined}
                  aria-label={formatPeriodPickerTargetLabel(
                    targetLabel,
                    current,
                    translator,
                  )}
                  aria-pressed={selected}
                  onClick={() => {
                    onSelectWeekYear(value);
                    onClose();
                  }}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div
          className="chrono-notes-week-picker-grid"
          role="group"
          aria-label={translator.t("calendar.weekPicker")}
        >
          {weekItems.map((item, index) => {
            const selected = item.weekNumber === weekNumber;
            const current = item.weekYear === currentWeek.weekYear &&
              item.weekNumber === currentWeek.weekNumber;
            return (
              <button
                type="button"
                key={item.weekNumber}
                className={[
                  selected ? "is-selected" : "",
                  current ? "is-current" : "",
                ].filter(Boolean).join(" ")}
                data-selected={String(selected)}
                data-week-index={index}
                aria-current={current ? "true" : undefined}
                aria-label={formatPeriodPickerTargetLabel(
                  item.labels.selectAccessible,
                  current,
                  translator,
                )}
                aria-pressed={selected}
                title={item.labels.accessible}
                onClick={() => {
                  onSelectWeek(item.weekNumber);
                  onClose();
                }}
                onKeyDown={(event) => handleWeekKeyDown(event, index)}
              >
                <span className="chrono-notes-week-picker-number">
                  {item.labels.item}
                </span>
                <span className="chrono-notes-week-picker-range">
                  {item.labels.range}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
