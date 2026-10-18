import ICAL from "ical.js";
import { DateTime } from "luxon";

// These are source-wide upper bounds on candidate work and transition candidates.
// Reserve the complete upper bound before expanding a zone: rejecting a dense
// rule must leave the budget available to ordinary zones in the same source.
export const MAX_ICS_TIMEZONE_WORK = 100_000;
export const MAX_ICS_TIMEZONE_TRANSITIONS = 10_000;

const DAY_MILLISECONDS = 86_400_000;
const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
const RULE_PARTS = new Set([
  "freq", "interval", "count", "until", "wkst", "bymonth", "bymonthday",
  "byyearday", "byday", "byhour", "byminute", "bysecond", "bysetpos",
]);

type Component = InstanceType<typeof ICAL.Component>;
type Property = InstanceType<typeof ICAL.Property>;

interface Transition {
  readonly utc: number;
  readonly lower: number;
  readonly upper: number;
  readonly from: number;
  readonly to: number;
}

export interface IcsEmbeddedTimezone {
  readonly transitions: readonly Transition[];
  readonly throughYear: number;
}

export interface IcsEmbeddedTime {
  /** Civil fields held in UTC only to do calendar arithmetic without a zone. */
  readonly wall: DateTime;
  readonly timezone: IcsEmbeddedTimezone;
}

interface YearlyRule {
  readonly interval: number;
  readonly count: number | null;
  readonly until: number | null;
  readonly months: ReadonlySet<number> | null;
  readonly monthDays: ReadonlySet<number> | null;
  readonly yearDays: ReadonlySet<number> | null;
  readonly weekdays: ReadonlySet<string> | null;
  readonly hours: readonly number[];
  readonly minutes: readonly number[];
  readonly seconds: readonly number[];
  readonly positions: ReadonlySet<number> | null;
}

interface Observance {
  readonly start: DateTime;
  readonly from: number;
  readonly to: number;
  readonly rdates: readonly number[];
  readonly rule: YearlyRule | null;
}

export class IcsTimezoneBudget {
  private work = MAX_ICS_TIMEZONE_WORK;
  private transitions = MAX_ICS_TIMEZONE_TRANSITIONS;

  reserve(work: number, transitions: number): void {
    if (work > this.work || transitions > this.transitions) {
      throw new RangeError("ICS timezone expansion budget exceeded");
    }
    this.work -= work;
    this.transitions -= transitions;
  }
}

export function preserveIcsTimezoneRules(unfolded: string): string {
  let timezoneDepth = 0;
  return unfolded.split(/\r\n|\n|\r/u).map((line) => {
    if (/^BEGIN:VTIMEZONE\s*$/iu.test(line)) timezoneDepth += 1;
    if (/^END:VTIMEZONE\s*$/iu.test(line)) timezoneDepth -= 1;
    if (timezoneDepth <= 0 || !/^RRULE[;:]/iu.test(line)) return line;
    // ICAL.parse otherwise validates/normalizes recurrence values before we
    // can isolate a bad timezone (including silently changing INTERVAL=0).
    // Keep the original property as escaped TEXT in this parse only; no design
    // registry or library prototype is changed. VEVENT rules remain untouched.
    const escaped = line.replace(/\\/gu, "\\\\").replace(/;/gu, "\\;").replace(/,/gu, "\\,");
    return `RRULE;VALUE=TEXT:${escaped}`;
  }).join("\r\n");
}

