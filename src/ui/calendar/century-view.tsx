import { useEffect, useRef } from "react";
import { getCenturyNumber, getDecadeStart, isSamePeriod, type LocalDate, type PeriodicNoteType } from "../../core/periodic/periodic-date";
import type { CenturyCalendarQuery } from "../../features/calendar/century-calendar-query";
import type { IndexedPeriodicNote } from "../../features/calendar/indexed-periodic-note";
import { CalendarPeriodCell, type CalendarPeriodCellProps } from "./calendar-period-cell";
import { getPeriodicSelectionKind, type CalendarSelectionKind } from "./calendar-selection";
import { useHostEnvironment } from "../host-environment";

type SharedCellProps = Omit<CalendarPeriodCellProps,
  "summary" | "noteType" | "label" | "selectionDetail" | "selected" | "onSelect">;

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
    const selectedKind = noteType === "yearly"
      ? selection.kind !== "decade" && selection.kind !== "century" : selection.kind === kind;
    return <CalendarPeriodCell {...shared} key={`${noteType}:${summary.date.year}`}
      summary={summary} noteType={noteType} label={label} selectionDetail={detail}
      selected={selectedKind && isSamePeriod(selection.date, summary.date, noteType, shared.weekStartDay)}
      onSelect={() => onSelect(kind, summary.date)} />;
  };
  const decadeLabel = (year: number) => `${String(year).padStart(4, "0")}s`;
  return (
    <section ref={root} className="chrono-notes-long-period" aria-label={t("calendar.view.century")}>
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
