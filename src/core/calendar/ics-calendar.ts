import ICAL from "ical.js";
import { DateTime } from "luxon";

import {
  createIcsEmbeddedTimezone,
  IcsTimezoneBudget,
  preserveIcsTimezoneRules,
  resolveIcsEmbeddedTime,
  type IcsEmbeddedTime,
  type IcsEmbeddedTimezone,
} from "./ics-timezone";
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

type EmbeddedTimezoneMap = ReadonlyMap<string, IcsEmbeddedTimezone | null>;

interface IcsDateValue {
  readonly date: LocalDate;
  readonly timeMinutes: number | null;
  readonly timestamp: number;
  readonly zone: string;
  /** Present only while source-zone arithmetic still needs the embedded VTIMEZONE. */
  readonly sourceTime?: IcsEmbeddedTime;
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
  const unfolded = content.replace(/\r\n[ \t]|\n[ \t]|\r[ \t]/gu, "");
  while (eventPattern.exec(unfolded) !== null) {
    eventCount += 1;
    if (eventCount > MAX_ICS_EVENTS_PER_SOURCE) {
      throw new RangeError(`ICS source exceeds ${MAX_ICS_EVENTS_PER_SOURCE} events`);
    }
  }
  const normalized = unfolded.startsWith("\uFEFF") ? unfolded.slice(1) : unfolded;
  const parsed: unknown = ICAL.parse(preserveIcsTimezoneRules(normalized));
  if (!isJCalComponent(parsed)) {
    throw new Error("ICS source must contain exactly one calendar component");
  }
  const root = new ICAL.Component(parsed);
  const components = root.name === "vevent"
    ? [root]
    : root.getAllSubcomponents("vevent");
  if (components.length > MAX_ICS_EVENTS_PER_SOURCE) {
    throw new RangeError(`ICS source exceeds ${MAX_ICS_EVENTS_PER_SOURCE} events`);
  }
  const embeddedTimezones = collectEmbeddedTimezones(root, components);
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
  events: readonly InstanceType<typeof ICAL.Component>[],
): EmbeddedTimezoneMap {
  const timezones = new Map<string, IcsEmbeddedTimezone | null>();
  if (root.name === "vevent") return timezones;
  const definitions = new Map<string, InstanceType<typeof ICAL.Component> | null>();
  for (const component of root.getAllSubcomponents("vtimezone")) {
    const properties = component.getAllProperties("tzid");
    const ids = properties.map((property) => normalizeTzid(
      typeof property.jCal[3] === "string" ? property.jCal[3] : undefined,
    )).filter((id): id is string => id !== null);
    const valid = properties.length === 1 && ids.length === 1 &&
      properties[0]!.type === "text" && properties[0]!.jCal.length === 4;
    for (const tzid of ids) {
      // Preserve every ambiguous identifier, including IANA names, so none of
      // its dependent events can silently fall back to another definition.
      definitions.set(tzid, !valid || definitions.has(tzid) ? null : component);
    }
  }
  const throughYears = embeddedTimezoneCoverage(events);
  const budget = new IcsTimezoneBudget();
  for (const [tzid, component] of definitions) {
    const throughYear = throughYears.get(tzid);
    timezones.set(tzid, component === null || throughYear === undefined
      ? null
      : createIcsEmbeddedTimezone(component, throughYear, budget));
  }
  return timezones;
}

function embeddedTimezoneCoverage(
  events: readonly InstanceType<typeof ICAL.Component>[],
): ReadonlyMap<string, number> {
  const years = new Map<string, number>();
  const include = (tzid: string, wall: DateTime): void => {
    if (!wall.isValid) return;
    // A transition or gap can cross New Year. Cover the following year, and
    // include nominal duration ends before any dependent event is resolved.
    years.set(tzid, Math.min(9_999, Math.max(years.get(tzid) ?? 0, wall.year + 1)));
  };
  for (const event of events) {
    try {
      if (String(event.getFirstPropertyValue("status") ?? "").toUpperCase() === "CANCELLED" ||
        event.hasProperty("rrule") || event.hasProperty("rdate")) continue;
      for (const name of ["dtstart", "dtend"]) {
        const property = event.getFirstProperty(name);
        if (property === null || property.type !== "date-time") continue;
        const raw: unknown = property.jCal[3];
        const tzid = normalizeTzid(property.getFirstParameter("tzid"));
        if (tzid === null || typeof raw !== "string" || raw.endsWith("Z")) continue;
        const wall = DateTime.fromISO(raw, { zone: "UTC" });
        include(tzid, wall);
        if (name === "dtstart" && !event.hasProperty("dtend")) {
          const duration = event.getFirstProperty("duration")?.getFirstValue();
          if (duration instanceof ICAL.Duration && !duration.isNegative &&
            Number.isFinite(duration.toSeconds()) && duration.toSeconds() > 0) {
            include(tzid, wall.plus({ weeks: duration.weeks, days: duration.days }));
          }
        }
      }
    } catch {
      // Event validation owns malformed event fields and their invalid count.
    }
  }
  return years;
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
  const event = Object.freeze({
    id: uid || `${source}#${index}`,
    source,
    sourceLabel: getSourceLabel(source),
    title,
    isAllDay: start.timeMinutes === null,
    start: displayedStart,
    endExclusive: displayedEnd,
  });
  // Bound occupied display dates, not the exclusive end: the final supported
  // day can legitimately end at 10000-01-01 midnight. Reject invalid ranges
  // here so they count as skipped events before the shared index is built.
  return isIndexableDate(event.start.date) && isIndexableDate(getInclusiveEndDate(event))
    ? event
    : null;
}

