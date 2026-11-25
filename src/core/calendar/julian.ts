import { toUtcDate, type LocalDate } from "../periodic/periodic-date";
import type { CalendarExtensionResult } from "./calendar-extension";

const DAY_MS = 86_400_000;
const UNIX_EPOCH_JDN = 2_440_588;

/** Integer Julian day numbers at noon; UTC midnight identifies the same civil day. */
export function toJulianDate(date: LocalDate): LocalDate {
  const dayNumber = Math.floor(toUtcDate(date).getTime() / DAY_MS) + UNIX_EPOCH_JDN;
  const shifted = dayNumber + 32_082;
  const yearIndex = Math.floor((4 * shifted + 3) / 1_461);
  const yearDay = shifted - Math.floor(1_461 * yearIndex / 4);
  const monthIndex = Math.floor((5 * yearDay + 2) / 153);
  const janFeb = Math.floor(monthIndex / 10);
  return {
    year: yearIndex - 4_800 + janFeb,
    month: monthIndex + 3 - 12 * janFeb,
    day: yearDay - Math.floor((153 * monthIndex + 2) / 5) + 1,
  };
}

interface JulianFormatters {
  day: Intl.DateTimeFormat;
  monthDay: Intl.DateTimeFormat;
  full: Intl.DateTimeFormat;
  year: Intl.NumberFormat;
}

const formatters = new Map<string, JulianFormatters>();

function getFormatters(locale: string): JulianFormatters {
  const cached = formatters.get(locale);
  if (cached !== undefined) return cached;
  const base = { calendar: "gregory", timeZone: "UTC", day: "numeric" } as const;
  const result = {
    day: new Intl.DateTimeFormat(locale, base),
    monthDay: new Intl.DateTimeFormat(locale, { ...base, month: "short" }),
    full: new Intl.DateTimeFormat(locale, { ...base, month: "long", year: "numeric" }),
    year: new Intl.NumberFormat(locale, { useGrouping: false }),
  };
  if (formatters.size >= 32) formatters.clear();
  formatters.set(locale, result);
  return result;
}

export function getJulianDay(date: LocalDate, locale: string): CalendarExtensionResult {
  const julian = toJulianDate(date);
  const formats = getFormatters(locale);
  // A leap-year stand-in preserves Julian February 29 even in a Gregorian common year.
  const standIn = new Date(Date.UTC(2000, julian.month - 1, julian.day));
  const full = formats.full.formatToParts(standIn).map(part =>
    part.type === "year" ? formats.year.format(julian.year) : part.value).join("");
  const transition = julian.day !== 1 ? null : julian.month === 1 ? "year-month" : "month";
  return Object.freeze({
    dateText: transition === "year-month" ? full :
      (transition === "month" ? formats.monthDay : formats.day).format(standIn),
    accessibilityText: full,
    events: Object.freeze([]),
    transition,
  });
}
