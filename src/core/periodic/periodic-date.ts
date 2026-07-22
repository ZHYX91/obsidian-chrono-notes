import { DateTime } from "luxon";

export type PeriodicNoteType = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
export type WeekStartDay = "monday" | "sunday";

export const PERIODIC_NOTE_TYPES = [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
] as const satisfies readonly PeriodicNoteType[];

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
    }
  })();
  return getPeriodAnchor(toLocalDate(shifted), noteType, weekStartDay);
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