function isIndexableDate(date: LocalDate): boolean {
  return date.year >= 0 && date.year <= 9_999;
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
    const nominal = resolveIcsEmbeddedTime({
      wall: start.sourceTime.wall.plus({ weeks: duration.weeks, days: duration.days }),
      timezone: start.sourceTime.timezone,
    });
    if (nominal === null) return null;
    const exactSeconds =
      duration.hours * 3_600 + duration.minutes * 60 + duration.seconds;
    const timestamp = nominal.timestamp + exactSeconds * 1_000;
    if (!Number.isFinite(timestamp)) return null;
    return Object.freeze({
      date: Object.freeze({
        year: nominal.wall.year,
        month: nominal.wall.month,
        day: nominal.wall.day,
      }),
      timeMinutes: nominal.wall.hour * 60 + nominal.wall.minute,
      timestamp,
      zone: start.zone,
    });
  }
  const nominal = DateTime.fromMillis(start.timestamp, { zone: start.zone })
    .plus({ weeks: duration.weeks, days: duration.days });
  const end = firstOccurrence(nominal)
    .plus({ hours: duration.hours, minutes: duration.minutes, seconds: duration.seconds });
  return fromDateTime(end, isAllDay);
}

function parseDateProperty(
  property: InstanceType<typeof ICAL.Property>,
  displayZone: string,
  embeddedTimezones: EmbeddedTimezoneMap,
): IcsDateValue | null {
  // Hydrating ICAL.Time consults every embedded timezone in the calendar.
  // Validate raw civil fields so an unrelated malformed zone cannot abort
  // this event before our source-local timezone isolation takes effect.
  if ((property.type !== "date" && property.type !== "date-time") ||
    property.jCal.length !== 4) return null;
  const isDate = property.type === "date";
  const raw = typeof property.jCal[3] === "string" ? property.jCal[3] : "";
  const parts = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?(Z)?)?$/,
  );
  if (parts === null || isDate !== (parts[4] === undefined)) return null;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  if (isDate) {
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
  if (parts[7] === "Z") {
    return fromDateTime(structuralValue, false);
  }

  const normalizedTzid = normalizeTzid(tzid);
  const embeddedTimezone = normalizedTzid === null
    ? undefined
    : embeddedTimezones.get(normalizedTzid);
  if (embeddedTimezone !== undefined) {
    if (embeddedTimezone === null) throw new UnsupportedIcsTimezoneError();
    const resolved = resolveIcsEmbeddedTime({ wall: structuralValue, timezone: embeddedTimezone });
    if (resolved === null) return null;
    return Object.freeze({
      date: Object.freeze(toLocalDate(resolved.wall as DateTime<true>)),
      timeMinutes: resolved.wall.hour * 60 + resolved.wall.minute,
      timestamp: resolved.timestamp,
      zone: normalizedTzid!,
      sourceTime: { wall: resolved.wall, timezone: embeddedTimezone },
    });
  }

  const sourceZone = normalizeSourceZone(tzid, displayZone);
  if (sourceZone === null) throw new UnsupportedIcsTimezoneError();
  const sourceValue = DateTime.fromObject(
    { year, month, day, hour, minute, second },
    { zone: sourceZone },
  );
  if (!sourceValue.isValid) return null;
  // Civil fields were validated in UTC above. A gap is interpreted with the
  // offset before the transition; an overlap uses its first occurrence.
  return fromDateTime(firstOccurrence(sourceValue), false);
}

function firstOccurrence(value: DateTime): DateTime {
  return value.getPossibleOffsets().reduce((left, right) =>
    left.toMillis() <= right.toMillis() ? left : right);
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
