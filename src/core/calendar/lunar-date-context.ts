import { Solar, type Lunar } from "lunar-typescript";

import type { LocalDate } from "../periodic/periodic-date";
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
  return withLunarLibraryLanguage("zh-CN", () => Object.freeze({
    lunar: Solar.fromYmd(date.year, date.month, date.day).getLunar(),
  }));
}
