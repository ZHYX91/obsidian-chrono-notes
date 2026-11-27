import { getPublishedHolidayDay, getPublishedHolidayYearCoverage, PUBLISHED_HOLIDAY_REGIONS, type PublishedHolidayRegion } from "../../core/calendar/published-holidays";
import type {
  HolidayDataCoverage,
  RegionalHoliday,
  RegionalWorkday,
} from "../../core/calendar/regional-holidays";
import {
  getChinaHolidayDay,
  getChinaHolidayYearCoverage,
} from "../../core/calendar/china-holidays";
import {
  getSingaporeHolidayDay,
  getSingaporeHolidayYearCoverage,
} from "../../core/calendar/singapore-holidays";
import type { LocalDate } from "../../core/periodic/periodic-date";
import type { HolidayRegion } from "../../shared/settings";

export type RegionalMarkerKind = "work" | "rest" | "holiday";

export interface RegionalMarker {
  readonly kind: RegionalMarkerKind;
  readonly region: HolidayRegion;
}

interface HolidayRegionDay {
  readonly holidays: readonly RegionalHoliday[];
  readonly workday: RegionalWorkday | null;
}

export interface HolidayRegionDefinition {
  readonly id: HolidayRegion;
  readonly labelKey:
    | "settings.appearance.mainlandChina"
    | "settings.appearance.singapore"
    | `holiday.region.${PublishedHolidayRegion}`;
  getDay(date: LocalDate, locale: string): HolidayRegionDay;
  getYearCoverage(year: number): HolidayDataCoverage;
}

export interface SelectedRegionalHolidayDay {
  readonly regionalDays: readonly RegionalHolidayProviderDay[];
  readonly holidays: readonly RegionalHoliday[];
  readonly workday: RegionalWorkday | null;
  readonly marker: RegionalMarker | null;
}

export interface RegionalHolidayProviderDay extends HolidayRegionDay {
  readonly region: HolidayRegion;
}

export const HOLIDAY_REGION_DEFINITIONS: readonly HolidayRegionDefinition[] = Object.freeze([
  Object.freeze({
    id: "cn",
    labelKey: "settings.appearance.mainlandChina",
    getDay: getChinaHolidayDay,
    getYearCoverage: getChinaHolidayYearCoverage,
  }),
  Object.freeze({
    id: "sg",
    labelKey: "settings.appearance.singapore",
    getDay: (date: LocalDate, locale: string) => {
      const day = getSingaporeHolidayDay(date, locale);
      return Object.freeze({ holidays: day.holidays, workday: null });
    },
    getYearCoverage: getSingaporeHolidayYearCoverage,
  }),
  ...PUBLISHED_HOLIDAY_REGIONS.map((id) => Object.freeze({
    id,
    labelKey: `holiday.region.${id}` as const,
    getDay: (date: LocalDate, locale: string) => getPublishedHolidayDay(id, date, locale),
    getYearCoverage: (year: number) => getPublishedHolidayYearCoverage(id, year),
  })),
]);

const PROVIDERS = new Map<HolidayRegion, HolidayRegionDefinition>(
  HOLIDAY_REGION_DEFINITIONS.map((definition) => [definition.id, definition]),
);
const EMPTY_HOLIDAYS: readonly RegionalHoliday[] = Object.freeze([]);
const EMPTY_REGIONAL_DAYS: readonly RegionalHolidayProviderDay[] = Object.freeze([]);

export function getHolidayRegionDefinition(region: HolidayRegion): HolidayRegionDefinition {
  const definition = PROVIDERS.get(region);
  if (definition === undefined) throw new Error(`Unknown holiday region: ${region}`);
  return definition;
}

export function selectRegionalHolidayDay(
  date: LocalDate,
  locale: string,
  selected: readonly HolidayRegion[],
): SelectedRegionalHolidayDay {
  return combineRegionalHolidayDays(selected.map((region) =>
    selectRegionalHolidayProviderDay(date, locale, region)));
}

export function selectRegionalHolidayProviderDay(
  date: LocalDate,
  locale: string,
  region: HolidayRegion,
): RegionalHolidayProviderDay {
  return Object.freeze({ region, ...getHolidayRegionDefinition(region).getDay(date, locale) });
}

export function combineRegionalHolidayDays(
  selected: readonly RegionalHolidayProviderDay[],
): SelectedRegionalHolidayDay {
  const holidays: RegionalHoliday[] = [];
  let workday: RegionalWorkday | null = null;
  let marker: RegionalMarker | null = null;
  const active: RegionalHolidayProviderDay[] = [];

  for (const day of selected) {
    if (day.holidays.length === 0 && day.workday === null) continue;
    active.push(day);
    const id = day.region;
    holidays.push(...day.holidays);
    if (day.workday && (!workday || (!workday.isWorkday && day.workday.isWorkday))) {
      workday = day.workday;
    }

    if (day.workday?.isWorkday === true && marker?.kind !== "work") {
      marker = Object.freeze({ kind: "work", region: id });
    } else if (marker === null && day.workday?.isWorkday === false) {
      marker = Object.freeze({ kind: "rest", region: id });
    } else if (marker === null && day.holidays.some(holiday => !holiday.conditional)) {
      marker = Object.freeze({ kind: "holiday", region: id });
    }
  }

  return Object.freeze({
    holidays: holidays.length === 0 ? EMPTY_HOLIDAYS : Object.freeze(holidays),
    workday,
    marker,
    regionalDays: active.length > 0 ? Object.freeze(active) : EMPTY_REGIONAL_DAYS,
  });
}

export function updateHolidayRegionSlot(
  selected: readonly HolidayRegion[],
  slot: 0 | 1 | 2,
  nextId: HolidayRegion | null,
): readonly HolidayRegion[] {
  const slots: [HolidayRegion | null, HolidayRegion | null, HolidayRegion | null] = [
    selected[0] ?? null,
    selected[1] ?? null,
    selected[2] ?? null,
  ];
  slots[slot] = nextId;
  return Object.freeze(slots.filter(
    (id, index): id is HolidayRegion => id !== null && slots.indexOf(id) === index,
  ));
}
