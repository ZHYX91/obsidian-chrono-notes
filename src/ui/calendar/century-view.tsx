import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { getCenturyNumber, getDecadeStart, getPeriodAnchor, isSamePeriod, type LocalDate, type PeriodicNoteType } from "../../core/periodic/periodic-date";
import type { CenturyCalendarQuery } from "../../features/calendar/century-calendar-query";
import type { IndexedPeriodicNote } from "../../features/calendar/indexed-periodic-note";
import { CalendarPeriodCell, type CalendarPeriodCellProps } from "./calendar-period-cell";
import { resolvePeriodGridNavigation } from "./calendar-period-picker";
import { getPeriodicSelectionKind, type CalendarSelectionKind } from "./calendar-selection";
import { useHostEnvironment } from "../host-environment";

type SharedCellProps = Omit<CalendarPeriodCellProps,
  "summary" | "noteType" | "label" | "selectionDetail" | "selected" | "onSelect" | "tabIndex" | "onFocus">;

interface CenturyViewProps extends SharedCellProps {
  readonly query: CenturyCalendarQuery;
  readonly selection: Readonly<{ kind: CalendarSelectionKind; date: LocalDate }>;
  readonly revealRequest: Readonly<{ year: number; revision: number }>;
  readonly onSelect: (kind: CalendarSelectionKind, date: LocalDate) => void;
}

export function CenturyView({ query, selection, revealRequest, onSelect, ...shared }: CenturyViewProps) {
  const { t } = shared.translator;
  const root = useRef<HTMLElement>(null);
  const host = useHostEnvironment();
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const periodKeys = [
    ...(query.summary.noteState === "not-configured" ? [] : [`century:${query.summary.date.year}`]),
    ...query.groups.flatMap((group) => [
      `decadal:${group.summary.date.year}`,
      ...group.years.map((year) => `yearly:${year.date.year}`),
    ]),
  ];
  const selectedType = selection.kind === "century" ? "century"
    : selection.kind === "decade" ? "decadal" : "yearly";
  const selectedYear = getPeriodAnchor(selection.date, selectedType, shared.weekStartDay).year;
  const tabStop = [focusedKey, `${selectedType}:${selectedYear}`, `yearly:${shared.today.year}`]
    .find((key) => key !== null && periodKeys.includes(key)) ?? periodKeys[0];

  // Focus is separate from semantic selection. Tab leaves the entire calendar;
  // arrows inspect periods without opening a file or creating a note.
  const navigate = (event: KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    const buttons = Array.from(root.current?.querySelectorAll<HTMLButtonElement>(
      ".chrono-notes-period-cell",
    ) ?? []);
    const current = event.target as HTMLButtonElement;
    if (!buttons.includes(current)) return;
    const vertical = event.key === "ArrowUp" || event.key === "ArrowDown";
    const isYear = current.dataset.periodKind === "year";
    const candidates = vertical
      ? buttons.filter((button) => (button.dataset.periodKind === "year") === isYear)
      : buttons;
    const configuredColumns = current.parentElement === null ? NaN : Number(
      host.window.getComputedStyle(current.parentElement)
        .getPropertyValue("--chrono-notes-year-columns"),
    );
    const columns = configuredColumns === 2 ? 2 : 5;
    const next = resolvePeriodGridNavigation(
      event.key, candidates.indexOf(current), candidates.length, vertical && isYear ? columns : 1,
      shared.translator.direction === "rtl",
    );
    if (next === null) return;
    event.preventDefault();
    const target = candidates[next];
    target?.focus();
    target?.scrollIntoView({ block: "nearest" });
  };

  useEffect(() => {
    const frame = host.window.requestAnimationFrame(() => {
      const decade = getDecadeStart(revealRequest.year);
      const group = root.current?.querySelector<HTMLElement>(`[data-decade-year="${decade}"]`)
        ?? root.current?.querySelector<HTMLElement>(".chrono-notes-long-period-group");
      group?.scrollIntoView({ block: "center" });
    });
    return () => host.window.cancelAnimationFrame(frame);
  }, [host.window, query.range.start.year, revealRequest]);
  const cell = (summary: IndexedPeriodicNote, noteType: PeriodicNoteType, label: string, detail?: string) => {
    const kind = getPeriodicSelectionKind(noteType);
    const key = `${noteType}:${summary.date.year}`;
    const selectedKind = noteType === "yearly"
      ? selection.kind !== "decade" && selection.kind !== "century" : selection.kind === kind;
    return <CalendarPeriodCell {...shared} key={key}
      summary={summary} noteType={noteType} label={label} selectionDetail={detail}
      tabIndex={key === tabStop ? 0 : -1} onFocus={() => setFocusedKey(key)}
      selected={selectedKind && isSamePeriod(selection.date, summary.date, noteType, shared.weekStartDay)}
      onSelect={() => onSelect(kind, summary.date)} />;
  };
  const decadeLabel = (year: number) => `${String(year).padStart(4, "0")}s`;
  return (
    <section ref={root} className="chrono-notes-long-period" aria-label={t("calendar.view.century")}
      onKeyDown={navigate}>
      {query.summary.noteState === "not-configured" ? null : (
        <div className="chrono-notes-long-period-heading">
          {cell(query.summary, "century", `C${getCenturyNumber(query.range.start.year)}`)}
        </div>
      )}
      {query.groups.map((group) => {
        const label = decadeLabel(group.summary.date.year);
        const years = new Map(group.years.map((note) => [note.date.year, note]));
        return (
          <section className="chrono-notes-long-period-group" key={label} aria-label={label}
            data-decade-year={group.summary.date.year}>
            <header className="chrono-notes-long-period-decade">
              {cell(group.summary, "decadal", label, group.partial ? t("calendar.long.partial") : undefined)}
            </header>
            <div className="chrono-notes-long-period-years">
              {Array.from({ length: 10 }, (_, offset) => {
                const year = group.summary.date.year + offset;
                const note = years.get(year);
                return note === undefined
                  ? <span key={year} aria-hidden="true" />
                  : cell(note, "yearly", String(year));
              })}
            </div>
          </section>
        );
      })}
    </section>
  );
}
