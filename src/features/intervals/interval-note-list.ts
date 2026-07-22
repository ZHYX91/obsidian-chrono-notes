import { toDateTime, type LocalDate } from "../../core/periodic/periodic-date";
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
  const scopeStart = options.scope === "month"
    ? reference.startOf("month")
    : options.scope === "year" ? reference.startOf("year") : null;
  const scopeEnd = options.scope === "month"
    ? reference.endOf("month")
    : options.scope === "year" ? reference.endOf("year") : null;
  const direction = options.sort === "start-desc" ? -1 : 1;
  const filtered = items.filter((item) => {
    if (query.length > 0) {
      const haystack = `${item.title}\n${item.path}`.toLocaleLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return scopeStart === null || scopeEnd === null || (
      toDateTime(item.end.date) >= scopeStart.startOf("day") &&
      toDateTime(item.start.date) <= scopeEnd.startOf("day")
    );
  });
  filtered.sort((left, right) =>
    direction * (left.start.epochMillis - right.start.epochMillis) ||
    direction * (left.end.epochMillis - right.end.epochMillis) ||
    left.title.localeCompare(right.title) ||
    left.path.localeCompare(right.path));
  return Object.freeze(filtered);
}
