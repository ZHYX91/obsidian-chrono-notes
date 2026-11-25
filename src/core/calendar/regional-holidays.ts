export type HolidayDataCoverage = "available" | "unavailable";
export const HOLIDAY_REGIONS = [
  "cn", "sg", "tw", "hk", "mo", "jp", "kr", "vn", "us",
  "gb-eng-wls", "gb-sct", "gb-nir", "de", "at", "fr", "ca-qc", "es", "mx", "br", "pt", "ru", "in",
] as const;

export type RegionalHolidayRegion = typeof HOLIDAY_REGIONS[number];
export type RegionalHolidayLocale = "en" | "zh-CN" | "zh-TW";

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

/**
 * Regional providers may expose a small curated name set, but never a
 * region-by-UI-language translation matrix. Chinese variants use their
 * explicit names; every other unsupported locale falls back to English.
 */
export function resolveRegionalHolidayLocale(locale: string): RegionalHolidayLocale {
  if (locale === "zh-CN" || locale === "zh-TW") return locale;
  const [language, scriptOrRegion, region] = locale.trim().toLowerCase().replaceAll("_", "-").split("-");
  if (language !== "zh") return "en";
  if (scriptOrRegion === "hant") return "zh-TW";
  if (scriptOrRegion === "hans") return "zh-CN";
  const country = scriptOrRegion?.length === 4 ? region : scriptOrRegion;
  return country === "tw" || country === "hk" || country === "mo" ? "zh-TW" : "zh-CN";
}
