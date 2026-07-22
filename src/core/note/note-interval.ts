import { DateTime } from "luxon";

import { toDateTime, type LocalDate } from "../periodic/periodic-date";

export type NoteIntervalErrorReason =
  | "missing-boundary"
  | "invalid-type"
  | "invalid-value"
  | "reversed-range";

export interface NoteIntervalBoundary {
  readonly value: string;
  readonly date: LocalDate;
  readonly dateKey: string;
  readonly hasTime: boolean;
  readonly epochMillis: number;
}

export interface NoteInterval {
  readonly start: NoteIntervalBoundary;
  readonly end: NoteIntervalBoundary;
  readonly dayCount: number;
}

export interface NoteIntervalParseFailure {
  readonly name: "NoteIntervalError";
  readonly reason: NoteIntervalErrorReason;
  readonly message: string;
}

export interface ParsedNoteInterval {
  readonly value: NoteInterval | null;
  readonly error: NoteIntervalParseFailure | null;
}

const EMPTY_RESULT: ParsedNoteInterval = Object.freeze({ value: null, error: null });
const COMPLETE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const COMPLETE_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:[.,]\d+)?)?(?:Z|[+-]\d{2}(?::?\d{2})?)?$/u;

export function parseNoteInterval(
  frontmatter: Readonly<Record<string, unknown>> | null,
): ParsedNoteInterval {
  if (frontmatter === null) return EMPTY_RESULT;
  const hasStart = Object.hasOwn(frontmatter, "start");
  const hasEnd = Object.hasOwn(frontmatter, "end");
  if (!hasStart && !hasEnd) return EMPTY_RESULT;
  if (!hasStart || !hasEnd) {
    return failure(
      "missing-boundary",
      `Interval frontmatter requires both start and end properties; missing ${hasStart ? "end" : "start"}`,
    );
  }

  const start = parseBoundary(frontmatter.start, "start");
  if ("error" in start) return start.error;
  const end = parseBoundary(frontmatter.end, "end");
  if ("error" in end) return end.error;

  const calendarOrder = toDateTime(end.value.date).diff(
    toDateTime(start.value.date),
    "days",
  ).days;
  if (calendarOrder < 0 || start.value.epochMillis > end.value.epochMillis) {
    return failure("reversed-range", "Interval start must not be later than end");
  }

  return Object.freeze({
    value: Object.freeze({
      start: start.value,
      end: end.value,
      dayCount: Math.floor(calendarOrder) + 1,
    }),
    error: null,
  });
}

function parseBoundary(
  input: unknown,
  property: "start" | "end",
): Readonly<
  | { value: NoteIntervalBoundary }
  | { error: ParsedNoteInterval }
> {
  if (typeof input !== "string") {
    return { error: failure("invalid-type", `Interval ${property} must be an ISO string`) };
  }
  const value = input.trim();
  if (value.length === 0) {
    return { error: failure("invalid-value", `Interval ${property} must not be empty`) };
  }
  const hasTime = COMPLETE_DATE_TIME_PATTERN.test(value);
  if (!COMPLETE_DATE_PATTERN.test(value) && !hasTime) {
    return {
      error: failure(
        "invalid-value",
        `Interval ${property} must be a complete ISO calendar date or date-time`,
      ),
    };
  }
  const parsed = DateTime.fromISO(value, { zone: "UTC", setZone: true });
  if (!parsed.isValid) {
    return { error: failure("invalid-value", `Interval ${property} is not a valid ISO value`) };
  }
  const date = Object.freeze({
    year: parsed.year,
    month: parsed.month,
    day: parsed.day,
  });
  return Object.freeze({
    value: Object.freeze({
      value,
      date,
      dateKey: parsed.toFormat("yyyy-MM-dd"),
      hasTime,
      epochMillis: parsed.toMillis(),
    }),
  });
}

function failure(
  reason: NoteIntervalErrorReason,
  message: string,
): ParsedNoteInterval {
  return Object.freeze({
    value: null,
    error: Object.freeze({ name: "NoteIntervalError", reason, message }),
  });
}
