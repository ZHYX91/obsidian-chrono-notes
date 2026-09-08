import {
  getDecadeStart,
  getPeriodRange,
  type LocalDate,
  type PeriodRange,
  type WeekStartDay,
} from "../../core/periodic/periodic-date";
import type { NoteIndexSnapshot } from "../notes/note-index";
import {
  selectIndexedPeriodicNote,
  type IndexedPeriodicNote,
  type PeriodicNoteRule,
} from "./indexed-periodic-note";

export interface CenturyCalendarOptions {
  readonly locale: string;
  readonly weekStartDay: WeekStartDay;
  readonly yearly: PeriodicNoteRule;
  readonly decadal: PeriodicNoteRule;
  readonly century: PeriodicNoteRule;
}

export interface CenturyDecadeGroup {
  readonly date: LocalDate;
  readonly partial: boolean;
  readonly years: readonly LocalDate[];
}

export function buildCenturyGroups(year: number): {
  readonly range: PeriodRange;
  readonly groups: readonly CenturyDecadeGroup[];
} {
  const range = getPeriodRange({ year, month: 1, day: 1 }, "century", "monday");
  const first = Math.max(1, range.start.year);
  const last = Math.min(9999, range.end.year);
  const groups: CenturyDecadeGroup[] = [];
  for (let decade = getDecadeStart(first); decade <= last; decade += 10) {
    const start = Math.max(first, decade);
    const end = Math.min(last, decade + 9);
    groups.push(Object.freeze({
      date: Object.freeze({ year: decade, month: 1, day: 1 }),
      partial: start !== decade || end !== decade + 9,
      years: Object.freeze(Array.from({ length: end - start + 1 }, (_, offset) =>
        Object.freeze({ year: start + offset, month: 1, day: 1 }))),
    }));
  }
  return Object.freeze({ range, groups: Object.freeze(groups) });
}

export interface CenturyCalendarQuery {
  readonly range: PeriodRange;
  readonly summary: IndexedPeriodicNote;
  readonly groups: readonly {
    readonly summary: IndexedPeriodicNote;
    readonly partial: boolean;
    readonly years: readonly IndexedPeriodicNote[];
  }[];
}

export function selectCenturyCalendar(
  year: number,
  snapshot: NoteIndexSnapshot,
  options: CenturyCalendarOptions,
): CenturyCalendarQuery {
  const { range, groups } = buildCenturyGroups(year);
  return Object.freeze({
    range,
    summary: selectIndexedPeriodicNote(range.start, "century", snapshot, options, options.century),
    groups: Object.freeze(groups.map((group) => Object.freeze({
      summary: selectIndexedPeriodicNote(group.date, "decadal", snapshot, options, options.decadal),
      partial: group.partial,
      years: Object.freeze(group.years.map((date) =>
        selectIndexedPeriodicNote(date, "yearly", snapshot, options, options.yearly))),
    }))),
  });
}
