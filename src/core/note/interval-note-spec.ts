import {
  formatLocalDateKey,
  toDateTime,
  toLocalDate,
  type LocalDate,
} from "../periodic/periodic-date";

export interface IntervalNoteSpec {
  readonly start: LocalDate;
  readonly end: LocalDate;
  readonly dayCount: number;
  readonly title: string;
  readonly path: string;
}

export function normalizeIntervalNoteDates(
  first: LocalDate,
  second: LocalDate,
): Readonly<{ start: LocalDate; end: LocalDate }> {
  const firstValue = toDateTime(first);
  const secondValue = toDateTime(second);
  return firstValue <= secondValue
    ? Object.freeze({ start: toLocalDate(firstValue), end: toLocalDate(secondValue) })
    : Object.freeze({ start: toLocalDate(secondValue), end: toLocalDate(firstValue) });
}

export function buildIntervalNoteSpec(
  start: LocalDate,
  end: LocalDate,
  folder: string,
): IntervalNoteSpec {
  const normalizedFolder = normalizeIntervalNoteFolder(folder);
  if (normalizedFolder.length === 0) {
    throw new RangeError("Range note folder must not be empty");
  }
  const normalized = normalizeIntervalNoteDates(start, end);
  const startLabel = formatLocalDateKey(normalized.start);
  const endLabel = formatLocalDateKey(normalized.end);
  const title = `${startLabel} - ${endLabel}`;
  return Object.freeze({
    start: normalized.start,
    end: normalized.end,
    dayCount: Math.floor(
      toDateTime(normalized.end).diff(toDateTime(normalized.start), "days").days,
    ) + 1,
    title,
    path: `${normalizedFolder}/${title}.md`,
  });
}

export function buildIntervalNoteContent(spec: IntervalNoteSpec): string {
  return [
    "---",
    `start: ${formatLocalDateKey(spec.start)}`,
    `end: ${formatLocalDateKey(spec.end)}`,
    "---",
    "",
    `# ${spec.title}`,
    "",
  ].join("\n");
}

export function normalizeIntervalNoteFolder(path: string): string {
  return path.trim().replace(/[\\/]+/g, "/").replace(/^\/+|\/+$/g, "");
}
