import {
  getPeriodAnchor,
  PERIODIC_NOTE_TYPES,
  shiftPeriod,
  toDateTime,
  toLocalDate,
  type LocalDate,
  type PeriodicNoteType,
  type WeekStartDay,
} from "../../core/periodic/periodic-date";
import {
  findPeriodicNotePathMatch,
  formatPeriodicNotePath,
  parsePeriodicNotePath,
} from "../../core/periodic/periodic-note-path";
import type { PeriodicNoteSettings, RangeNoteSettings } from "../../shared/settings";
import {
  selectIntervalNotesFromProjection,
  type IntervalNoteItem,
} from "../intervals/interval-note-query";
import type { NoteIndexSnapshot } from "../notes/note-index";
import type { IntervalIndexSnapshot } from "../notes/note-index-projections";

export interface NoteNavbarQueryOptions {
  readonly locale: string;
  readonly weekStartDay: WeekStartDay;
  readonly periodicNotes: Readonly<Record<PeriodicNoteType, PeriodicNoteSettings>>;
  readonly rangeNotes: Readonly<RangeNoteSettings>;
}

export interface NoteNavbarTarget {
  readonly noteType: PeriodicNoteType;
  readonly date: LocalDate;
}

export interface NoteNavbarContext {
  readonly snapshotVersion: number;
  readonly noteType: PeriodicNoteType;
  readonly date: LocalDate;
  readonly label: string;
  readonly previous: NoteNavbarTarget;
  readonly next: NoteNavbarTarget;
  readonly higher: NoteNavbarTarget | null;
  readonly relatedIntervals: readonly IntervalNoteItem[];
}

export function selectNoteNavbarContext(
  path: string,
  snapshot: NoteIndexSnapshot,
  options: NoteNavbarQueryOptions,
): NoteNavbarContext | null {
  return selectNoteNavbarContextFromProjection(
    path,
    snapshot.intervals,
    options,
    snapshot.version,
  );
}

export function selectNoteNavbarContextFromProjection(
  path: string,
  intervals: IntervalIndexSnapshot,
  options: NoteNavbarQueryOptions,
  snapshotVersion = intervals.revision,
): NoteNavbarContext | null {
  const rules = PERIODIC_NOTE_TYPES
    .filter((noteType) => options.periodicNotes[noteType].enabled)
    .map((noteType) => ({
      noteType,
      pattern: options.periodicNotes[noteType].pattern,
    }));
  const match = findPeriodicNotePathMatch(path, rules, options);
  if (match === null) return null;

  const higher = findHigherTarget(match.noteType, match.date, options);
  return Object.freeze({
    snapshotVersion,
    noteType: match.noteType,
    date: match.date,
    label: formatNavbarLabel(match.date, match.noteType, options.locale, options.weekStartDay),
    previous: freezeTarget(
      match.noteType,
      shiftPeriod(match.date, match.noteType, -1, options.weekStartDay),
    ),
    next: freezeTarget(
      match.noteType,
      shiftPeriod(match.date, match.noteType, 1, options.weekStartDay),
    ),
    higher,
    relatedIntervals: selectRelatedIntervals(match, intervals, options),
  });
}

function selectRelatedIntervals(
  match: Readonly<{ noteType: PeriodicNoteType; date: LocalDate }>,
  intervals: IntervalIndexSnapshot,
  options: NoteNavbarQueryOptions,
): readonly IntervalNoteItem[] {
  const range = getRelatedRange(match.date, match.noteType, options.weekStartDay);
  if (range === null) return Object.freeze([]);
  const start = toDateTime(range.start);
  const end = toDateTime(range.end);
  return Object.freeze(selectIntervalNotesFromProjection(
    intervals,
    options.rangeNotes,
  ).items.filter((item) =>
    toDateTime(item.end.date) >= start && toDateTime(item.start.date) <= end));
}

function getRelatedRange(
  date: LocalDate,
  noteType: PeriodicNoteType,
  weekStartDay: WeekStartDay,
): Readonly<{ start: LocalDate; end: LocalDate }> | null {
  if (noteType === "weekly") {
    const start = getPeriodAnchor(date, "weekly", weekStartDay);
    return Object.freeze({
      start,
      end: shiftPeriod(start, "daily", 6, weekStartDay),
    });
  }
  if (noteType === "monthly") {
    const start = getPeriodAnchor(date, "monthly", weekStartDay);
    return Object.freeze({
      start,
      end: toLocalDate(toDateTime(start).endOf("month")),
    });
  }
  return null;
}

function findHigherTarget(
  noteType: PeriodicNoteType,
  date: LocalDate,
  options: NoteNavbarQueryOptions,
): NoteNavbarTarget | null {
  const index = PERIODIC_NOTE_TYPES.indexOf(noteType);
  for (const candidate of PERIODIC_NOTE_TYPES.slice(index + 1)) {
    const config = options.periodicNotes[candidate];
    if (!config.enabled || config.pattern.trim().length === 0) continue;
    const anchor = getPeriodAnchor(date, candidate, options.weekStartDay);
    const rule = { noteType: candidate, pattern: config.pattern } as const;
    const path = formatPeriodicNotePath(anchor, rule, options);
    if (path !== null && parsePeriodicNotePath(path, rule, options) !== null) {
      return freezeTarget(candidate, anchor);
    }
  }
  return null;
}

function freezeTarget(noteType: PeriodicNoteType, date: LocalDate): NoteNavbarTarget {
  return Object.freeze({ noteType, date });
}

function formatNavbarLabel(
  date: LocalDate,
  noteType: PeriodicNoteType,
  locale: string,
  weekStartDay: WeekStartDay,
): string {
  const value = toDateTime(date).setLocale(locale);
  const chinese = locale === "zh-CN" || locale === "zh-TW";
  switch (noteType) {
    case "daily":
      return value.toFormat("yyyy-MM-dd");
    case "weekly": {
      const reference = weekStartDay === "sunday" ? value.plus({ days: 1 }) : value;
      return chinese ? `第${reference.weekNumber}周` : `Week ${reference.weekNumber}`;
    }
    case "monthly":
      return chinese ? `${value.month}月` : value.toFormat("LLL");
    case "quarterly":
      return `Q${value.quarter}`;
    case "yearly":
      return chinese ? `${value.year}年` : String(value.year);
  }
}
