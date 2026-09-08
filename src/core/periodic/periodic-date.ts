import { DateTime } from "luxon";

export type PeriodicNoteType = typeof PERIODIC_NOTE_TYPES[number];
export type LongPeriodNoteType = "decadal" | "century";
export type WeekStartDay = "monday" | "sunday";

export const PERIODIC_NOTE_TYPES = [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
  "decadal",
  "century",
] as const;

export interface LocalDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export function formatLocalDateKey(date: LocalDate): string {
  return `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(
    date.day,
  ).padStart(2, "0")}`;
}

export function parseLocalDateKey(value: string): LocalDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return null;
  const date = Object.freeze({
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  });
  try {
    toDateTime(date);
    return date;
  } catch {
    return null;
  }
}

export function isSameLocalDate(left: LocalDate, right: LocalDate): boolean {
  return left.year === right.year && left.month === right.month && left.day === right.day;
}

export function isSamePeriod(
  left: LocalDate,
  right: LocalDate,
  noteType: PeriodicNoteType,
  weekStartDay: WeekStartDay,
): boolean {
  return isSameLocalDate(
    getPeriodAnchor(left, noteType, weekStartDay),
    getPeriodAnchor(right, noteType, weekStartDay),
  );
}

export function compareLocalDate(left: LocalDate, right: LocalDate): number {
  return left.year - right.year || left.month - right.month || left.day - right.day;
}

export function toUtcDate(date: LocalDate): Date {
  return toDateTime(date).toJSDate();
}

const UTC_ZONE = "UTC";

/** Return the single canonical date used by paths, navigation, and templates. */
export function getPeriodAnchor(
  date: LocalDate,
  noteType: PeriodicNoteType,
  weekStartDay: WeekStartDay,
): LocalDate {
  const value = toDateTime(date);
  switch (noteType) {
    case "daily":
      return toLocalDate(value);
    case "weekly": {
      const offset = weekStartDay === "sunday" ? value.weekday % 7 : value.weekday - 1;
      return toLocalDate(value.minus({ days: offset }));
    }
    case "monthly":
      return toLocalDate(value.startOf("month"));
    case "quarterly": {
      const quarterMonth = Math.floor((value.month - 1) / 3) * 3 + 1;
      return toLocalDate(toDateTime({ year: value.year, month: quarterMonth, day: 1 }));
    }
    case "yearly":
      return toLocalDate(value.startOf("year"));
    case "decadal":
      return Object.freeze({ year: getDecadeStart(date.year), month: 1, day: 1 });
    case "century":
      return Object.freeze({ year: (getCenturyNumber(date.year) - 1) * 100 + 1, month: 1, day: 1 });
  }
}

export function shiftPeriod(
  date: LocalDate,
  noteType: PeriodicNoteType,
  amount: number,
  weekStartDay: WeekStartDay,
): LocalDate {
  if (!Number.isInteger(amount)) throw new RangeError("Period shift must be an integer");
  const anchor = toDateTime(getPeriodAnchor(date, noteType, weekStartDay));
  const shifted = (() => {
    switch (noteType) {
      case "daily":
        return anchor.plus({ days: amount });
      case "weekly":
        return anchor.plus({ weeks: amount });
      case "monthly":
        return anchor.plus({ months: amount });
      case "quarterly":
        return anchor.plus({ months: amount * 3 });
      case "yearly":
        return anchor.plus({ years: amount });
      case "decadal":
        return anchor.plus({ years: amount * 10 });
      case "century":
        return anchor.plus({ years: amount * 100 });
    }
  })();
  return getPeriodAnchor(toLocalDate(shifted), noteType, weekStartDay);
}

export function getDecadeStart(year: number): number {
  return Math.floor(year / 10) * 10;
}

/** Century numbering is defined for positive CE years, with no century zero. */
export function getCenturyNumber(year: number): number {
  if (!Number.isInteger(year) || year < 1) {
    throw new RangeError("Century requires a positive CE year");
  }
  return Math.ceil(year / 100);
}

export interface PeriodRange {
  readonly start: LocalDate;
  readonly end: LocalDate;
  readonly dayCount: number;
}

export function getPeriodRange(
  date: LocalDate,
  noteType: PeriodicNoteType,
  weekStartDay: WeekStartDay,
): PeriodRange {
  const start = getPeriodAnchor(date, noteType, weekStartDay);
  const next = toDateTime(shiftPeriod(start, noteType, 1, weekStartDay));
  const end = toLocalDate(next.minus({ days: 1 }));
  return Object.freeze({
    start,
    end,
    dayCount: next.diff(toDateTime(start), "days").days,
  });
}

export function toDateTime(date: LocalDate): DateTime<true> {
  const value = DateTime.fromObject(
    { year: date.year, month: date.month, day: date.day },
    { zone: UTC_ZONE },
  );
  if (
    !value.isValid ||
    value.year !== date.year ||
    value.month !== date.month ||
    value.day !== date.day
  ) {
    throw new RangeError(`Invalid local date: ${formatLocalDateKey(date)}`);
  }
  return value;
}

export function toLocalDate(value: DateTime<true>): LocalDate {
  return Object.freeze({
    year: value.year,
    month: value.month,
    day: value.day,
  });
}