export function createIcsEmbeddedTimezone(
  component: Component,
  throughYear: number,
  budget: IcsTimezoneBudget,
): IcsEmbeddedTimezone | null {
  try {
    if (!Number.isInteger(throughYear) || throughYear < 0 || throughYear > 9_999) return null;
    const components = component.getAllSubcomponents();
    if (components.length === 0 || components.length > MAX_ICS_TIMEZONE_TRANSITIONS) {
      return null;
    }
    const observances = components.map(readObservance);
    let work = 0;
    let count = 0;
    for (const observance of observances) {
      const bound = expansionBound(observance, throughYear);
      work += bound.work;
      count += bound.transitions;
    }
    budget.reserve(work, count);

    const transitions: Transition[] = [];
    for (const observance of observances) {
      addTransition(transitions, observance.start.toMillis(), observance);
      for (const wall of observance.rdates) addTransition(transitions, wall, observance);
      expandYearly(transitions, observance, throughYear);
    }
    transitions.sort((left, right) => left.utc - right.utc);
    const unique: Transition[] = [];
    for (const transition of transitions) {
      const previous = unique.at(-1);
      if (previous?.utc === transition.utc) {
        if (previous.from !== transition.from || previous.to !== transition.to) return null;
        continue;
      }
      // Overlapping transition windows cannot provide an unambiguous local
      // timeline. Reject the definition instead of guessing an offset.
      if (previous !== undefined && previous.upper > transition.lower) return null;
      unique.push(Object.freeze(transition));
    }
    return Object.freeze({ transitions: Object.freeze(unique), throughYear });
  } catch {
    return null;
  }
}

export function resolveIcsEmbeddedTime(
  time: IcsEmbeddedTime,
): Readonly<{ wall: DateTime; timestamp: number }> | null {
  const { wall, timezone } = time;
  if (!wall.isValid || wall.year > timezone.throughYear) return null;
  const timestamp = wall.toMillis();
  const transitions = timezone.transitions;
  let low = 0;
  let high = transitions.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (transitions[middle]!.lower <= timestamp) low = middle + 1;
    else high = middle;
  }
  const transition = transitions[Math.max(0, low - 1)]!;
  const before = low === 0 || timestamp < transition.upper;
  const offset = before ? transition.from : transition.to;
  // RFC 5545 section 3.3.5: first occurrence in an overlap; pre-transition
  // offset in a gap. Normalize a gap before subsequent nominal-day arithmetic.
  const gap = low > 0 && before && transition.to > transition.from;
  return Object.freeze({
    wall: gap ? wall.plus({ seconds: transition.to - transition.from }) : wall,
    timestamp: timestamp - offset * 1_000,
  });
}

function readObservance(component: Component): Observance {
  if ((component.name !== "standard" && component.name !== "daylight") ||
    component.getAllSubcomponents().length !== 0 ||
    component.hasProperty("exdate") || component.hasProperty("exrule")) {
    throw new Error("Unsupported ICS timezone observance");
  }
  const startProperty = singleProperty(component, "dtstart", "date-time");
  requireLocalProperty(startProperty);
  const start = readWallTime(startProperty.jCal[3]);
  const from = readOffset(singleProperty(component, "tzoffsetfrom", "utc-offset"));
  const to = readOffset(singleProperty(component, "tzoffsetto", "utc-offset"));
  const rdates: number[] = [];
  for (const property of component.getAllProperties("rdate")) {
    requireLocalProperty(property);
    if (property.type !== "date-time" || property.jCal.length < 4 ||
      rdates.length + property.jCal.length - 3 > MAX_ICS_TIMEZONE_TRANSITIONS) {
      throw new Error("Unsupported ICS timezone recurrence dates");
    }
    // A single RDATE property can contain several values, including dates in
    // different years. DTSTART remains part of the recurrence set as well.
    for (let index = 3; index < property.jCal.length; index += 1) {
      rdates.push(readWallTime(property.jCal[index]).toMillis());
    }
  }
  const rules = component.getAllProperties("rrule");
  if (rules.length > 1) throw new Error("Ambiguous ICS timezone recurrence");
  const rule = rules.length === 0 ? null : readYearlyRule(rules[0]!, start, from);
  return { start, from, to, rdates, rule };
}

function singleProperty(component: Component, name: string, type: string): Property {
  const properties = component.getAllProperties(name);
  const property = properties[0];
  if (properties.length !== 1 || property?.type !== type || property.jCal.length !== 4) {
    throw new Error(`Invalid ICS timezone ${name}`);
  }
  return property;
}

function requireLocalProperty(property: Property): void {
  if (property.getFirstParameter("tzid") !== undefined) {
    throw new Error("ICS timezone observances must use local time without TZID");
  }
}

