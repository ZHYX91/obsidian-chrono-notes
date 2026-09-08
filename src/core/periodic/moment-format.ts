export type MomentFormatProfile = "date" | "date-time";

const DATE_TOKEN_MAP: Readonly<Record<string, string>> = Object.freeze({
  GGGG: "kkkk",
  YYYY: "yyyy",
  MMMM: "MMMM",
  dddd: "cccc",
  MMM: "MMM",
  ddd: "ccc",
  GG: "kk",
  YY: "yy",
  MM: "MM",
  M: "M",
  DD: "dd",
  D: "d",
  WW: "WW",
  W: "W",
  Q: "q",
});

const LEGACY_LUXON_DATE_TOKEN_MAP: Readonly<Record<string, string>> = Object.freeze({
  kkkk: "GGGG",
  yyyy: "YYYY",
  cccc: "dddd",
  MMMM: "MMMM",
  ccc: "ddd",
  MMM: "MMM",
  kk: "GG",
  yy: "YY",
  MM: "MM",
  dd: "DD",
  WW: "WW",
  M: "M",
  d: "D",
  W: "W",
  q: "Q",
});

const TIME_TOKEN_MAP: Readonly<Record<string, string>> = Object.freeze({
  HH: "HH",
  H: "H",
  mm: "mm",
  m: "m",
  ss: "ss",
  s: "s",
  A: "a",
  a: "a",
});

const DATE_TOKENS = Object.freeze(
  Object.keys(DATE_TOKEN_MAP).sort((left, right) => right.length - left.length),
);
const DATE_TIME_TOKENS = Object.freeze(
  [...DATE_TOKENS, ...Object.keys(TIME_TOKEN_MAP)]
    .sort((left, right) => right.length - left.length),
);
const LEGACY_LUXON_DATE_TOKENS = Object.freeze(
  Object.keys(LEGACY_LUXON_DATE_TOKEN_MAP)
    .sort((left, right) => right.length - left.length),
);

export interface MomentFormatPart {
  readonly token: string | null;
  readonly value: string;
}

/** Shared lexer: literals and escapes are never interpreted as format tokens. */
export function splitMomentFormat(format: string): readonly MomentFormatPart[] | null {
  const parts: MomentFormatPart[] = [];
  let plain = "";
  for (let index = 0; index < format.length; index += 1) {
    const character = format[index] ?? "";
    if (character !== "[" && character !== "\\") {
      plain += character;
      continue;
    }
    if (plain.length > 0) parts.push({ token: "raw", value: plain });
    plain = "";
    if (character === "\\") {
      const escaped = format[++index];
      if (escaped === undefined) return null;
      parts.push({ token: null, value: escaped });
      continue;
    }
    let literal = "";
    let closed = false;
    for (index += 1; index < format.length; index += 1) {
      const item = format[index] ?? "";
      if (item === "\\") {
        const escaped = format[++index];
        if (escaped === undefined) return null;
        literal += escaped;
      } else if (item === "]") {
        closed = true;
        break;
      } else literal += item;
    }
    if (!closed) return null;
    parts.push({ token: null, value: literal });
  }
  if (plain.length > 0) parts.push({ token: "raw", value: plain });
  return parts;
}

export function parseMomentFormat(
  format: string,
  profile: MomentFormatProfile,
): readonly MomentFormatPart[] | null {
  const chunks = splitMomentFormat(format);
  if (chunks === null) return null;
  const tokenMap = profile === "date" ? DATE_TOKEN_MAP : { ...DATE_TOKEN_MAP, ...TIME_TOKEN_MAP };
  const tokens = ["DEC", "CEN", ...(profile === "date" ? DATE_TOKENS : DATE_TIME_TOKENS)]
    .sort((left, right) => right.length - left.length);
  const parts: MomentFormatPart[] = [];
  for (const chunk of chunks) {
    if (chunk.token === null) {
      parts.push(chunk);
      continue;
    }
    for (let index = 0; index < chunk.value.length;) {
      const token = tokens.find((candidate) => chunk.value.startsWith(candidate, index));
      if (token !== undefined) {
        parts.push({ token, value: tokenMap[token] ?? token });
        index += token.length;
      } else {
        const character = chunk.value[index] ?? "";
        if (/[A-Za-z]/.test(character)) return null;
        parts.push({ token: null, value: character });
        index += 1;
      }
    }
  }
  return parts;
}

/** Compile native tokens only; extended formats are handled by period-format. */
export function compileMomentFormat(
  format: string,
  profile: MomentFormatProfile,
): string | null {
  const parts = parseMomentFormat(format, profile);
  if (parts === null || parts.some((part) => part.token === "DEC" || part.token === "CEN")) {
    return null;
  }
  return compileMomentParts(parts);
}

export function compileMomentParts(parts: readonly MomentFormatPart[]): string {
  let output = "";
  let literal = "";
  for (const part of parts) {
    if (part.token === null) literal += part.value;
    else {
      if (literal.length > 0) output += quoteLuxonLiteral(literal);
      literal = "";
      output += part.value;
    }
  }
  return output + (literal.length > 0 ? quoteLuxonLiteral(literal) : "");
}

export function quoteMomentLiteral(value: string): string {
  return `[${value
    .replaceAll("\\", "\\\\")
    .replaceAll("]", "\\]")}]`;
}

/**
 * Convert the documented pre-0.2.1 Luxon path grammar to the public
 * Obsidian/Moment grammar. Already-valid Moment formats are preserved, while
 * unsupported or malformed legacy formats remain untouched by their caller.
 */
export function migrateLuxonDateFormatToMoment(format: string): string | null {
  if (parseMomentFormat(format, "date") !== null) return format;

  let output = "";
  for (let index = 0; index < format.length;) {
    const character = format[index] ?? "";
    if (character === "'") {
      const parsed = parseLuxonLiteral(format, index);
      if (parsed === null) return null;
      output += quoteMomentLiteral(parsed.value);
      index = parsed.nextIndex;
      continue;
    }

    const token = LEGACY_LUXON_DATE_TOKENS.find(
      (candidate) => format.startsWith(candidate, index),
    );
    if (token !== undefined) {
      output += LEGACY_LUXON_DATE_TOKEN_MAP[token] ?? "";
      index += token.length;
      continue;
    }
    if (/[A-Za-z]/.test(character)) return null;
    output += character;
    index += 1;
  }

  return compileMomentFormat(output, "date") === null ? null : output;
}

function parseLuxonLiteral(
  format: string,
  startIndex: number,
): Readonly<{ value: string; nextIndex: number }> | null {
  let value = "";
  for (let index = startIndex + 1; index < format.length; index += 1) {
    const character = format[index] ?? "";
    if (character !== "'") {
      value += character;
      continue;
    }
    if (format[index + 1] === "'") {
      value += "'";
      index += 1;
      continue;
    }
    return Object.freeze({ value, nextIndex: index + 1 });
  }
  return null;
}

function quoteLuxonLiteral(value: string): string {
  return `'${value.replaceAll("'", "''''")}'`;
}
