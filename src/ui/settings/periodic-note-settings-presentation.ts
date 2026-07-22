import type {
  LocalDate,
  PeriodicNoteType,
  WeekStartDay,
} from "../../core/periodic/periodic-date";
import {
  formatPeriodicNotePath,
  parsePeriodicNotePath,
} from "../../core/periodic/periodic-note-path";

export type PeriodicNotePathPreview = Readonly<
  | { status: "empty"; path: null }
  | {
    status: "invalid";
    path: null;
    reason: "moment-tokens" | "unrecognized";
  }
  | { status: "valid"; path: string }
>;

export interface PeriodicNotePathPreviewOptions {
  readonly locale: string;
  readonly weekStartDay: WeekStartDay;
}

const DEFAULT_FILENAME_PATTERNS: Readonly<Record<PeriodicNoteType, string>> = Object.freeze({
  daily: "yyyy-MM-dd",
  weekly: "kkkk-'W'WW",
  monthly: "yyyy-MM",
  quarterly: "yyyy-'Q'q",
  yearly: "yyyy",
});

const PATH_PATTERN_EXAMPLES: Readonly<Record<PeriodicNoteType, string>> = Object.freeze({
  daily: "'Daily'/yyyy-MM-dd",
  weekly: "'Weekly'/kkkk-'W'WW",
  monthly: "'Monthly'/yyyy-MM",
  quarterly: "'Quarterly'/yyyy-'Q'q",
  yearly: "'Yearly'/yyyy",
});

const TEMPLATE_PATH_EXAMPLES: Readonly<Record<PeriodicNoteType, string>> = Object.freeze({
  daily: "Templates/Daily.md",
  weekly: "Templates/Weekly.md",
  monthly: "Templates/Monthly.md",
  quarterly: "Templates/Quarterly.md",
  yearly: "Templates/Yearly.md",
});

export function createPeriodicNotePathPreview(
  date: LocalDate,
  noteType: PeriodicNoteType,
  pattern: string,
  options: PeriodicNotePathPreviewOptions,
): PeriodicNotePathPreview {
  if (pattern.trim().length === 0) {
    return Object.freeze({ status: "empty", path: null });
  }
  if (hasUnquotedMomentTokens(pattern)) {
    return Object.freeze({ status: "invalid", path: null, reason: "moment-tokens" });
  }

  const rule = { noteType, pattern } as const;
  const path = formatPeriodicNotePath(date, rule, options);
  if (path === null || parsePeriodicNotePath(path, rule, options) === null) {
    return Object.freeze({
      status: "invalid",
      path: null,
      reason: "unrecognized",
    });
  }
  return Object.freeze({ status: "valid", path });
}

export function getDefaultPeriodicNoteFilenamePattern(noteType: PeriodicNoteType): string {
  return DEFAULT_FILENAME_PATTERNS[noteType];
}

export function getPeriodicNotePathExample(noteType: PeriodicNoteType): string {
  return PATH_PATTERN_EXAMPLES[noteType];
}

export function getPeriodicNoteTemplatePathExample(noteType: PeriodicNoteType): string {
  return TEMPLATE_PATH_EXAMPLES[noteType];
}

export function setPeriodicNoteFolder(
  pattern: string,
  folderPath: string,
  noteType: PeriodicNoteType,
): string {
  const folder = normalizeFolderPath(folderPath);
  const separator = pattern.lastIndexOf("/");
  const configuredFilename = (separator === -1 ? pattern : pattern.slice(separator + 1)).trim();
  const filenamePattern = configuredFilename.length > 0
    && (separator !== -1 || hasPeriodicDateTokens(configuredFilename))
    ? configuredFilename
    : getDefaultPeriodicNoteFilenamePattern(noteType);
  return folder.length === 0
    ? filenamePattern
    : `${quoteLuxonLiteral(folder)}/${filenamePattern}`;
}

export function getPeriodicNoteFolderQuery(pattern: string): string {
  const separator = pattern.lastIndexOf("/");
  if (separator === -1) {
    const value = pattern.trim();
    return hasPeriodicDateTokens(value)
      ? ""
      : decodeLuxonLiteral(value);
  }

  return decodeLuxonLiteral(pattern.slice(0, separator).trim());
}

function decodeLuxonLiteral(value: string): string {
  const literalQuote = "\u0000";
  return value
    .replaceAll("''''", literalQuote)
    .replaceAll("'", "")
    .replaceAll(literalQuote, "'");
}

function hasPeriodicDateTokens(value: string): boolean {
  return /y{2,}|M{2,}|d{2,}|k{2,}|W{2,}|q/.test(value);
}

function hasUnquotedMomentTokens(pattern: string): boolean {
  const withoutLuxonLiterals = pattern.replace(/'(?:[^']|'''')*'/g, "");
  return /Y{2,4}/.test(withoutLuxonLiterals)
    || /y{2,4}[-/.]M{1,4}[-/.]D{2,4}/.test(withoutLuxonLiterals);
}

function normalizeFolderPath(path: string): string {
  return path
    .replaceAll("\\", "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .join("/");
}

function quoteLuxonLiteral(value: string): string {
  return `'${value.replaceAll("'", "''''")}'`;
}
