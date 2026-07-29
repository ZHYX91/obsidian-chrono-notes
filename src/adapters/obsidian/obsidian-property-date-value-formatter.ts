import { moment } from "obsidian";

import { resolvePropertyMomentLocale } from
  "../../core/properties/property-date-display";
import type { PropertyDateValueFormatter } from "./obsidian-properties-date-display";

const CIVIL_DATE_TIME_VALUE =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/;

interface CivilDateTimeFields {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly millisecond: number;
  readonly hasTime: boolean;
}

export const OBSIDIAN_PROPERTY_DATE_VALUE_FORMATTER: PropertyDateValueFormatter = Object.freeze({
  formatMoment(value: string, pattern: string, locale: string) {
    const fields = parseCivilDateTime(value);
    if (fields === null) return null;
    // HTML date controls expose civil fields without a time zone. UTC is only
    // a stable field container here; it must not convert the displayed value.
    const parsed = moment.utc({
      year: fields.year,
      month: fields.month - 1,
      date: fields.day,
      hour: fields.hour,
      minute: fields.minute,
      second: fields.second,
      millisecond: fields.millisecond,
    });
    return parsed.isValid()
      ? parsed.locale(resolvePropertyMomentLocale(locale)).format(pattern)
      : null;
  },
  formatSystemDate(value: string) {
    const fields = parseCivilDateTime(value);
    if (fields === null) return null;
    const civilDate = createCivilDate(fields);
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
    const fields = parseCivilDateTime(value);
    if (fields === null || !fields.hasTime) return null;
    const civilDate = createCivilDate(fields);
    if (civilDate === null) return null;
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      ...(includeSeconds ? { second: "2-digit" } : {}),
      timeZone: "UTC",
    }).format(civilDate);
  },
});

function parseCivilDateTime(value: string): CivilDateTimeFields | null {
  const match = CIVIL_DATE_TIME_VALUE.exec(value);
  if (match === null) return null;
  const fraction = match[7] ?? "";
  const fields: CivilDateTimeFields = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] ?? 0),
    minute: Number(match[5] ?? 0),
    second: Number(match[6] ?? 0),
    millisecond: fraction.length === 0 ? 0 : Number(fraction.padEnd(3, "0")),
    hasTime: match[4] !== undefined,
  };
  return fields.year > 0 && createCivilDate(fields) !== null ? fields : null;
}

function createCivilDate(fields: CivilDateTimeFields): Date | null {
  const result = new Date(0);
  result.setUTCHours(0, 0, 0, 0);
  result.setUTCFullYear(fields.year, fields.month - 1, fields.day);
  result.setUTCHours(
    fields.hour,
    fields.minute,
    fields.second,
    fields.millisecond,
  );

  return result.getUTCFullYear() === fields.year &&
    result.getUTCMonth() === fields.month - 1 &&
    result.getUTCDate() === fields.day &&
    result.getUTCHours() === fields.hour &&
    result.getUTCMinutes() === fields.minute &&
    result.getUTCSeconds() === fields.second &&
    result.getUTCMilliseconds() === fields.millisecond
    ? result
    : null;
}
