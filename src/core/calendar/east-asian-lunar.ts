import { toUtcDate, type LocalDate } from "../periodic/periodic-date";
import type { CalendarExtensionResult } from "./calendar-extension";
import {
  UTC9_LUNAR_YEARS,
  VIETNAMESE_LUNAR_YEARS,
  type LunarYearRow,
} from "./east-asian-lunar-years";

type TableCalendar = "vietnamese-lunar" | "japanese-lunisolar" | "korean-lunar";
export type EastAsianFestival = "vn-new-year" | "vn-mid-autumn" | "vn-hung-kings"
  | "jp-moon-viewing" | "kr-new-year" | "kr-autumn";

export interface EastAsianLunarDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly isLeapMonth: boolean;
}

const CALENDARS = {
  "vietnamese-lunar": { first: 1976, last: 2050, firstRow: 1975, years: VIETNAMESE_LUNAR_YEARS },
  "japanese-lunisolar": { first: 1900, last: 2099, firstRow: 1899, years: UTC9_LUNAR_YEARS },
  // Full modern UTC+9 years through the last KASI conversion year.
  "korean-lunar": { first: 1962, last: 2050, firstRow: 1899, years: UTC9_LUNAR_YEARS },
} as const;
const DAY_MILLIS = 86_400_000;
const EMPTY_EVENTS = Object.freeze([]);

export function isEastAsianLunarDateSupported(date: LocalDate, calendar: TableCalendar): boolean {
  return date.year >= CALENDARS[calendar].first && date.year <= CALENDARS[calendar].last;
}

function lunarYearRow(rows: readonly LunarYearRow[], index: number): LunarYearRow {
  const row = rows[index];
  if (row === undefined) throw new RangeError("Missing lunisolar year");
  return row;
}

function lunarNewYear(year: number, row: LunarYearRow): number {
  return Date.UTC(year, 0, 1) / DAY_MILLIS + row[0];
}

export function getEastAsianLunarDate(date: LocalDate, calendar: TableCalendar): EastAsianLunarDate {
  if (!isEastAsianLunarDateSupported(date, calendar)) {
    throw new RangeError(`Date outside supported range for ${calendar}`);
  }
  const { firstRow, years } = CALENDARS[calendar];
  const dayNumber = toUtcDate(date).getTime() / DAY_MILLIS;
  let year = date.year;
  let row = lunarYearRow(years, year - firstRow);
  if (dayNumber < lunarNewYear(year, row)) {
    year--;
    row = lunarYearRow(years, year - firstRow);
  }
  let remaining = dayNumber - lunarNewYear(year, row);
  const [, leapMonth, lengths] = row;
  for (let index = 0; index < lengths.length; index++) {
    const days = lengths[index] === "1" ? 30 : 29;
    if (remaining < days) {
      const followsRegularMonth = leapMonth !== 0 && index >= leapMonth;
      return {
        year,
        month: index + 1 - Number(followsRegularMonth),
        day: remaining + 1,
        isLeapMonth: followsRegularMonth && index === leapMonth,
      };
    }
    remaining -= days;
  }
  throw new Error(`Incomplete lunar year ${year} for ${calendar}`);
}

function festivalForDate(date: EastAsianLunarDate, calendar: TableCalendar): EastAsianFestival | null {
  if (date.isLeapMonth) return null;
  if (calendar === "korean-lunar") {
    if (date.month === 1 && date.day === 1) return "kr-new-year";
    if (date.month === 8 && date.day === 15) return "kr-autumn";
    return null;
  }
  if (calendar === "japanese-lunisolar") {
    return date.month === 8 && date.day === 15 ? "jp-moon-viewing" : null;
  }
  if (date.month === 1 && date.day === 1) return "vn-new-year";
  if (date.month === 3 && date.day === 10) return "vn-hung-kings";
  if (date.month === 8 && date.day === 15) return "vn-mid-autumn";
  return null;
}

interface DateLayout {
  readonly number: Intl.NumberFormat;
  readonly full: readonly Intl.DateTimeFormatPart[];
  readonly monthDay: readonly Intl.DateTimeFormatPart[];
}

const layouts = new Map<string, DateLayout>();

function getLayout(locale: string): DateLayout {
  const cached = layouts.get(locale);
  if (cached !== undefined) return cached;
  let displayLocale: string;
  try {
    displayLocale = Intl.getCanonicalLocales(locale)[0] ?? "en";
  } catch {
    displayLocale = "en";
  }
  const options = {
    calendar: "gregory", timeZone: "UTC", month: "numeric", day: "numeric",
  } as const;
  // Take only the locale's field order, punctuation and bidirectional marks.
  // All numeric fields below come from the local lunisolar calendar.
  const sample = Date.UTC(2004, 10, 22);
  const layout = {
    number: new Intl.NumberFormat(displayLocale, { useGrouping: false }),
    full: new Intl.DateTimeFormat(displayLocale, { ...options, year: "numeric" }).formatToParts(sample),
    monthDay: new Intl.DateTimeFormat(displayLocale, options).formatToParts(sample),
  };
  if (layouts.size >= 32) layouts.clear();
  layouts.set(locale, layout);
  return layout;
}

export function getEastAsianLunarDay(
  date: LocalDate,
  locale: string,
  calendar: TableCalendar,
  formatLeapMonth: (month: string) => string,
): CalendarExtensionResult & { readonly lunarDate: EastAsianLunarDate; readonly festival: EastAsianFestival | null } {
  const lunarDate = getEastAsianLunarDate(date, calendar);
  const { number, full, monthDay } = getLayout(locale);
  const dayText = number.format(lunarDate.day);
  const month = number.format(lunarDate.month);
  const monthText = lunarDate.isLeapMonth ? formatLeapMonth(month) : month;
  const format = (parts: readonly Intl.DateTimeFormatPart[]) => parts.map((part) => {
    if (part.type === "day") return dayText;
    if (part.type === "month") return monthText;
    if (part.type === "year") return number.format(lunarDate.year);
    return part.value;
  }).join("");
  const accessibilityText = format(full);
  const transition = lunarDate.day !== 1 ? null
    : lunarDate.month === 1 && !lunarDate.isLeapMonth ? "year-month" : "month";
  const dateText = transition === "year-month" ? accessibilityText
    : transition === "month" ? format(monthDay) : dayText;
  return {
    lunarDate,
    festival: festivalForDate(lunarDate, calendar),
    dateText,
    accessibilityText,
    transition,
    events: EMPTY_EVENTS,
  };
}
