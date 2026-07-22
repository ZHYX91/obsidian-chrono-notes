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
    | "settings.appearance.singapore";
  getDay(date: LocalDate, locale: string): HolidayRegionDay;
  getYearCoverage(year: number): HolidayDataCoverage;
}

export interface SelectedRegionalHolidayDay {
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
]);

const PROVIDERS = new Map<HolidayRegion, HolidayRegionDefinition>(
  HOLIDAY_REGION_DEFINITIONS.map((definition) => [definition.id, definition]),
);
const EMPTY_HOLIDAYS: readonly RegionalHoliday[] = Object.freeze([]);

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
  const provider = PROVIDERS.get(region);
  if (provider === undefined) throw new Error(`Unknown holiday region: ${region}`);
  return Object.freeze({ region, ...provider.getDay(date, locale) });
}

export function combineRegionalHolidayDays(
  selected: readonly RegionalHolidayProviderDay[],
): SelectedRegionalHolidayDay {
  const holidays: RegionalHoliday[] = [];
  let workday: RegionalWorkday | null = null;
  let marker: RegionalMarker | null = null;
  let workMarker: RegionalMarker | null = null;

  for (const day of selected) {
    const id = day.region;
    holidays.push(...day.holidays);
    if (day.workday !== null) workday = day.workday;

    if (day.workday?.isWorkday === true && workMarker === null) {
      workMarker = Object.freeze({ kind: "work", region: id });
    } else if (marker === null && day.workday?.isWorkday === false) {
      marker = Object.freeze({ kind: "rest", region: id });
    } else if (marker === null && day.holidays.length > 0) {
      marker = Object.freeze({ kind: "holiday", region: id });
    }
  }

  return Object.freeze({
    holidays: holidays.length === 0 ? EMPTY_HOLIDAYS : Object.freeze(holidays),
    workday,
    marker: workMarker ?? marker,
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
