import { isMap, parseDocument } from "yaml";

import { parseNoteDocument } from "../document/parse-note-document";
import {
  CHRONO_NOTES_INTERVAL_VALUE,
  CHRONO_NOTES_PROPERTY,
} from "./note-interval";
import {
  formatLocalDateKey,
  toDateTime,
  toLocalDate,
  type LocalDate,
} from "../periodic/periodic-date";

export interface IntervalNoteSpec {
  readonly start: LocalDate;
  readonly end: LocalDate;
  readonly dayCount: number;
  readonly title: string;
  readonly path: string;
}

export function normalizeIntervalNoteDates(
  first: LocalDate,
  second: LocalDate,
): Readonly<{ start: LocalDate; end: LocalDate }> {
  const firstValue = toDateTime(first);
  const secondValue = toDateTime(second);
  return firstValue <= secondValue
    ? Object.freeze({ start: toLocalDate(firstValue), end: toLocalDate(secondValue) })
    : Object.freeze({ start: toLocalDate(secondValue), end: toLocalDate(firstValue) });
}

export function buildIntervalNoteSpec(
  start: LocalDate,
  end: LocalDate,
  folder: string,
): IntervalNoteSpec {
  const normalizedFolder = normalizeIntervalNoteFolder(folder);
  if (normalizedFolder.length === 0) {
    throw new RangeError("Range note folder must not be empty");
  }
  const normalized = normalizeIntervalNoteDates(start, end);
  const startLabel = formatLocalDateKey(normalized.start);
  const endLabel = formatLocalDateKey(normalized.end);
  const title = `${startLabel} - ${endLabel}`;
  return Object.freeze({
    start: normalized.start,
    end: normalized.end,
    dayCount: Math.floor(
      toDateTime(normalized.end).diff(toDateTime(normalized.start), "days").days,
    ) + 1,
    title,
    path: `${normalizedFolder}/${title}.md`,
  });
}

export function buildIntervalNoteContent(spec: IntervalNoteSpec): string {
  return [
    "---",
    `${CHRONO_NOTES_PROPERTY}: ${CHRONO_NOTES_INTERVAL_VALUE}`,
    `start: ${formatLocalDateKey(spec.start)}`,
    `end: ${formatLocalDateKey(spec.end)}`,
    "---",
    "",
    `# ${spec.title}`,
    "",
  ].join("\n");
}

export function applyIntervalNoteMetadata(
  content: string,
  spec: IntervalNoteSpec,
): string {
  const parsed = parseNoteDocument(content);
  if (parsed.frontmatterStatus === "unterminated") {
    throw new RangeError("Interval note template has unterminated frontmatter");
  }

  const frontmatter = parseDocument(parsed.frontmatterText ?? "");
  const yamlError = frontmatter.errors[0];
  if (yamlError !== undefined) {
    throw new RangeError(`Interval note template has invalid frontmatter: ${yamlError.message}`);
  }
  if (frontmatter.contents !== null && !isMap(frontmatter.contents)) {
    throw new RangeError("Interval note template frontmatter must be a mapping");
  }

  frontmatter.set(CHRONO_NOTES_PROPERTY, CHRONO_NOTES_INTERVAL_VALUE);
  frontmatter.set("start", formatLocalDateKey(spec.start));
  frontmatter.set("end", formatLocalDateKey(spec.end));
  const yaml = frontmatter.toString({ lineWidth: 0 }).trimEnd();
  const body = parsed.body.replace(/^\n+/, "").replace(/\n+$/, "");
  return [
    "---",
    yaml,
    "---",
    ...(body.length === 0 ? [] : ["", body]),
    "",
  ].join("\n");
}

export function normalizeIntervalNoteFolder(path: string): string {
  return path.trim().replace(/[\\/]+/g, "/").replace(/^\/+|\/+$/g, "");
}
