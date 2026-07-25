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

/**
 * Compile the documented Obsidian/Moment subset into a Luxon format.
 * Unsupported ASCII letters are rejected so token typos never become paths.
 */
export function compileMomentFormat(
  format: string,
  profile: MomentFormatProfile,
): string | null {
  const tokenMap = profile === "date"
    ? DATE_TOKEN_MAP
    : { ...DATE_TOKEN_MAP, ...TIME_TOKEN_MAP };
  const tokens = profile === "date" ? DATE_TOKENS : DATE_TIME_TOKENS;
  const output: string[] = [];
  let literal = "";

  const flushLiteral = () => {
    if (literal.length === 0) return;
    output.push(quoteLuxonLiteral(literal));
    literal = "";
  };

  for (let index = 0; index < format.length;) {
    const character = format[index] ?? "";
    if (character === "[") {
      flushLiteral();
      const parsed = parseBracketLiteral(format, index);
      if (parsed === null) return null;
      output.push(quoteLuxonLiteral(parsed.value));
      index = parsed.nextIndex;
      continue;
    }
    if (character === "\\") {
      const escaped = format[index + 1];
      if (escaped === undefined) return null;
      literal += escaped;
      index += 2;
      continue;
    }

    const token = tokens.find((candidate) => format.startsWith(candidate, index));
    if (token !== undefined) {
      flushLiteral();
      output.push(tokenMap[token] ?? "");
      index += token.length;
      continue;
    }
    if (/[A-Za-z]/.test(character)) return null;
    literal += character;
    index += 1;
  }

  flushLiteral();
  return output.join("");
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
  if (compileMomentFormat(format, "date") !== null) return format;

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

function parseBracketLiteral(
  format: string,
  startIndex: number,
): Readonly<{ value: string; nextIndex: number }> | null {
  let value = "";
  for (let index = startIndex + 1; index < format.length; index += 1) {
    const character = format[index] ?? "";
    if (character === "\\") {
      const escaped = format[index + 1];
      if (escaped === undefined) return null;
      value += escaped;
      index += 1;
      continue;
    }
    if (character === "]") {
      return Object.freeze({ value, nextIndex: index + 1 });
    }
    value += character;
  }
  return null;
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
