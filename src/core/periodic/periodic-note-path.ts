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
  readonly pathLocale?: string | undefined;
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

    const formatted = formatPeriodDate(
      filenameDate.setLocale(resolvePathLocale(rule)),
      rule.pattern,
      "date",
      anchor.year,
    );
    if (formatted === null) return null;
    const parsedAnchor = parsePathAnchor(formatted, rule, options);
    // Formatting is also used by queries and commands. A path that parses to
    // another period must never become an actionable existing or new note.
    return parsedAnchor !== null &&
      parsedAnchor.year === anchor.year && parsedAnchor.month === anchor.month &&
      parsedAnchor.day === anchor.day
      ? `${formatted}.md`
      : null;
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
    const anchor = parsePathAnchor(path.slice(0, -3), rule, options);
    if (anchor === null) return null;
    return formatPeriodicNotePath(anchor, rule, options) === path ? anchor : null;
  } catch {
    return null;
  }
}

function parsePathAnchor(
  text: string,
  rule: PeriodicNotePathRule,
  options: PeriodicNotePathOptions,
): LocalDate | null {
  const parsed = parsePeriodDate(text, rule.pattern, resolvePathLocale(rule));
  return parsed === null ? null : getPeriodAnchor(
    toLocalDate(parsed), rule.noteType, options.weekStartDay,
  );
}

function resolvePathLocale(rule: PeriodicNotePathRule): string {
  return rule.pathLocale?.trim() || "en";
}

/** Every pattern must identify its note period, including patterns without DEC/CEN. */
function hasPeriodIdentity(rule: PeriodicNotePathRule): boolean {
  if (rule.pattern.trim().length === 0) return false;
  const parts = parseMomentFormat(rule.pattern, "date");
  if (parts === null) return false;
  const tokens = new Set(parts.map((part) => part.token));
  const year = tokens.has("YYYY") || tokens.has("YY");
  const month = ["M", "MM", "MMM", "MMMM"].some((token) => tokens.has(token));
  const day = tokens.has("D") || tokens.has("DD");
  const week = (tokens.has("GGGG") || tokens.has("GG")) &&
    (tokens.has("W") || tokens.has("WW"));
  const weekday = tokens.has("ddd") || tokens.has("dddd");
  switch (rule.noteType) {
    case "daily": return (year && month && day) || (week && weekday);
    case "weekly": return (year && month && day) || week;
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