function readWallTime(value: unknown): DateTime {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/u.test(value)) {
    throw new Error("Invalid ICS timezone local date-time");
  }
  const result = DateTime.fromISO(value, { zone: "UTC" });
  if (!result.isValid || result.toFormat("yyyy-MM-dd'T'HH:mm:ss") !== value) {
    throw new Error("Invalid ICS timezone civil date-time");
  }
  return result;
}

function readOffset(property: Property): number {
  const value: unknown = property.jCal[3];
  const match = typeof value === "string"
    ? value.match(/^([+-])(\d{2}):(\d{2})(?::(\d{2}))?$/u)
    : null;
  if (match === null) throw new Error("Invalid ICS timezone UTC offset");
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  const seconds = Number(match[4] ?? 0);
  const magnitude = hours * 3_600 + minutes * 60 + seconds;
  if (hours > 23 || minutes > 59 || seconds > 59 || (match[1] === "-" && magnitude === 0)) {
    throw new Error("Invalid ICS timezone UTC offset");
  }
  return match[1] === "-" ? -magnitude : magnitude;
}

function readYearlyRule(property: Property, start: DateTime, offset: number): YearlyRule {
  const value: unknown = property.jCal[3];
  if (property.type !== "text" || property.jCal.length !== 4 || typeof value !== "string") {
    throw new Error("Invalid ICS timezone recurrence rule");
  }
  const parts = readRuleParts(value);
  if (parts.freq !== "YEARLY" || (parts.wkst !== undefined &&
    (typeof parts.wkst !== "string" || !WEEKDAYS.some((day) => day === parts.wkst)))) {
    throw new Error("Unsupported ICS timezone recurrence rule");
  }
  const interval = positiveInteger(parts.interval ?? 1);
  const count = parts.count === undefined ? null : positiveInteger(parts.count);
  let until: number | null = null;
  if (parts.until !== undefined) {
    if (count !== null || typeof parts.until !== "string" || !parts.until.endsWith("Z")) {
      throw new Error("Invalid ICS timezone recurrence end");
    }
    until = readWallTime(parts.until.slice(0, -1)).toMillis() + offset * 1_000;
    if (until < start.toMillis()) throw new Error("ICS timezone recurrence ends before DTSTART");
  }
  const months = numberSet(parts.bymonth, 1, 12);
  const monthDays = numberSet(parts.bymonthday, -31, 31, true);
  const yearDays = numberSet(parts.byyearday, -366, 366, true);
  const weekdays = weekdaySet(parts.byday);
  const hours = [...(numberSet(parts.byhour, 0, 23) ?? [start.hour])].sort(numericOrder);
  const minutes = [...(numberSet(parts.byminute, 0, 59) ?? [start.minute])].sort(numericOrder);
  const seconds = [...(numberSet(parts.bysecond, 0, 59) ?? [start.second])].sort(numericOrder);
  const positions = numberSet(parts.bysetpos, -366, 366, true);
  if (positions !== null && !Object.keys(parts).some((key) =>
    key.startsWith("by") && key !== "bysetpos")) {
    throw new Error("ICS timezone BYSETPOS requires another BY rule");
  }
  return { interval, count, until, months, monthDays, yearDays, weekdays,
    hours, minutes, seconds, positions };
}

