import type {
  LocalDate,
  PeriodicNoteType,
  WeekStartDay,
} from "../../core/periodic/periodic-date";
import {
  formatPeriodicNotePath,
  parsePeriodicNotePath,
} from "../../core/periodic/periodic-note-path";
import { quoteMomentLiteral } from "../../core/periodic/moment-format";

export type PeriodicNotePathPreview = Readonly<
  | { status: "empty"; path: null }
  | {
    status: "invalid";
    path: null;
    reason: "unrecognized";
  }
  | { status: "valid"; path: string }
>;

export interface PeriodicNotePathPreviewOptions {
  readonly locale: string;
  readonly weekStartDay: WeekStartDay;
}

const DEFAULT_FILENAME_PATTERNS: Readonly<Record<PeriodicNoteType, string>> = Object.freeze({
  daily: "YYYY-MM-DD",
  weekly: "GGGG-[W]WW",
  monthly: "YYYY-MM",
  quarterly: "YYYY-[Q]Q",
  yearly: "YYYY",
});

const PATH_PATTERN_EXAMPLES: Readonly<Record<PeriodicNoteType, string>> = Object.freeze({
  daily: "[diary]/YYYY/YYYY-MM/YYYY-MM-DD",
  weekly: "[diary]/GGGG/GGGG-[W]WW",
  monthly: "[diary]/YYYY/YYYY-MM",
  quarterly: "[diary]/YYYY/YYYY-[Q]Q",
  yearly: "[diary]/YYYY",
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
    : `${quoteMomentLiteral(folder)}/${filenamePattern}`;
}

export function getPeriodicNoteFolderQuery(pattern: string): string {
  const separator = pattern.lastIndexOf("/");
  if (separator === -1) {
    const value = pattern.trim();
    return hasPeriodicDateTokens(value)
      ? ""
      : decodeMomentLiteral(value);
  }

  return decodeMomentLiteral(pattern.slice(0, separator).trim());
}

function decodeMomentLiteral(value: string): string {
  if (!value.startsWith("[")) return value;
  const endIndex = value.endsWith("]") ? value.length - 1 : value.length;
  let decoded = "";
  for (let index = 1; index < endIndex; index += 1) {
    const character = value[index] ?? "";
    if (character === "\\" && index + 1 < endIndex) {
      decoded += value[index + 1] ?? "";
      index += 1;
    } else {
      decoded += character;
    }
  }
  return decoded;
}

function hasPeriodicDateTokens(value: string): boolean {
  return /Y{2,4}|G{2,4}|M{1,4}|D{1,2}|W{1,2}|Q/.test(value);
}

function normalizeFolderPath(path: string): string {
  return path
    .replaceAll("\\", "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .join("/");
}
