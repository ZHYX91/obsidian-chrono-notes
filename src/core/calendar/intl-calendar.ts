import type {
  CalendarOverlayId,
  CalendarOverlayResult,
} from "./calendar-overlay";
import {
  toUtcDate,
  type LocalDate,
} from "../periodic/periodic-date";

export const INTL_CALENDAR_IDS = [
  "persian",
  "ethiopic",
  "hebrew",
  "indian",
  "islamic-civil",
  "islamic-umalqura",
] as const satisfies readonly CalendarOverlayId[];

export type IntlCalendarId = typeof INTL_CALENDAR_IDS[number];

type FormatStyle = "day" | "month-day" | "full";

interface CalendarIdentity {
  readonly year: string;
  readonly month: string;
}

const FORMATTER_CAPACITY = 64;
const FORMATTERS = new Map<string, Intl.DateTimeFormat>();

export function isIntlCalendarId(value: CalendarOverlayId): value is IntlCalendarId {
  return (INTL_CALENDAR_IDS as readonly string[]).includes(value);
}

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
): CalendarOverlayResult {
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

  return Object.freeze({
    dateText: getFormatter(calendar, locale, style).format(currentDate),
    eventText: null,
    eventKind: null,
    transition,
    accessibilityText: getFormatter(calendar, locale, "full").format(currentDate),
  });
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
    const oldest = FORMATTERS.keys().next().value as string | undefined;
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
