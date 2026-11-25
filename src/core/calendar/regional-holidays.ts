import { resolveContentLocale, type ChineseContentLocale } from "./content-locale";

export type HolidayDataCoverage = "available" | "unavailable";
export const HOLIDAY_REGIONS = [
  "cn", "sg", "tw", "hk", "mo", "jp", "kr", "vn", "us",
  "gb-eng-wls", "gb-sct", "gb-nir", "de", "at", "fr", "ca-qc", "es", "mx", "br", "pt", "ru", "in",
] as const;

export type RegionalHolidayRegion = typeof HOLIDAY_REGIONS[number];
export type RegionalHolidayLocale = "en" | ChineseContentLocale;

export interface RegionalHoliday {
  readonly region: RegionalHolidayRegion;
  readonly name: string;
  readonly conditional?: true;
}

export interface RegionalWorkday {
  readonly region: RegionalHolidayRegion;
  readonly name: string;
  readonly isWorkday: boolean;
}

export function resolveRegionalHolidayLocale(locale: string): RegionalHolidayLocale {
  return resolveContentLocale(locale, []);
}
