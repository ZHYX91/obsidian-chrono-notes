import { Solar, type Lunar } from "lunar-typescript";

import { compareLocalDate, type LocalDate } from "../periodic/periodic-date";
import { toJulianDate } from "./julian";
import { withLunarLibraryLanguage } from "./lunar-library-language";

/**
 * One expensive solar-to-lunar conversion shared by lunar-based extensions.
 * The library object is scoped to the caller-owned cache, never a module global.
 */
export interface LunarDateContext {
  readonly lunar: Lunar;
}

/** The library omits these reform dates; the primary Gregorian calendar does not. */
export function isLunarDateSupported(date: LocalDate): boolean {
  return date.year !== 1582 || date.month !== 10 || date.day < 5 || date.day > 14;
}

export function createLunarDateContext(date: LocalDate): LunarDateContext {
  // Solar reads dates before the reform as Julian. Supply the same civil day
  // shown by the proleptic Gregorian grid in the calendar the library expects.
  const solarDate = compareLocalDate(date, { year: 1582, month: 10, day: 5 }) < 0
    ? toJulianDate(date) : date;
  return withLunarLibraryLanguage("zh-CN", () => Object.freeze({
    lunar: Solar.fromYmd(solarDate.year, solarDate.month, solarDate.day).getLunar(),
  }));
}
