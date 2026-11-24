import { compareLocalDate, toLocalDate, toDateTime, type LocalDate } from "../../core/periodic/periodic-date";
import type { IntervalNoteItem } from "./interval-note-query";

export type IntervalListScope = "all" | "month" | "year";
export type IntervalListSort = "start-asc" | "start-desc";

export interface IntervalListOptions {
  readonly query: string;
  readonly scope: IntervalListScope;
  readonly sort: IntervalListSort;
  readonly referenceDate: LocalDate;
}

export function filterIntervalNoteItems(
  items: readonly IntervalNoteItem[],
  options: IntervalListOptions,
): readonly IntervalNoteItem[] {
  const query = options.query.trim().toLocaleLowerCase();
  const reference = toDateTime(options.referenceDate);
  const period = options.scope === "all" ? null : options.scope;
  const scopeStart = period === null ? null : toLocalDate(reference.startOf(period));
  const scopeEnd = period === null ? null : toLocalDate(reference.endOf(period));
  const direction = options.sort === "start-desc" ? -1 : 1;
  const filtered = items.filter((item) => {
    if (query.length > 0) {
      const haystack = `${item.title}\n${item.path}`.toLocaleLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return scopeStart === null || scopeEnd === null || (
      compareLocalDate(item.end.date, scopeStart) >= 0 &&
      compareLocalDate(item.start.date, scopeEnd) <= 0
    );
  });
  filtered.sort((left, right) =>
    direction * (left.start.epochMillis - right.start.epochMillis) ||
    direction * (left.end.epochMillis - right.end.epochMillis) ||
    left.title.localeCompare(right.title) ||
    left.path.localeCompare(right.path));
  return Object.freeze(filtered);
}
