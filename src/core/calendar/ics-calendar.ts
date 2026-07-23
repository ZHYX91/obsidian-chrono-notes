import ICAL from "ical.js";
import { DateTime } from "luxon";

import {
  compareLocalDate,
  formatLocalDateKey,
  parseLocalDateKey,
  shiftPeriod,
  toDateTime,
  toLocalDate,
  type LocalDate,
} from "../periodic/periodic-date";

const MAX_EVENT_SPAN_DAYS = 366;

export interface IcsParseOptions {
  readonly displayZone: string;
}

export interface IcsDateValue {
  readonly date: LocalDate;
  readonly timeMinutes: number | null;
  readonly timestamp: number;
  readonly zone: string;
}

export interface IcsCalendarEvent {
  readonly id: string;
  readonly source: string;
  readonly sourceLabel: string;
  readonly title: string;
  readonly isAllDay: boolean;
  readonly start: IcsDateValue;
  readonly endExclusive: IcsDateValue;
}

export interface IcsParseResult {
  readonly events: readonly IcsCalendarEvent[];
  readonly skippedRecurring: number;
  readonly skippedInvalid: number;
}

export interface IcsEventOccurrence {
  readonly id: string;
  readonly title: string;
  readonly source: string;
  readonly sourceLabel: string;
  readonly isAllDay: boolean;
  readonly startsOnDate: boolean;
  readonly endsOnDate: boolean;
  readonly continuesBefore: boolean;
  readonly continuesAfter: boolean;
  readonly timeLabel: string | null;
  readonly sortTimestamp: number;
}

export interface IcsDateIndexResult {
  readonly eventsByDate: Readonly<Record<string, readonly IcsEventOccurrence[]>>;
  readonly truncatedEvents: number;
}

export function parseIcsCalendar(
  content: string,
  source: string,
  options: IcsParseOptions,
): IcsParseResult {
  validateDisplayZone(options.displayZone);
  const normalized = content.startsWith("\uFEFF") ? content.slice(1) : content;
  const parsed: unknown = ICAL.parse(normalized);
  if (!isJCalComponent(parsed)) {
    throw new Error("ICS source must contain exactly one calendar component");
  }
  const root = new ICAL.Component(parsed);
  const components = root.name === "vevent"
    ? [root]
    : root.getAllSubcomponents("vevent");
  const events: IcsCalendarEvent[] = [];
  let skippedRecurring = 0;
  let skippedInvalid = 0;

  for (const [index, component] of components.entries()) {
    try {
      if (
        String(component.getFirstPropertyValue("status") ?? "").toUpperCase() === "CANCELLED"
      ) continue;
      if (component.hasProperty("rrule") || component.hasProperty("rdate")) {
        skippedRecurring += 1;
        continue;
      }
      const event = parseEvent(component, source, index, options.displayZone);
      if (event === null) skippedInvalid += 1;
      else events.push(event);
    } catch {
      // A malformed typed property must invalidate only its own VEVENT.
      skippedInvalid += 1;
    }
  }

  return Object.freeze({
    events: Object.freeze(events),
    skippedRecurring,
    skippedInvalid,
  });
}

function isJCalComponent(value: unknown): value is [string, unknown[], unknown[]] {
  return Array.isArray(value) &&
    typeof value[0] === "string" &&
    Array.isArray(value[1]) &&
    Array.isArray(value[2]);
}