function readRuleParts(line: string): Readonly<Record<string, unknown>> {
  const [header, ...body] = splitOutsideQuotes(line, ":");
  if (body.length !== 1) throw new Error("Invalid ICS timezone recurrence property");
  const [name, ...parameters] = splitOutsideQuotes(header!, ";");
  if (name?.toUpperCase() !== "RRULE") throw new Error("Invalid ICS timezone recurrence property");
  let hasValue = false;
  for (const parameter of parameters) {
    const match = parameter.match(/^([A-Z\d-]+)=(.+)$/iu);
    if (match === null) throw new Error("Invalid ICS timezone recurrence parameter");
    if (match[1]!.toUpperCase() !== "VALUE") continue;
    if (hasValue || match[2]!.replace(/^"|"$/gu, "").toUpperCase() !== "RECUR") {
      throw new Error("Invalid ICS timezone recurrence type");
    }
    hasValue = true;
  }
  const parts: Record<string, unknown> = {};
  for (const part of body[0]!.split(";")) {
    const match = part.match(/^([A-Z]+)=(.+)$/iu);
    const key = match?.[1]?.toLowerCase();
    if (key === undefined || !RULE_PARTS.has(key) || Object.hasOwn(parts, key)) {
      throw new Error("Unsupported or duplicate ICS timezone recurrence part");
    }
    const raw = match![2]!;
    if (key === "freq" || key === "wkst") parts[key] = raw.toUpperCase();
    else if (key === "until") {
      if (!/^\d{8}T\d{6}Z$/iu.test(raw)) throw new Error("Invalid ICS timezone recurrence end");
      parts[key] = raw.toUpperCase().replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/u,
        "$1-$2-$3T$4:$5:$6Z");
    } else {
      const values = raw.split(",");
      if (values.length > 749) throw new Error("Too many ICS timezone recurrence values");
      const parsed = key === "byday" ? values : values.map((entry) => {
        if (!/^[+-]?\d+$/u.test(entry)) throw new Error("Invalid ICS timezone recurrence number");
        return Number(entry);
      });
      parts[key] = parsed.length === 1 ? parsed[0] : parsed;
    }
  }
  return parts;
}

function splitOutsideQuotes(value: string, delimiter: string): string[] {
  const parts: string[] = [];
  let quoted = false;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '"') quoted = !quoted;
    if (value[index] === delimiter && !quoted) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }
  if (quoted) throw new Error("Invalid ICS timezone property quoting");
  parts.push(value.slice(start));
  return parts;
}

function positiveInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error("Invalid ICS timezone recurrence integer");
  }
  return value;
}

function numberSet(
  value: unknown,
  min: number,
  max: number,
  excludeZero = false,
): ReadonlySet<number> | null {
  if (value === undefined) return null;
  const values: unknown[] = Array.isArray(value) ? value : [value];
  if (values.length === 0 || values.length > max - min + 1 || values.some((entry) =>
    typeof entry !== "number" || !Number.isInteger(entry) || entry < min || entry > max ||
    (excludeZero && entry === 0))) {
    throw new Error("Invalid ICS timezone recurrence values");
  }
  return new Set(values as number[]);
}

function weekdaySet(value: unknown): ReadonlySet<string> | null {
  if (value === undefined) return null;
  const values: unknown[] = Array.isArray(value) ? value : [value];
  if (values.length === 0 || values.length > 749) {
    throw new Error("Invalid ICS timezone weekdays");
  }
  const result = new Set<string>();
  for (const entry of values) {
    const match = typeof entry === "string"
      ? entry.toUpperCase().match(/^([+-]?\d{1,2})?(MO|TU|WE|TH|FR|SA|SU)$/u)
      : null;
    if (match === null || (match[1] !== undefined &&
      (Number(match[1]) === 0 || Math.abs(Number(match[1])) > 53))) {
      throw new Error("Invalid ICS timezone weekday");
    }
    result.add(`${match[1] === undefined ? "" : Number(match[1])}${match[2]}`);
  }
  return result;
}

function expansionBound(observance: Observance, throughYear: number): {
  work: number;
  transitions: number;
} {
  const fixed = observance.rdates.length + 1;
  const rule = observance.rule;
  if (rule === null) return { work: fixed, transitions: fixed };
  const years = Math.max(0,
    Math.floor((lastRuleYear(rule, throughYear) - observance.start.year) / rule.interval) + 1);
  const months = ruleMonths(rule, observance.start).length;
  const expandsDays = rule.monthDays !== null || rule.yearDays !== null || rule.weekdays !== null;
  const scannedDays = expandsDays ? months * 31 : months;
  let matchingDays = scannedDays;
  if (rule.monthDays !== null) matchingDays = Math.min(matchingDays, rule.monthDays.size * months);
  if (rule.yearDays !== null) matchingDays = Math.min(matchingDays, rule.yearDays.size);
  if (rule.weekdays !== null) {
    let weekdayBound = 0;
    for (const weekday of rule.weekdays) {
      weekdayBound += weekday.length === 2 ? (rule.months === null ? 53 : 5 * months)
        : (rule.months === null ? 1 : months);
    }
    matchingDays = Math.min(matchingDays, weekdayBound);
  }
  const timeCount = rule.hours.length * rule.minutes.length * rule.seconds.length;
  const candidates = matchingDays * timeCount;
  const selected = rule.positions === null ? candidates : Math.min(candidates, rule.positions.size);
  return {
    work: fixed + years * (1 + months + scannedDays + candidates),
    transitions: fixed + Math.min(years * selected, rule.count ?? Infinity),
  };
}

