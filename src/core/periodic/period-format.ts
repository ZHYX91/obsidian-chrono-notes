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
  const options = { locale, zone: "UTC" };
  if (!parts.some(isExtended)) {
    const parsed = DateTime.fromFormat(text, compileMomentParts(parts), options);
    return parsed.isValid ? parsed : null;
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
  const parsed = DateTime.fromFormat(
    hasYear ? text : `${text} ${String(year).padStart(4, "0")}`,
    hasYear ? nativeFormat : `${nativeFormat} yyyy`,
    options,
  );
  if (!parsed.isValid) return null;
  return parsed;
}
