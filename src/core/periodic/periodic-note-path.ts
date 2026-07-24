import { DateTime } from "luxon";

import {
  getPeriodAnchor,
  toDateTime,
  toLocalDate,
  type LocalDate,
  type PeriodicNoteType,
  type WeekStartDay,
} from "./periodic-date";
import { compileMomentFormat } from "./moment-format";

export interface PeriodicNotePathRule {
  readonly noteType: PeriodicNoteType;
  readonly pattern: string;
}

export interface PeriodicNotePathOptions {
  readonly locale: string;
  readonly weekStartDay: WeekStartDay;
}

export interface PeriodicNotePathMatch {
  readonly noteType: PeriodicNoteType;
  readonly date: LocalDate;
}

export function formatPeriodicNotePath(
  selectedDate: LocalDate,
  rule: PeriodicNotePathRule,
  options: PeriodicNotePathOptions,
): string | null {
  if (rule.pattern.trim().length === 0) return null;
  const format = compileMomentFormat(rule.pattern, "date");
  if (format === null) return null;

  const anchor = getPeriodAnchor(selectedDate, rule.noteType, options.weekStartDay);
  let filenameDate = toDateTime(anchor);
  if (rule.noteType === "weekly" && options.weekStartDay === "sunday") {
    filenameDate = filenameDate.plus({ days: 1 });
  }

  try {
    return `${filenameDate.setLocale(options.locale).toFormat(format)}.md`;
  } catch {
    return null;
  }
}

export function parsePeriodicNotePath(
  path: string,
  rule: PeriodicNotePathRule,
  options: PeriodicNotePathOptions,
): LocalDate | null {
  if (rule.pattern.trim().length === 0 || !path.endsWith(".md")) return null;
  const format = compileMomentFormat(rule.pattern, "date");
  if (format === null) return null;

  try {
    const parsed = DateTime.fromFormat(path.slice(0, -3), format, {
      locale: options.locale,
      zone: "UTC",
    });
    if (!parsed.isValid) return null;

    const anchor = getPeriodAnchor(
      toLocalDate(parsed),
      rule.noteType,
      options.weekStartDay,
    );
    return formatPeriodicNotePath(anchor, rule, options) === path ? anchor : null;
  } catch {
    return null;
  }
}

/** Resolve configured rules in caller-provided priority order. */
export function findPeriodicNotePathMatch(
  path: string,
  rules: readonly PeriodicNotePathRule[],
  options: PeriodicNotePathOptions,
): PeriodicNotePathMatch | null {
  for (const rule of rules) {
    const date = parsePeriodicNotePath(path, rule, options);
    if (date !== null) {
      return Object.freeze({ noteType: rule.noteType, date });
    }
  }
  return null;
}
