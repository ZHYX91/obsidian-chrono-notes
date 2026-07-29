import { moment } from "obsidian";

import type { PropertyDateValueFormatter } from "./obsidian-properties-date-display";

const DATE_VALUE = /^(\d{4})-(\d{2})-(\d{2})/;
const TIME_VALUE = /T(\d{2}):(\d{2})(?::(\d{2}))?/;
const DATE_TIME_INPUT_FORMATS = Object.freeze([
  "YYYY-MM-DD",
  "YYYY-MM-DDTHH:mm",
  "YYYY-MM-DDTHH:mm:ss",
  "YYYY-MM-DDTHH:mm:ss.SSS",
]);

export const OBSIDIAN_PROPERTY_DATE_VALUE_FORMATTER: PropertyDateValueFormatter = Object.freeze({
  formatMoment(value: string, pattern: string, locale: string) {
    // HTML date controls expose civil fields without a time zone. UTC is only
    // a stable field container here; it must not convert the displayed value.
    const parsed = moment.utc(value, [...DATE_TIME_INPUT_FORMATS], true);
    return parsed.isValid() ? parsed.locale(locale).format(pattern) : null;
  },
  formatSystemDate(value: string) {
    const match = DATE_VALUE.exec(value);
    if (match === null) return null;
    const civilDate = createCivilDate(match, value);
    if (civilDate === null) return null;
    return new Intl.DateTimeFormat(undefined, {
      calendar: "gregory",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "UTC",
    }).format(civilDate);
  },
  formatSystemTime(value: string, includeSeconds: boolean) {
    const dateMatch = DATE_VALUE.exec(value);
    const timeMatch = TIME_VALUE.exec(value);
    if (dateMatch === null || timeMatch === null) return null;
    const civilDate = createCivilDate(dateMatch, value, timeMatch);
    if (civilDate === null) return null;
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      ...(includeSeconds ? { second: "2-digit" } : {}),
      timeZone: "UTC",
    }).format(civilDate);
  },
});

function createCivilDate(
  dateMatch: RegExpExecArray,
  source: string,
  timeMatch: RegExpExecArray | null = TIME_VALUE.exec(source),
): Date | null {
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]) - 1;
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch?.[1] ?? 0);
  const minute = Number(timeMatch?.[2] ?? 0);
  const second = Number(timeMatch?.[3] ?? 0);
  const result = new Date(0);
  result.setUTCHours(0, 0, 0, 0);
  result.setUTCFullYear(year, month, day);
  result.setUTCHours(hour, minute, second, 0);

  return result.getUTCFullYear() === year &&
    result.getUTCMonth() === month &&
    result.getUTCDate() === day &&
    result.getUTCHours() === hour &&
    result.getUTCMinutes() === minute &&
    result.getUTCSeconds() === second
    ? result
    : null;
}
