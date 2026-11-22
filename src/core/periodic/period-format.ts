import { DateTime, type DateTimeOptions } from "luxon";

import {
  compileMomentParts,
  parseMomentFormat,
  type MomentFormatPart,
  type MomentFormatProfile,
} from "./moment-format";
import { getCenturyNumber, getDecadeStart, type PeriodicNoteType } from "./periodic-date";

function isExtended(part: MomentFormatPart): boolean {
  return part.token === "DEC" || part.token === "CEN";
}

function extendParts(parts: readonly MomentFormatPart[], year: number): readonly MomentFormatPart[] {
  return parts.map((part) => isExtended(part)
    ? { token: null, value: part.token === "DEC"
      ? String(getDecadeStart(year)).padStart(4, "0")
      : String(getCenturyNumber(year)) }
    : part);
}

export function formatPeriodDate(
  value: DateTime,
  format: string,
  profile: MomentFormatProfile = "date-time",
  periodYear: number = value.year,
): string | null {
  const parts = parseMomentFormat(format, profile);
  if (parts === null || !value.isValid) return null;
  try {
    return value.toFormat(compileMomentParts(extendParts(parts, periodYear)));
  } catch {
    return null;
  }
}

const CIVIL_YEAR_CONSTRAINTS = new Set(["DEC", "CEN", "GGGG", "GG", "WW", "W"]);
const CIVIL_MONTH_CONSTRAINTS = new Set([...CIVIL_YEAR_CONSTRAINTS, "Q"]);
const ISO_WEEK_CONSTRAINTS = new Set(["DEC", "CEN", "YYYY", "YY", "M", "MM", "MMM", "MMMM", "D", "DD", "Q"]);

function getPathConstraintTokens(parts: readonly MomentFormatPart[], noteType: PeriodicNoteType): ReadonlySet<string> {
  const tokens = new Set(parts.map((part) => part.token));
  const hasMonth = ["M", "MM", "MMM", "MMMM"].some((token) => tokens.has(token));
  const hasCalendarYear = tokens.has("YYYY") || tokens.has("YY");
  const hasIsoWeek = (tokens.has("GGGG") || tokens.has("GG")) &&
    (tokens.has("WW") || tokens.has("W"));
  // Complete civil dates can carry ISO week folders. Week-based identities can
  // carry a civil year folder whose year differs from the ISO year over New Year.
  const hasCivilDay = hasMonth && (tokens.has("D") || tokens.has("DD"));
  if (hasIsoWeek && !(hasCalendarYear &&
    (hasCivilDay || (noteType !== "daily" && noteType !== "weekly")))) return ISO_WEEK_CONSTRAINTS;
  return hasMonth ? CIVIL_MONTH_CONSTRAINTS : CIVIL_YEAR_CONSTRAINTS;
}

/** Parse one date identity; the path round trip validates redundant directory fields. */
export function parsePeriodDates(
  text: string, format: string, locale: string, noteType: PeriodicNoteType,
): readonly DateTime<true>[] {
  const parts = parseMomentFormat(format, "date");
  if (parts === null) return [];
  // Luxon's parser defaults to Latin digits even when its formatter uses a
  // locale's native digits. Resolve the same numbering system for both.
  const numberingSystem = DateTime.fromMillis(0, { locale, zone: "UTC" })
    .resolvedLocaleOptions().numberingSystem;
  const options = { locale, numberingSystem, zone: "UTC" };
  const constraints = getPathConstraintTokens(parts, noteType);
  if (!parts.some((part) => constraints.has(part.token ?? ""))) return parseCivilFields(text, parts, options);
  let expression = "";
  const fields = new Map<MomentFormatPart, string>();
  for (const part of parts) {
    let pattern: string;
    if (isExtended(part)) {
      pattern = `[0-9]{${part.token === "DEC" ? "4" : "1,3"}}`;
    } else {
      const explained = DateTime.fromFormatExplain("", compileMomentParts([part]), options);
      if (explained.regex === undefined) return [];
      pattern = explained.regex.source.slice(1, -1);
      if (isMonthName(part)) {
        // Some locales format named months as bare numbers, including Japanese.
        const numeric = DateTime.fromFormatExplain("", "M", options).regex;
        if (numeric === undefined) return [];
        pattern = `(?:${pattern}|${numeric.source.slice(1, -1)})`;
      }
    }
    if (part.token !== null && constraints.has(part.token)) {
      const name = `period${fields.size}`;
      fields.set(part, name);
      expression += `(?<${name}>${pattern})`;
    } else expression += pattern;
  }
  const match = new RegExp(`^${expression}$`, "i").exec(text);
  if (!match?.groups) return [];
  const captures = match.groups;
  const nativeParts = parts.map((part) => {
    const name = fields.get(part);
    return name === undefined ? part : { token: null, value: captures[name]! };
  });
  const hasYear = nativeParts.some((part) => ["YYYY", "YY", "GGGG", "GG"].includes(part.token ?? ""));
  if (hasYear) return parseCivilFields(text, nativeParts, options);

  const anchor = parts.find((part) => part.token === "DEC") ?? parts.find((part) => part.token === "CEN");
  if (!anchor) return [];
  const period = Number(captures[fields.get(anchor)!]);
  const year = anchor.token === "DEC" ? period : (period - 1) * 100 + 1;
  if (year < 0 || year > 9999) return [];
  const yearText = DateTime.utc(year).setLocale(locale).toFormat("yyyy");
  return parseCivilFields(`${text} ${yearText}`, [
    ...nativeParts, { token: null, value: " " }, { token: "YYYY", value: "yyyy" },
  ], options);
}

function isMonthName(part: MomentFormatPart): boolean {
  return part.token === "MMM" || part.token === "MMMM";
}

function parseCivilFields(
  text: string,
  parts: readonly MomentFormatPart[],
  options: DateTimeOptions,
): readonly DateTime<true>[] {
  const format = compileMomentParts(parts);
  const parsed = DateTime.fromFormat(text, format, options);
  if (!parts.some(isMonthName)) return parsed.isValid ? [parsed] : [];

  // In a Gregorian display calendar each named month has a fixed civil month.
  // Other display calendars can emit the same month name for two civil dates.
  const candidates = new Map<number, DateTime<true>>();
  const consider = (value: DateTime<true> | DateTime<false>): void => {
    if (value.isValid && value.toFormat(format) === text) candidates.set(value.toMillis(), value);
  };
  consider(parsed);
  // Some locales format named months as numbers. Preserve the year and literals.
  const numericFormat = compileMomentParts(parts.map((part) =>
    isMonthName(part) ? { token: "M", value: "M" } : part));
  if (candidates.size === 0) consider(DateTime.fromFormat(text, numericFormat, options));

  const displayCalendar = DateTime.fromMillis(0, options).resolvedLocaleOptions().outputCalendar;
  if (displayCalendar !== "gregory" && displayCalendar !== "iso8601") {
    const { result } = DateTime.fromFormatExplain(text, format, options);
    if (typeof result?.month === "number") {
      for (let month = 1; month <= 12; month += 1) {
        consider(DateTime.fromObject({ ...result, month }, options));
      }
    }
  }
  return [...candidates.values()];
}
