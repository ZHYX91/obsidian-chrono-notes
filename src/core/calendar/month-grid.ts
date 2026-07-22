import { DateTime } from "luxon";

import { getCalendarWeekIdentity } from "../periodic/calendar-week";
import {
  toLocalDate,
  type LocalDate,
  type WeekStartDay,
} from "../periodic/periodic-date";

export interface MonthGridDay {
  readonly date: LocalDate;
  readonly inCurrentMonth: boolean;
}

export interface MonthGridWeek {
  readonly weekNumber: number;
  readonly weekYear: number;
  readonly days: readonly MonthGridDay[];
}

export interface MonthGrid {
  readonly year: number;
  readonly month: number;
  readonly weekStartDay: WeekStartDay;
  readonly days: readonly MonthGridDay[];
  readonly weeks: readonly MonthGridWeek[];
}

const DAYS_PER_WEEK = 7;

export function buildMonthGrid(
  year: number,
  month: number,
  weekStartDay: WeekStartDay,
): MonthGrid {
  const firstDay = DateTime.fromObject({ year, month, day: 1 }, { zone: "UTC" });
  if (!firstDay.isValid || firstDay.year !== year || firstDay.month !== month) {
    throw new RangeError(`Invalid calendar month: ${year}-${month}`);
  }

  const offset =
    weekStartDay === "sunday" ? firstDay.weekday % DAYS_PER_WEEK : firstDay.weekday - 1;
  const gridStart = firstDay.minus({ days: offset });
  const lastDay = firstDay.endOf("month").startOf("day");
  const lastDayOffset = weekStartDay === "sunday"
    ? lastDay.weekday % DAYS_PER_WEEK
    : lastDay.weekday - 1;
  const gridEnd = lastDay.plus({ days: DAYS_PER_WEEK - 1 - lastDayOffset });
  const dayCount = Math.round(gridEnd.diff(gridStart, "days").days) + 1;
  const days: MonthGridDay[] = [];
  for (let index = 0; index < dayCount; index += 1) {
    const value = gridStart.plus({ days: index });
    days.push(
      Object.freeze({
        date: toLocalDate(value),
        inCurrentMonth: value.month === month,
      }),
    );
  }

  const weeks: MonthGridWeek[] = [];
  const weekCount = dayCount / DAYS_PER_WEEK;
  for (let index = 0; index < weekCount; index += 1) {
    const weekDays = Object.freeze(
      days.slice(index * DAYS_PER_WEEK, (index + 1) * DAYS_PER_WEEK),
    );
    const start = gridStart.plus({ weeks: index });
    const identity = getCalendarWeekIdentity(toLocalDate(start), weekStartDay);
    weeks.push(
      Object.freeze({
        weekNumber: identity.weekNumber,
        weekYear: identity.weekYear,
        days: weekDays,
      }),
    );
  }

  return Object.freeze({
    year,
    month,
    weekStartDay,
    days: Object.freeze(days),
    weeks: Object.freeze(weeks),
  });
}
