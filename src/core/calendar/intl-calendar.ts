import type {
  CalendarExtensionId,
  CalendarExtensionResult,
} from "./calendar-extension";
import {
  toUtcDate,
  type LocalDate,
} from "../periodic/periodic-date";

export const INTL_CALENDAR_IDS = [
  "coptic",
  "persian",
  "ethiopic",
  "hebrew",
  "indian",
  "islamic-civil",
  "islamic-umalqura",
] as const satisfies readonly CalendarExtensionId[];

export type IntlCalendarId = typeof INTL_CALENDAR_IDS[number];

type FormatStyle = "day" | "month-day" | "full";

interface CalendarIdentity {
  readonly year: string;
  readonly month: string;
}

const FORMATTER_CAPACITY = 64;
const FORMATTERS = new Map<string, Intl.DateTimeFormat>();
const EMPTY_EVENTS = Object.freeze([]);

export function isIntlCalendarSupported(
  calendar: IntlCalendarId,
  locale: string,
): boolean {
  try {
    return getFormatter(calendar, locale, "full").resolvedOptions().calendar === calendar;
  } catch {
    return false;
  }
}

export function getIntlCalendarDay(
  date: LocalDate,
  locale: string,
  calendar: IntlCalendarId,
): CalendarExtensionResult {
  if (!isIntlCalendarSupported(calendar, locale)) {
    throw new RangeError(`Unsupported Intl calendar: ${calendar}`);
  }

  const currentDate = toUtcDate(date);
  const previousDate = new Date(currentDate.getTime() - 86_400_000);
  const currentIdentity = getCalendarIdentity(currentDate, calendar, locale);
  const previousIdentity = getCalendarIdentity(previousDate, calendar, locale);
  const transition = currentIdentity.year !== previousIdentity.year
    ? "year-month"
    : currentIdentity.month !== previousIdentity.month
      ? "month"
      : null;
  const style: FormatStyle = transition === "year-month"
    ? "full"
    : transition === "month"
      ? "month-day"
      : "day";

  const full = formatFullDate(currentDate, calendar, locale);
  return Object.freeze({
    dateText: style === "full" ? full : getFormatter(calendar, locale, style).format(currentDate),
    events: EMPTY_EVENTS,
    transition,
    accessibilityText: full,
  });
}

function formatFullDate(date: Date, calendar: IntlCalendarId, locale: string): string {
  const formatter = getFormatter(calendar, locale, "full");
  if ((locale !== "zh-CN" && locale !== "zh-TW") || (calendar !== "coptic" && calendar !== "ethiopic")) {
    return formatter.format(date);
  }
  // ICU can leave these era names in Latin initials even in a Chinese date.
  const traditional = locale === "zh-TW";
  return formatter.formatToParts(date).map(part => {
    if (part.type !== "era") return part.value;
    if (calendar === "coptic" && part.value === "AM") return traditional ? "殉道紀元" : "殉道纪元";
    if (calendar === "ethiopic" && part.value === "AM") return traditional ? "恩典紀元" : "恩典纪元";
    if (calendar === "ethiopic" && part.value === "AA") return traditional ? "創世紀元" : "创世纪元";
    return part.value;
  }).join("");
}

export function clearIntlCalendarFormatterCache(): void {
  FORMATTERS.clear();
}

function getCalendarIdentity(
  date: Date,
  calendar: IntlCalendarId,
  locale: string,
): CalendarIdentity {
  const parts = getFormatter(calendar, locale, "full").formatToParts(date);
  return Object.freeze({
    year: getPart(parts, "year") ?? getPart(parts, "relatedYear") ?? "",
    month: getPart(parts, "month") ?? "",
  });
}

function getPart(
  parts: readonly Intl.DateTimeFormatPart[],
  type: string,
): string | null {
  return parts.find((part) => String(part.type) === type)?.value ?? null;
}

function getFormatter(
  calendar: IntlCalendarId,
  locale: string,
  style: FormatStyle,
): Intl.DateTimeFormat {
  const normalizedLocale = normalizeLocale(locale);
  const key = JSON.stringify([calendar, normalizedLocale, style]);
  const existing = touchFormatter(key);
  if (existing !== undefined) return existing;

  const options: Intl.DateTimeFormatOptions = {
    calendar,
    day: "numeric",
    timeZone: "UTC",
    ...(style === "day" ? {} : { month: style === "full" ? "long" : "short" }),
    ...(style === "full" ? { year: "numeric" } : {}),
  };
  const formatter = new Intl.DateTimeFormat(normalizedLocale, options);
  FORMATTERS.set(key, formatter);
  while (FORMATTERS.size > FORMATTER_CAPACITY) {
    const oldest = FORMATTERS.keys().next().value;
    if (oldest === undefined) break;
    FORMATTERS.delete(oldest);
  }
  return formatter;
}

function touchFormatter(key: string): Intl.DateTimeFormat | undefined {
  const existing = FORMATTERS.get(key);
  if (existing === undefined) return undefined;
  FORMATTERS.delete(key);
  FORMATTERS.set(key, existing);
  return existing;
}

function normalizeLocale(locale: string): string {
  try {
    return Intl.getCanonicalLocales(locale)[0] ?? "en";
  } catch {
    return "en";
  }
}