export function buildIcsDateIndex(events: readonly IcsCalendarEvent[]): IcsDateIndexResult {
  const mutable: Record<string, IcsEventOccurrence[]> = {};
  let truncatedEvents = 0;

  for (const event of events) {
    const endDate = getInclusiveEndDate(event);
    const keys = getDateKeys(event.start.date, endDate);
    if (keys.truncated) truncatedEvents += 1;
    const startKey = formatLocalDateKey(event.start.date);
    const endKey = formatLocalDateKey(endDate);
    for (const dateKey of keys.values) {
      const occurrenceDate = parseLocalDateKey(dateKey);
      if (occurrenceDate === null) {
        throw new Error(`Invalid generated ICS date key: ${dateKey}`);
      }
      const startsOnDate = dateKey === startKey;
      const endsOnDate = dateKey === endKey;
      const occurrence = Object.freeze({
        id: event.id,
        title: event.title,
        source: event.source,
        sourceLabel: event.sourceLabel,
        isAllDay: event.isAllDay,
        startsOnDate,
        endsOnDate,
        continuesBefore: !startsOnDate,
        continuesAfter: !endsOnDate,
        timeLabel: !event.isAllDay && startsOnDate
          ? formatTime(event.start.timeMinutes ?? 0)
          : null,
        sortTimestamp: startsOnDate
          ? event.start.timestamp
          : toDateTime(occurrenceDate).toMillis(),
      });
      (mutable[dateKey] ??= []).push(occurrence);
    }
  }

  for (const occurrences of Object.values(mutable)) {
    occurrences.sort(compareOccurrences);
    Object.freeze(occurrences);
  }
  return Object.freeze({
    eventsByDate: Object.freeze(mutable),
    truncatedEvents,
  });
}

function parseEvent(
  component: InstanceType<typeof ICAL.Component>,
  source: string,
  index: number,
  displayZone: string,
): IcsCalendarEvent | null {
  const startProperty = component.getFirstProperty("dtstart");
  if (startProperty === null) return null;
  const start = parseDateProperty(startProperty, displayZone);
  if (start === null) return null;

  const endProperty = component.getFirstProperty("dtend");
  const durationProperty = component.getFirstProperty("duration");
  if (endProperty !== null && durationProperty !== null) return null;

  let endExclusive: IcsDateValue | null;
  if (endProperty !== null) {
    endExclusive = parseDateProperty(endProperty, displayZone);
    if (
      endExclusive === null ||
      (start.timeMinutes === null) !== (endExclusive.timeMinutes === null)
    ) return null;
  } else if (durationProperty !== null) {
    endExclusive = getDurationEnd(start, durationProperty);
    if (endExclusive === null) return null;
  } else {
    endExclusive = defaultEnd(start);
  }
  if (endExclusive.timestamp <= start.timestamp) return null;

  const titleValue = component.getFirstPropertyValue("summary");
  const title = String(titleValue ?? "").trim() || "Untitled event";
  const uid = String(component.getFirstPropertyValue("uid") ?? "").trim();
  return Object.freeze({
    id: uid || `${source}#${index}`,
    source,
    sourceLabel: getSourceLabel(source),
    title,
    isAllDay: start.timeMinutes === null,
    start,
    endExclusive,
  });
}

function getDurationEnd(
  start: IcsDateValue,
  property: InstanceType<typeof ICAL.Property>,
): IcsDateValue | null {
  const duration = property.getFirstValue();
  if (!(duration instanceof ICAL.Duration)) return null;
  const seconds = duration.toSeconds();
  if (!Number.isFinite(seconds) || seconds <= 0 || duration.isNegative) return null;
  const isAllDay = start.timeMinutes === null;
  if (
    isAllDay &&
    (duration.hours !== 0 || duration.minutes !== 0 || duration.seconds !== 0)
  ) return null;
  return fromDateTime(
    DateTime.fromMillis(start.timestamp, { zone: start.zone }).plus({ seconds }),
    isAllDay,
  );
}

