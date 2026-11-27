import { formatLocalDateKey, type LocalDate } from "../periodic/periodic-date";
import { AMERICAS } from "./holiday-data/americas";
import { EAST_ASIA } from "./holiday-data/east-asia";
import { EUROPE } from "./holiday-data/europe";
import { SOUTH_AND_SOUTHEAST_ASIA } from "./holiday-data/south-and-southeast-asia";
import type { HolidayEntry, HolidaySchedule, PublishedHolidaySource } from "./holiday-data/schedule";
import { calendarLanguageKey } from "./content-locale";
import {
  type HolidayDataCoverage,
  type RegionalHoliday,
  type RegionalWorkday,
} from "./regional-holidays";

const schedules = { ...EAST_ASIA, ...AMERICAS, ...EUROPE, ...SOUTH_AND_SOUTHEAST_ASIA };
export type PublishedHolidayRegion = keyof typeof schedules;
export const PUBLISHED_HOLIDAY_REGIONS = Object.freeze(
  Object.keys(schedules) as PublishedHolidayRegion[],
);

interface ScheduleIndex {
  readonly dates: ReadonlyMap<string, readonly HolidayEntry[]>;
  readonly years: ReadonlySet<number>;
}

const entriesByRegion = new Map<PublishedHolidayRegion, ScheduleIndex>();
const EMPTY_HOLIDAYS: readonly RegionalHoliday[] = Object.freeze([]);
const EMPTY_DAY = Object.freeze({ holidays: EMPTY_HOLIDAYS, workday: null });

function dateIndex(region: PublishedHolidayRegion): ScheduleIndex {
  const existing = entriesByRegion.get(region);
  if (existing) return existing;

  const dates = new Map<string, HolidayEntry[]>();
  const years = new Set<number>();
  for (const entry of schedules[region].entries) {
    for (const date of entry.dates) {
      years.add(Number(date.slice(0, 4)));
      const sameDay = dates.get(date);
      if (sameDay) sameDay.push(entry);
      else dates.set(date, [entry]);
    }
  }
  const index = { dates, years };
  entriesByRegion.set(region, index);
  return index;
}

function localizedName(entry: HolidayEntry, locale: string): string {
  const key = calendarLanguageKey(locale);
  return Object.hasOwn(entry.names, key) ? entry.names[key] ?? entry.en : entry.en;
}

export function getPublishedHolidayDay(
  region: PublishedHolidayRegion,
  date: LocalDate,
  locale: string,
): { readonly holidays: readonly RegionalHoliday[]; readonly workday: RegionalWorkday | null } {
  const entries = dateIndex(region).dates.get(formatLocalDateKey(date));
  if (entries === undefined) return EMPTY_DAY;

  const holidays: RegionalHoliday[] = [];
  let workday: RegionalWorkday | null = null;
  for (const entry of entries) {
    const name = localizedName(entry, locale);
    if (entry.kind === "conditional") {
      holidays.push(Object.freeze({ region, name, conditional: true }));
    } else {
      if (entry.kind !== "work") holidays.push(Object.freeze({ region, name }));
      if (entry.kind) workday = Object.freeze({ region, name, isWorkday: entry.kind === "work" });
    }
  }
  return Object.freeze({
    holidays: holidays.length > 0 ? Object.freeze(holidays) : EMPTY_HOLIDAYS,
    workday,
  });
}

export function getPublishedHolidayYearCoverage(
  region: PublishedHolidayRegion,
  year: number,
): HolidayDataCoverage {
  // A substitute date can fall outside the years whose full schedules were reviewed.
  const schedule: HolidaySchedule = schedules[region];
  return schedule.sources[year]?.status === "published" && dateIndex(region).years.has(year)
    ? "available" : "unavailable";
}

export function getHolidayPublicationSource(
  region: PublishedHolidayRegion,
  year: number,
): PublishedHolidaySource | null {
  const schedule: HolidaySchedule = schedules[region];
  const source = schedule.sources[year];
  return source === undefined ? null : Object.freeze({ ...source });
}
