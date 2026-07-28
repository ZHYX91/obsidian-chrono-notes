export type PropertyDateDisplayFormat =
  | "system"
  | "ymd-dash"
  | "ymd-slash"
  | "ymd-slash-padded"
  | "dmy-slash"
  | "mdy-slash"
  | "custom";

export type PropertyTimeDisplayFormat =
  | "system"
  | "24-hour"
  | "24-hour-seconds"
  | "12-hour"
  | "12-hour-seconds"
  | "custom";

export type PropertyDateFieldOrder = "ymd" | "dmy" | "mdy";

export const MAX_PROPERTY_DATE_FORMAT_LENGTH = 80;

const DATE_PATTERNS: Readonly<
  Record<Exclude<PropertyDateDisplayFormat, "system" | "custom">, string>
> = Object.freeze({
  "ymd-dash": "YYYY-MM-DD",
  "ymd-slash": "YYYY/M/D",
  "ymd-slash-padded": "YYYY/MM/DD",
  "dmy-slash": "DD/MM/YYYY",
  "mdy-slash": "MM/DD/YYYY",
});

const TIME_PATTERNS: Readonly<
  Record<Exclude<PropertyTimeDisplayFormat, "system" | "custom">, string>
> = Object.freeze({
  "24-hour": "HH:mm",
  "24-hour-seconds": "HH:mm:ss",
  "12-hour": "h:mm A",
  "12-hour-seconds": "h:mm:ss A",
});

const DATE_TOKENS = Object.freeze(["YYYY", "YY", "MM", "DD", "M", "D"]);
const TIME_TOKENS = Object.freeze(["HH", "hh", "mm", "ss", "H", "h", "m", "s", "A", "a"]);

export function isPropertyDateDisplayFormat(
  value: unknown,
): value is PropertyDateDisplayFormat {
  return value === "system" ||
    value === "ymd-dash" ||
    value === "ymd-slash" ||
    value === "ymd-slash-padded" ||
    value === "dmy-slash" ||
    value === "mdy-slash" ||
    value === "custom";
}

export function isPropertyTimeDisplayFormat(
  value: unknown,
): value is PropertyTimeDisplayFormat {
  return value === "system" ||
    value === "24-hour" ||
    value === "24-hour-seconds" ||
    value === "12-hour" ||
    value === "12-hour-seconds" ||
    value === "custom";
}

export function normalizePropertyCustomFormat(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  return value.slice(0, MAX_PROPERTY_DATE_FORMAT_LENGTH);
}

export function resolvePropertyDatePattern(
  format: PropertyDateDisplayFormat,
  customFormat: string,
): string | null {
  if (format === "system") return null;
  if (format === "custom") {
    return isValidPropertyDateFormat(customFormat) ? customFormat : null;
  }
  return DATE_PATTERNS[format];
}

export function resolvePropertyTimePattern(
  format: PropertyTimeDisplayFormat,
  customFormat: string,
): string | null {
  if (format === "system") return null;
  if (format === "custom") {
    return isValidPropertyTimeFormat(customFormat) ? customFormat : null;
  }
  return TIME_PATTERNS[format];
}

export function isValidPropertyDateFormat(format: string): boolean {
  const tokens = scanFormat(format, DATE_TOKENS);
  if (tokens === null) return false;
  return countTokenKind(tokens, "year") === 1 &&
    countTokenKind(tokens, "month") === 1 &&
    countTokenKind(tokens, "day") === 1;
}

export function isValidPropertyTimeFormat(format: string): boolean {
  const tokens = scanFormat(format, TIME_TOKENS);
  if (tokens === null) return false;
  const hourTokens = tokens.filter((token) => token === "H" || token === "HH" ||
    token === "h" || token === "hh");
  const minuteTokens = tokens.filter((token) => token === "m" || token === "mm");
  const secondTokens = tokens.filter((token) => token === "s" || token === "ss");
  const meridiemTokens = tokens.filter((token) => token === "A" || token === "a");
  if (hourTokens.length !== 1 || minuteTokens.length !== 1 || secondTokens.length > 1 ||
    meridiemTokens.length > 1) return false;
  const usesTwelveHour = hourTokens[0] === "h" || hourTokens[0] === "hh";
  return meridiemTokens.length === 0 || usesTwelveHour;
}

export function getPropertyDateFieldOrder(pattern: string): PropertyDateFieldOrder | null {
  const tokens = scanFormat(pattern, DATE_TOKENS);
  if (tokens === null) return null;
  const fields = tokens.map(getDateTokenKind).filter((field) => field !== null);
  const uniqueFields = Array.from(new Set(fields));
  if (uniqueFields.length !== 3) return null;
  const order = uniqueFields.join("");
  return order === "yearmonthday"
    ? "ymd"
    : order === "daymonthyear"
      ? "dmy"
      : order === "monthdayyear"
        ? "mdy"
        : null;
}

function scanFormat(format: string, tokens: readonly string[]): readonly string[] | null {
  if (format.length === 0 || format.length > MAX_PROPERTY_DATE_FORMAT_LENGTH) return null;
  const output: string[] = [];
  for (let index = 0; index < format.length;) {
    const character = format[index] ?? "";
    if (character === "[") {
      const nextIndex = skipBracketLiteral(format, index);
      if (nextIndex === null) return null;
      index = nextIndex;
      continue;
    }
    if (character === "\\") {
      if (format[index + 1] === undefined) return null;
      index += 2;
      continue;
    }
    const token = tokens.find((candidate) => format.startsWith(candidate, index));
    if (token !== undefined) {
      output.push(token);
      index += token.length;
      continue;
    }
    if (/[A-Za-z]/.test(character)) return null;
    index += 1;
  }
  return output;
}

function skipBracketLiteral(format: string, startIndex: number): number | null {
  for (let index = startIndex + 1; index < format.length; index += 1) {
    const character = format[index] ?? "";
    if (character === "\\") {
      if (format[index + 1] === undefined) return null;
      index += 1;
      continue;
    }
    if (character === "]") return index + 1;
  }
  return null;
}

function countTokenKind(tokens: readonly string[], kind: "year" | "month" | "day"): number {
  return tokens.filter((token) => getDateTokenKind(token) === kind).length;
}

function getDateTokenKind(token: string): "year" | "month" | "day" | null {
  if (token === "YYYY" || token === "YY") return "year";
  if (token === "M" || token === "MM") return "month";
  if (token === "D" || token === "DD") return "day";
  return null;
}
