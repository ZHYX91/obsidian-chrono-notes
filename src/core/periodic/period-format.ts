import { DateTime } from "luxon";

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
  if (!parts.some(isExtended)) {
    const parsed = DateTime.fromFormat(text, compileMomentParts(parts), options);
    return parsed.isValid ? parsed : parseLocalizedMonthName(text, parts, options, locale);
  }
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
      expression += explained.regex.source.replace(/^\^|\$$/g, "");
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
  const nativeFormat = compileMomentParts(nativeParts);
  const yearText = DateTime.utc(year).setLocale(locale).toFormat("yyyy");
  const parseText = hasYear ? text : text + " " + yearText;
  const parseFormat = hasYear ? nativeFormat : nativeFormat + " yyyy";
  const parseParts = hasYear ? nativeParts : [...nativeParts, { token: "raw", value: " yyyy" }];
  const parsed = DateTime.fromFormat(parseText, parseFormat, options);
  return parsed.isValid ? parsed : parseLocalizedMonthName(parseText, parseParts, options, locale);
}

function parseLocalizedMonthName(
  text: string,
  parts: readonly MomentFormatPart[],
  options: { locale: string; numberingSystem: string; zone: string },
  locale: string,
): DateTime<true> | null {
  const monthParts = parts.filter((part) => part.token === "MMM" || part.token === "MMMM");
  if (monthParts.length !== 1) return null;
  const monthPart = monthParts[0];
  if (monthPart === undefined) return null;
  const names = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    return { month, name: DateTime.utc(2000, month, 1).setLocale(locale).toFormat(monthPart.token ?? "MMMM") };
  }).sort((left, right) => right.name.length - left.name.length);
  const expression = new RegExp(names.map(({ name }) => escapeRegExp(name)).join("|"), "iu");
  const match = expression.exec(text);
  if (match === null) return null;
  const matchedName = match[0].toLocaleLowerCase(locale);
  const entry = names.find(({ name }) => name.toLocaleLowerCase(locale) === matchedName);
  if (entry === undefined) return null;
  const normalizedText = text.slice(0, match.index) + String(entry.month).padStart(2, "0")
    + text.slice(match.index + match[0].length);
  const normalizedParts = parts.map((part) =>
    part.token === "MMM" || part.token === "MMMM" ? { token: "MM", value: "MM" } : part);
  const parsed = DateTime.fromFormat(normalizedText, compileMomentParts(normalizedParts), options);
  return parsed.isValid ? parsed : null;
}

function escapeRegExp(value: string): string {
  return Array.from(value).map((character) =>
    "^$.*+?()[]{}|\\".includes(character) ? "\\" + character : character).join("");
}