function expandYearly(
  transitions: Transition[],
  observance: Observance,
  throughYear: number,
): void {
  const rule = observance.rule;
  if (rule === null) return;
  const months = ruleMonths(rule, observance.start);
  const expandsDays = rule.monthDays !== null || rule.yearDays !== null || rule.weekdays !== null;
  let count = 0;
  const lastYear = lastRuleYear(rule, throughYear);
  for (let year = observance.start.year; year <= lastYear; year += rule.interval) {
    const candidates: number[] = [];
    for (const month of months) {
      const first = DateTime.utc(year, month, 1);
      const daysInMonth = first.daysInMonth!;
      const firstDay = expandsDays ? 1 : observance.start.day;
      const lastDay = expandsDays ? daysInMonth : Math.min(daysInMonth, firstDay);
      for (let day = firstDay; day <= lastDay; day += 1) {
        if (!matchesDay(rule, first, day)) continue;
        const midnight = first.toMillis() + (day - 1) * DAY_MILLISECONDS;
        for (const hour of rule.hours) {
          for (const minute of rule.minutes) {
            for (const second of rule.seconds) {
              candidates.push(midnight + (hour * 3_600 + minute * 60 + second) * 1_000);
            }
          }
        }
      }
    }
    for (const [index, wall] of candidates.entries()) {
      if (rule.positions !== null && !rule.positions.has(index + 1) &&
        !rule.positions.has(index - candidates.length)) continue;
      if (wall < observance.start.toMillis()) continue;
      if (rule.until !== null && wall > rule.until) return;
      if (rule.count !== null && count >= rule.count) return;
      count += 1;
      addTransition(transitions, wall, observance);
    }
  }
}

function ruleMonths(rule: YearlyRule, start: DateTime): readonly number[] {
  if (rule.months !== null) return [...rule.months].sort(numericOrder);
  return rule.monthDays !== null || rule.yearDays !== null || rule.weekdays !== null
    ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    : [start.month];
}

function lastRuleYear(rule: YearlyRule, throughYear: number): number {
  return Math.min(throughYear,
    rule.until === null ? throughYear : DateTime.fromMillis(rule.until, { zone: "UTC" }).year);
}

function matchesDay(rule: YearlyRule, first: DateTime, day: number): boolean {
  if (rule.monthDays !== null && !rule.monthDays.has(day) &&
    !rule.monthDays.has(day - first.daysInMonth! - 1)) return false;
  const ordinal = first.ordinal + day - 1;
  if (rule.yearDays !== null && !rule.yearDays.has(ordinal) &&
    !rule.yearDays.has(ordinal - first.daysInYear - 1)) return false;
  if (rule.weekdays === null) return true;
  const weekday = WEEKDAYS[(first.weekday + day - 2) % 7]!;
  const position = rule.months === null ? ordinal : day;
  const length = rule.months === null ? first.daysInYear : first.daysInMonth!;
  return rule.weekdays.has(weekday) ||
    rule.weekdays.has(`${Math.floor((position - 1) / 7) + 1}${weekday}`) ||
    rule.weekdays.has(`${-Math.floor((length - position) / 7) - 1}${weekday}`);
}

function addTransition(transitions: Transition[], wall: number, observance: Observance): void {
  const after = wall + (observance.to - observance.from) * 1_000;
  transitions.push({
    utc: wall - observance.from * 1_000,
    lower: Math.min(wall, after),
    upper: Math.max(wall, after),
    from: observance.from,
    to: observance.to,
  });
}

function numericOrder(left: number, right: number): number {
  return left - right;
}