function parseDateProperty(
  property: InstanceType<typeof ICAL.Property>,
  displayZone: string,
): IcsDateValue | null {
  const value = property.getFirstValue();
  if (!(value instanceof ICAL.Time)) return null;
  const raw = typeof property.jCal[3] === "string" ? property.jCal[3] : "";
  const parts = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?(Z)?)?$/,
  );
  if (parts === null) return null;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  if (value.isDate) {
    const date = { year, month, day };
    try {
      const dateTime = toDateTime(date);
      return Object.freeze({
        date: Object.freeze({ ...date }),
        timeMinutes: null,
        timestamp: dateTime.toMillis(),
        zone: "UTC",
      });
    } catch {
      return null;
    }
  }

  const tzid = property.getFirstParameter("tzid")?.trim();
  const sourceZone = parts[7] === "Z" || value.zone?.tzid === "UTC"
    ? "UTC"
    : normalizeSourceZone(tzid, displayZone);
  if (sourceZone === null) return null;
  const hour = Number(parts[4]);
  const minute = Number(parts[5]);
  const second = Number(parts[6] ?? 0);
  const sourceValue = DateTime.fromObject(
    {
      year,
      month,
      day,
      hour,
      minute,
      second,
    },
    { zone: sourceZone },
  );
  if (
    !sourceValue.isValid ||
    sourceValue.year !== year ||
    sourceValue.month !== month ||
    sourceValue.day !== day ||
    sourceValue.hour !== hour ||
    sourceValue.minute !== minute ||
    sourceValue.second !== second
  ) return null;
  return fromDateTime(sourceValue.setZone(displayZone), false);
}

function fromDateTime(value: DateTime, isAllDay: boolean): IcsDateValue | null {
  if (!value.isValid) return null;
  return Object.freeze({
    date: Object.freeze(toLocalDate(value as DateTime<true>)),
    timeMinutes: isAllDay ? null : value.hour * 60 + value.minute,
    timestamp: value.toMillis(),
    zone: value.zoneName ?? "UTC",
  });
}

function defaultEnd(start: IcsDateValue): IcsDateValue {
  const value = DateTime.fromMillis(start.timestamp, { zone: start.zone });
  const end = start.timeMinutes === null
    ? value.plus({ days: 1 })
    : value.plus({ minutes: 1 });
  return fromDateTime(end, start.timeMinutes === null)!;
}

function getInclusiveEndDate(event: IcsCalendarEvent): LocalDate {
  if (event.isAllDay) {
    return shiftPeriod(event.endExclusive.date, "daily", -1, "monday");
  }
  const value = DateTime.fromMillis(event.endExclusive.timestamp - 1, {
    zone: event.endExclusive.zone,
  });
  return Object.freeze(toLocalDate(value as DateTime<true>));
}

function getDateKeys(
  start: LocalDate,
  end: LocalDate,
): Readonly<{ values: readonly string[]; truncated: boolean }> {
  const values: string[] = [];
  let cursor = start;
  for (let index = 0; index < MAX_EVENT_SPAN_DAYS; index += 1) {
    if (compareLocalDate(cursor, end) > 0) break;
    values.push(formatLocalDateKey(cursor));
    cursor = shiftPeriod(cursor, "daily", 1, "monday");
  }
  return Object.freeze({
    values: Object.freeze(values),
    truncated: compareLocalDate(cursor, end) <= 0,
  });
}

function compareOccurrences(left: IcsEventOccurrence, right: IcsEventOccurrence): number {
  if (left.isAllDay !== right.isAllDay) return left.isAllDay ? -1 : 1;
  if (left.sortTimestamp !== right.sortTimestamp) return left.sortTimestamp - right.sortTimestamp;
  return left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
}

function formatTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(
    2,
    "0",
  )}`;
}

function validateDisplayZone(zone: string): void {
  if (!DateTime.now().setZone(zone).isValid) throw new RangeError(`Invalid display zone: ${zone}`);
}

function normalizeSourceZone(tzid: string | undefined, displayZone: string): string | null {
  if (tzid === undefined || tzid.length === 0) return displayZone;
  const normalized = tzid.replace(/^"|"$/g, "");
  const segments = normalized.split("/").filter((segment) => segment.length > 0);
  const candidates = [normalized, ...segments.map((_, index) => segments.slice(index).join("/"))];
  return candidates.find((candidate) => DateTime.now().setZone(candidate).isValid) ?? null;
}

function getSourceLabel(source: string): string {
  const normalized = source.replace(/[\\/]+$/, "");
  return normalized.split(/[\\/]/).at(-1) || normalized || source;
}
