import { DateTime, type DateTimeOptions } from "luxon";

import {
  compileMomentParts,
  parseMomentFormat,
  type MomentFormatPart,
  type MomentFormatProfile,
} from "./moment-format";
import { getCenturyNumber, getDecadeStart } from "./periodic-date";

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

/** Parse extended fields as constraints, then let Luxon parse the civil fields. */
export function parsePeriodDate(text: string, format: string, locale: string): DateTime<true> | null {
  const parts = parseMomentFormat(format, "date");
  if (parts === null) return null;
  // Luxon's parser defaults to Latin digits even when its formatter uses a
  // locale's native digits. Resolve the same numbering system for both.
  const numberingSystem = DateTime.fromMillis(0, { locale, zone: "UTC" })
    .resolvedLocaleOptions().numberingSystem;
  const options = { locale, numberingSystem, zone: "UTC" };
  if (!parts.some(isExtended)) return parseCivilFields(text, parts, options);
  let expression = "";
  const fields: { name: string; token: string }[] = [];
  for (const part of parts) {
    if (isExtended(part)) {
      const name = `period${fields.length}`;
      fields.push({ name, token: part.token ?? "" });
      expression += `(?<${name}>[0-9]{${part.token === "DEC" ? "4" : "1,3"}})`;
    } else {
      const explained = DateTime.fromFormatExplain("", compileMomentParts([part]), options);
      if (explained.regex === undefined) return null;
      const field = explained.regex.source.slice(1, -1);
      if (isMonthName(part)) {
        // Some locales format named months as bare numbers, including Japanese.
        const numeric = DateTime.fromFormatExplain("", "M", options).regex;
        if (numeric === undefined) return null;
        expression += `(?:${field}|${numeric.source.slice(1, -1)})`;
      } else expression += field;
    }
  }
  const match = new RegExp(`^${expression}$`, "i").exec(text);
  if (match === null) return null;
  const values = fields.map((field) => Number(match.groups?.[field.name]));
  const decade = fields.findIndex((field) => field.token === "DEC");
  const century = fields.findIndex((field) => field.token === "CEN");
  const year = decade !== -1 ? values[decade] ?? 0 : ((values[century] ?? 0) - 1) * 100 + 1;
  if (year < 0 || year > 9999) return null;
  let fieldIndex = 0;
  const nativeParts = parts.map((part) => isExtended(part)
    ? { token: null, value: match.groups?.[fields[fieldIndex++]?.name ?? ""] ?? "" }
    : part);
  const hasYear = parts.some((part) => ["YYYY", "YY", "GGGG", "GG"].includes(part.token ?? ""));
  if (hasYear) return parseCivilFields(text, nativeParts, options);
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
): DateTime<true> | null {
  const format = compileMomentParts(parts);
  const parsed = DateTime.fromFormat(text, format, options);
  if (!parts.some(isMonthName)) return parsed.isValid ? parsed : null;
  if (parsed.isValid && parsed.toFormat(format) === text) return parsed;

  // Only replace month tokens; year digits and quoted literals may contain the same number.
  const numericFormat = compileMomentParts(parts.map((part) =>
    isMonthName(part) ? { token: "M", value: "M" } : part));
  const numeric = DateTime.fromFormat(text, numericFormat, options);
  if (numeric.isValid && numeric.toFormat(format) === text) return numeric;

  // A locale's display calendar can change month partway through a Gregorian month.
  // Preserve the filename emitted for the actual civil day, including localized digits.
  const { result } = DateTime.fromFormatExplain(text, format, options);
  if (typeof result?.month !== "number") return null;
  for (let month = 1; month <= 12; month += 1) {
    const candidate = DateTime.fromObject({ ...result, month }, options);
    if (candidate.isValid && candidate.toFormat(format) === text) return candidate;
  }
  return null;
}
