import {
  getPeriodAnchor,
  toDateTime,
  toLocalDate,
  type LocalDate,
  type PeriodicNoteType,
  type WeekStartDay,
} from "./periodic-date";
import { formatPeriodDate, parsePeriodDate } from "./period-format";
import { parseMomentFormat } from "./moment-format";

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
  if (!hasPeriodIdentity(rule)) return null;

  try {
    const anchor = getPeriodAnchor(selectedDate, rule.noteType, options.weekStartDay);
    let filenameDate = toDateTime(anchor);
    if (rule.noteType === "weekly" && options.weekStartDay === "sunday") {
      filenameDate = filenameDate.plus({ days: 1 });
    }

    const formatted = formatPeriodDate(filenameDate.setLocale(options.locale), rule.pattern, "date", anchor.year);
    return formatted === null ? null : `${formatted}.md`;
  } catch {
    return null;
  }
}

export function parsePeriodicNotePath(
  path: string,
  rule: PeriodicNotePathRule,
  options: PeriodicNotePathOptions,
): LocalDate | null {
  if (!hasPeriodIdentity(rule) || !path.endsWith(".md")) return null;

  try {
    const parsed = parsePeriodDate(path.slice(0, -3), rule.pattern, options.locale);
    if (parsed === null || !parsed.isValid) return null;

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

/** Coarse grouping tokens cannot replace the identity of a finer note period. */
function hasPeriodIdentity(rule: PeriodicNotePathRule): boolean {
  if (rule.pattern.trim().length === 0) return false;
  const parts = parseMomentFormat(rule.pattern, "date");
  if (parts === null) return false;
  const tokens = new Set(parts.map((part) => part.token));
  if (!tokens.has("DEC") && !tokens.has("CEN")) return true;
  const year = tokens.has("YYYY") || tokens.has("YY");
  const month = ["M", "MM", "MMM", "MMMM"].some((token) => tokens.has(token));
  const day = tokens.has("D") || tokens.has("DD");
  switch (rule.noteType) {
    case "daily": return year && month && day;
    case "weekly": return (year && month && day) ||
      ((tokens.has("GGGG") || tokens.has("GG")) && (tokens.has("W") || tokens.has("WW")));
    case "monthly": return year && month;
    case "quarterly": return year && (month || tokens.has("Q"));
    case "yearly": return year;
    case "decadal": return tokens.has("DEC") || year;
    case "century": return tokens.has("CEN") || year;
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
