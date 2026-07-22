import { DateTime } from "luxon";

import {
  getPeriodAnchor,
  shiftPeriod,
  toDateTime,
  toLocalDate,
  type LocalDate,
  type WeekStartDay,
} from "./periodic-date";

export interface CalendarWeekIdentity {
  readonly weekYear: number;
  readonly weekNumber: number;
}

export interface CalendarWeek extends CalendarWeekIdentity {
  readonly start: LocalDate;
  readonly end: LocalDate;
}

export function getCalendarWeekIdentity(
  date: LocalDate,
  weekStartDay: WeekStartDay,
): CalendarWeekIdentity {
  const start = getPeriodAnchor(date, "weekly", weekStartDay);
  const reference = toDateTime(start).plus({
    days: weekStartDay === "sunday" ? 1 : 0,
  });
  return Object.freeze({
    weekYear: reference.weekYear,
    weekNumber: reference.weekNumber,
  });
}

export function getWeeksInWeekYear(weekYear: number): number {
  const firstWeek = getIsoWeekDate(weekYear, 1);
  return firstWeek.weeksInWeekYear;
}

export function getCalendarWeek(
  weekYear: number,
  weekNumber: number,
  weekStartDay: WeekStartDay,
): CalendarWeek {
  const weekCount = getWeeksInWeekYear(weekYear);
  if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > weekCount) {
    throw new RangeError(`Invalid calendar week: ${weekYear}-W${weekNumber}`);
  }
  const monday = getIsoWeekDate(weekYear, weekNumber);
  const startValue = weekStartDay === "sunday" ? monday.minus({ days: 1 }) : monday;
  const start = toLocalDate(startValue);
  return Object.freeze({
    weekYear,
    weekNumber,
    start,
    end: shiftPeriod(start, "daily", 6, weekStartDay),
  });
}

export function buildCalendarWeeks(
  weekYear: number,
  weekStartDay: WeekStartDay,
): readonly CalendarWeek[] {
  const weekCount = getWeeksInWeekYear(weekYear);
  const firstMonday = getIsoWeekDate(weekYear, 1);
  const firstStart = weekStartDay === "sunday"
    ? firstMonday.minus({ days: 1 })
    : firstMonday;
  return Object.freeze(
    Array.from({ length: weekCount }, (_, index) => {
      const startValue = firstStart.plus({ weeks: index });
      return Object.freeze({
        weekYear,
        weekNumber: index + 1,
        start: toLocalDate(startValue),
        end: toLocalDate(startValue.plus({ days: 6 })),
      });
    }),
  );
}

export function moveDateToCalendarWeek(
  date: LocalDate,
  weekYear: number,
  weekNumber: number,
  weekStartDay: WeekStartDay,
): LocalDate {
  const currentStart = getPeriodAnchor(date, "weekly", weekStartDay);
  const weekdayOffset = Math.round(
    toDateTime(date).diff(toDateTime(currentStart), "days").days,
  );
  const target = getCalendarWeek(weekYear, weekNumber, weekStartDay);
  return shiftPeriod(target.start, "daily", weekdayOffset, weekStartDay);
}

export function moveDateToCalendarWeekYear(
  date: LocalDate,
  weekYear: number,
  weekStartDay: WeekStartDay,
): LocalDate {
  const current = getCalendarWeekIdentity(date, weekStartDay);
  const targetWeek = Math.min(current.weekNumber, getWeeksInWeekYear(weekYear));
  return moveDateToCalendarWeek(date, weekYear, targetWeek, weekStartDay);
}

function getIsoWeekDate(weekYear: number, weekNumber: number): DateTime<true> {
  if (!Number.isInteger(weekYear)) {
    throw new RangeError("Calendar week year must be an integer");
  }
  const value = DateTime.fromObject(
    { weekYear, weekNumber, weekday: 1 },
    { zone: "UTC" },
  );
  if (!value.isValid) {
    throw new RangeError(`Invalid calendar week: ${weekYear}-W${weekNumber}`);
  }
  return value;
}
