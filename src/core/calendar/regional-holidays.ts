export type HolidayDataCoverage = "available" | "unavailable";
export type RegionalHolidayRegion = "cn" | "sg";
export type RegionalHolidayLocale = "en" | "zh-CN" | "zh-TW";

export interface RegionalHoliday {
  readonly region: RegionalHolidayRegion;
  readonly name: string;
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
  const normalized = locale.toLowerCase();
  if (
    normalized.startsWith("zh-tw") ||
    normalized.startsWith("zh-hk") ||
    normalized.includes("hant")
  ) return "zh-TW";
  if (normalized.startsWith("zh")) return "zh-CN";
  return "en";
}
