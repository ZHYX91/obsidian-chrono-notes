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
export const MAX_ICS_SOURCE_BYTES = 5 * 1024 * 1024;
export const MAX_ICS_EVENTS_PER_SOURCE = 10_000;

export interface IcsParseOptions {
  readonly displayZone: string;
}

type IcalTime = InstanceType<typeof ICAL.Time>;
type IcalTimezone = InstanceType<typeof ICAL.Timezone>;
type EmbeddedTimezoneMap = ReadonlyMap<string, IcalTimezone | null>;

interface IcsDateValue {
  readonly date: LocalDate;
  readonly timeMinutes: number | null;
  readonly timestamp: number;
  readonly zone: string;
  /** Present only while source-zone arithmetic still needs the embedded VTIMEZONE. */
  readonly sourceTime?: IcalTime;
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
  readonly skippedUnsupportedTimezone: number;
}

class UnsupportedIcsTimezoneError extends Error {}

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
  if (new TextEncoder().encode(content).byteLength > MAX_ICS_SOURCE_BYTES) {
    throw new RangeError(`ICS source exceeds ${MAX_ICS_SOURCE_BYTES} bytes`);
  }
  let eventCount = 0;
  const eventPattern = /^BEGIN:VEVENT\s*$/gimu;
  while (eventPattern.exec(content) !== null) {
    eventCount += 1;
    if (eventCount > MAX_ICS_EVENTS_PER_SOURCE) {
      throw new RangeError(`ICS source exceeds ${MAX_ICS_EVENTS_PER_SOURCE} events`);
    }
  }
  const normalized = content.startsWith("\uFEFF") ? content.slice(1) : content;
  const parsed: unknown = ICAL.parse(normalized);
  if (!isJCalComponent(parsed)) {
    throw new Error("ICS source must contain exactly one calendar component");
  }
  const root = new ICAL.Component(parsed);
  const embeddedTimezones = collectEmbeddedTimezones(root);
  const components = root.name === "vevent"
    ? [root]
    : root.getAllSubcomponents("vevent");
  const events: IcsCalendarEvent[] = [];
  let skippedRecurring = 0;
  let skippedInvalid = 0;
  let skippedUnsupportedTimezone = 0;

  for (const [index, component] of components.entries()) {
    try {
      if (
        String(component.getFirstPropertyValue("status") ?? "").toUpperCase() === "CANCELLED"
      ) continue;
      if (component.hasProperty("rrule") || component.hasProperty("rdate")) {
        skippedRecurring += 1;
        continue;
      }
      const event = parseEvent(
        component,
        source,
        index,
        options.displayZone,
        embeddedTimezones,
      );
      if (event === null) skippedInvalid += 1;
      else events.push(event);
    } catch (error) {
      // An unsupported source timezone is distinct from malformed event data.
      if (error instanceof UnsupportedIcsTimezoneError) skippedUnsupportedTimezone += 1;
      else skippedInvalid += 1;
    }
  }

  return Object.freeze({
    events: Object.freeze(events),
    skippedRecurring,
    skippedInvalid,
    skippedUnsupportedTimezone,
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
          : startOfDisplayDay(occurrenceDate, event.start.zone),
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

function collectEmbeddedTimezones(
  root: InstanceType<typeof ICAL.Component>,
): EmbeddedTimezoneMap {
  const timezones = new Map<string, IcalTimezone | null>();
  if (root.name === "vevent") return timezones;

  for (const component of root.getAllSubcomponents("vtimezone")) {
    const tzid = normalizeTzid(String(component.getFirstPropertyValue("tzid") ?? ""));
    if (tzid === null) continue;
    if (timezones.has(tzid)) {
      // Duplicate definitions are ambiguous; isolate events that depend on them.
      timezones.set(tzid, null);
      continue;
    }
    try {
      timezones.set(tzid, new ICAL.Timezone({ component, tzid }));
    } catch {
      timezones.set(tzid, null);
    }
  }
  return timezones;
}

function startOfDisplayDay(date: LocalDate, zone: string): number {
  return DateTime.fromObject(
    { year: date.year, month: date.month, day: date.day },
    { zone },
  ).startOf("day").toMillis();
}

function parseEvent(
  component: InstanceType<typeof ICAL.Component>,
  source: string,
  index: number,
  displayZone: string,
  embeddedTimezones: EmbeddedTimezoneMap,
): IcsCalendarEvent | null {
  const startProperty = component.getFirstProperty("dtstart");
  if (startProperty === null) return null;
  // Keep the source zone until nominal days/weeks have been added.
  const start = parseDateProperty(startProperty, displayZone, embeddedTimezones);
  if (start === null) return null;

  const endProperty = component.getFirstProperty("dtend");
  const durationProperty = component.getFirstProperty("duration");
  if (endProperty !== null && durationProperty !== null) return null;

  let endExclusive: IcsDateValue | null;
  if (endProperty !== null) {
    endExclusive = parseDateProperty(endProperty, displayZone, embeddedTimezones);
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
  // RFC 5545 section 3.6.1: a DATE-TIME without DTEND/DURATION is a point.
  // Explicit equal ends and non-positive durations remain invalid.
  const implicitPoint = endProperty === null && durationProperty === null &&
    start.timeMinutes !== null;
  if (endExclusive.timestamp < start.timestamp ||
    (!implicitPoint && endExclusive.timestamp === start.timestamp)) return null;

  const displayedStart = inDisplayZone(start, displayZone);
  const displayedEnd = inDisplayZone(endExclusive, displayZone);
  if (displayedStart === null || displayedEnd === null) return null;
  const titleValue = component.getFirstPropertyValue("summary");
  const title = String(titleValue ?? "").trim();
  const uid = String(component.getFirstPropertyValue("uid") ?? "").trim();
  return Object.freeze({
    id: uid || `${source}#${index}`,
    source,
    sourceLabel: getSourceLabel(source),
    title,
    isAllDay: start.timeMinutes === null,
    start: displayedStart,
    endExclusive: displayedEnd,
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
  // RFC 5545 section 3.3.6: nominal days/weeks first, then exact time units.
  // P1D is not PT24H across a source-zone daylight-saving transition.
  if (start.sourceTime !== undefined) {
    const nominal = start.sourceTime.clone();
    nominal.adjust(duration.weeks * 7 + duration.days, 0, 0, 0);
    const exactSeconds =
      duration.hours * 3_600 + duration.minutes * 60 + duration.seconds;
    const timestamp = nominal.toUnixTime() * 1_000 + exactSeconds * 1_000;
    if (!Number.isFinite(timestamp)) return null;
    return Object.freeze({
      date: Object.freeze({
        year: nominal.year,
        month: nominal.month,
        day: nominal.day,
      }),
      timeMinutes: nominal.hour * 60 + nominal.minute,
      timestamp,
      zone: start.zone,
    });
  }
  const end = DateTime.fromMillis(start.timestamp, { zone: start.zone })
    .plus({ weeks: duration.weeks, days: duration.days })
    .plus({ hours: duration.hours, minutes: duration.minutes, seconds: duration.seconds });
  return fromDateTime(end, isAllDay);
}

function parseDateProperty(
  property: InstanceType<typeof ICAL.Property>,
  displayZone: string,
  embeddedTimezones: EmbeddedTimezoneMap,
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

  const hour = Number(parts[4]);
  const minute = Number(parts[5]);
  const second = Number(parts[6] ?? 0);
  const structuralValue = DateTime.fromObject(
    { year, month, day, hour, minute, second },
    { zone: "UTC" },
  );
  if (
    !structuralValue.isValid ||
    structuralValue.year !== year ||
    structuralValue.month !== month ||
    structuralValue.day !== day ||
    structuralValue.hour !== hour ||
    structuralValue.minute !== minute ||
    structuralValue.second !== second
  ) return null;

  const tzid = property.getFirstParameter("tzid")?.trim();
  if (parts[7] === "Z" || value.zone?.tzid === "UTC") {
    return fromDateTime(structuralValue, false);
  }

  const normalizedTzid = normalizeTzid(tzid);
  const embeddedTimezone = normalizedTzid === null
    ? undefined
    : embeddedTimezones.get(normalizedTzid);
  if (embeddedTimezone !== undefined) {
    if (embeddedTimezone === null) throw new UnsupportedIcsTimezoneError();
    const sourceTime = new ICAL.Time(
      { year, month, day, hour, minute, second, isDate: false },
      embeddedTimezone,
    );
    const timestamp = sourceTime.toUnixTime() * 1_000;
    if (!Number.isFinite(timestamp)) return null;
    return Object.freeze({
      date: Object.freeze({ year, month, day }),
      timeMinutes: hour * 60 + minute,
      timestamp,
      zone: normalizedTzid!,
      sourceTime,
    });
  }

  const sourceZone = normalizeSourceZone(tzid, displayZone);
  if (sourceZone === null) throw new UnsupportedIcsTimezoneError();
  const sourceValue = DateTime.fromObject(
    { year, month, day, hour, minute, second },
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
  return fromDateTime(sourceValue, false);
}

function inDisplayZone(value: IcsDateValue, displayZone: string): IcsDateValue | null {
  return value.timeMinutes === null
    ? value
    : fromDateTime(DateTime.fromMillis(value.timestamp, { zone: displayZone }), false);
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
  if (start.timeMinutes !== null) return start;
  const value = DateTime.fromMillis(start.timestamp, { zone: start.zone });
  return fromDateTime(value.plus({ days: 1 }), true)!;
}

function getInclusiveEndDate(event: IcsCalendarEvent): LocalDate {
  if (event.isAllDay) {
    return shiftPeriod(event.endExclusive.date, "daily", -1, "monday");
  }
  // A point belongs to its start date, including a point exactly at midnight.
  if (event.endExclusive.timestamp === event.start.timestamp) return event.start.date;
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

export function compareOccurrences(left: IcsEventOccurrence, right: IcsEventOccurrence): number {
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

function normalizeTzid(tzid: string | undefined): string | null {
  const normalized = tzid?.trim().replace(/^"|"$/g, "") ?? "";
  return normalized.length === 0 ? null : normalized;
}

function normalizeSourceZone(tzid: string | undefined, displayZone: string): string | null {
  const normalized = normalizeTzid(tzid);
  if (normalized === null) return displayZone;
  const segments = normalized.split("/").filter((segment) => segment.length > 0);
  const candidates = [normalized, ...segments.map((_, index) => segments.slice(index).join("/"))];
  return candidates.find((candidate) => DateTime.now().setZone(candidate).isValid) ?? null;
}

function getSourceLabel(source: string): string {
  const normalized = source.replace(/[\\/]+$/, "");
  return normalized.split(/[\\/]/).at(-1) || normalized || source;
}
