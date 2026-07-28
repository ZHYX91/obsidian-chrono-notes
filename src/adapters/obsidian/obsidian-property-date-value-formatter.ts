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
const parseMoment = moment as unknown as (
  value: string,
  formats?: readonly string[],
  strict?: boolean,
) => {
  isValid(): boolean;
  locale(locale: string): { format(pattern: string): string };
};

export const OBSIDIAN_PROPERTY_DATE_VALUE_FORMATTER: PropertyDateValueFormatter = Object.freeze({
  formatMoment(value: string, pattern: string, locale: string) {
    const parsed = parseMoment(value, DATE_TIME_INPUT_FORMATS, true);
    return parsed.isValid() ? parsed.locale(locale).format(pattern) : null;
  },
  formatSystemDate(value: string) {
    const match = DATE_VALUE.exec(value);
    if (match === null) return null;
    return new Intl.DateTimeFormat(undefined, {
      calendar: "gregory",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(createLocalDate(match, value));
  },
  formatSystemTime(value: string, includeSeconds: boolean) {
    const dateMatch = DATE_VALUE.exec(value);
    const timeMatch = TIME_VALUE.exec(value);
    if (dateMatch === null || timeMatch === null) return null;
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      ...(includeSeconds ? { second: "2-digit" } : {}),
    }).format(createLocalDate(dateMatch, value, timeMatch));
  },
});

function createLocalDate(
  dateMatch: RegExpExecArray,
  source: string,
  timeMatch: RegExpExecArray | null = TIME_VALUE.exec(source),
): Date {
  return new Date(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch?.[1] ?? 0),
    Number(timeMatch?.[2] ?? 0),
    Number(timeMatch?.[3] ?? 0),
  );
}
