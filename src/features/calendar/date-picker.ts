import { DateTime } from "luxon";

import { buildMonthGrid, type MonthGrid } from "../../core/calendar/month-grid";
import {
  parseLocalDateKey,
  toDateTime,
  type LocalDate,
  type WeekStartDay,
} from "../../core/periodic/periodic-date";

export interface CalendarMonth {
  readonly year: number;
  readonly month: number;
}

export interface DatePickerModel {
  readonly selectedDate: LocalDate;
  readonly displayMonth: CalendarMonth;
  readonly weekStartDay: WeekStartDay;
  readonly grid: MonthGrid;
}

export function createDatePickerModel(
  selectedDate: LocalDate,
  displayMonth: CalendarMonth,
  weekStartDay: WeekStartDay,
): DatePickerModel {
  toDateTime(selectedDate);
  const grid = buildMonthGrid(displayMonth.year, displayMonth.month, weekStartDay);
  return Object.freeze({
    selectedDate: freezeDate(selectedDate),
    displayMonth: freezeMonth(displayMonth),
    weekStartDay,
    grid,
  });
}

export function parseDateInput(value: string): LocalDate | null {
  const input = value.trim();
  const compact = input.match(/^(\d{4})(\d{2})(\d{2})$/);
  const separated = input.match(/^(\d{4})([-/.])(\d{2})\2(\d{2})$/);
  const parts = compact === null
    ? separated === null ? null : [separated[1], separated[3], separated[4]]
    : [compact[1], compact[2], compact[3]];
  if (parts === null || parts.some((part) => part === undefined)) return null;
  return parseLocalDateKey(`${parts[0]}-${parts[1]}-${parts[2]}`);
}

export function shiftPickerMonth(month: CalendarMonth, amount: number): CalendarMonth {
  return shiftMonth(month, { months: validateShift(amount) });
}

export function shiftPickerYear(month: CalendarMonth, amount: number): CalendarMonth {
  return shiftMonth(month, { years: validateShift(amount) });
}

function shiftMonth(
  month: CalendarMonth,
  duration: Readonly<{ months?: number; years?: number }>,
): CalendarMonth {
  const current = DateTime.fromObject(
    { year: month.year, month: month.month, day: 1 },
    { zone: "UTC" },
  );
  if (!current.isValid || current.year !== month.year || current.month !== month.month) {
    throw new RangeError(`Invalid calendar month: ${month.year}-${month.month}`);
  }
  const shifted = current.plus(duration);
  if (!shifted.isValid) throw new RangeError("Date picker shift is out of range");
  return Object.freeze({ year: shifted.year, month: shifted.month });
}

function validateShift(amount: number): number {
  if (!Number.isInteger(amount)) {
    throw new RangeError("Date picker shift must be an integer");
  }
  return amount;
}

function freezeDate(date: LocalDate): LocalDate {
  return Object.freeze({ year: date.year, month: date.month, day: date.day });
}

function freezeMonth(month: CalendarMonth): CalendarMonth {
  return Object.freeze({ year: month.year, month: month.month });
}
