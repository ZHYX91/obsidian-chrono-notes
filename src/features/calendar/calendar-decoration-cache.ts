import type {
  CalendarExtensionDay,
  CalendarExtensionEvent,
} from "../../core/calendar/calendar-extension";
import type {
  RegionalHoliday,
  RegionalWorkday,
} from "../../core/calendar/regional-holidays";
import {
  createLunarDateContext,
  type LunarDateContext,
} from "../../core/calendar/lunar-date-context";
import {
  formatLocalDateKey,
  type LocalDate,
} from "../../core/periodic/periodic-date";
import type { CalendarExtension, HolidayRegion } from "../../shared/settings";
import {
  mergeCalendarExtensionEvents,
  selectCalendarExtensionDay,
  selectCalendarExtensionDays,
  usesLunarCalendarContext,
} from "./calendar-extension-registry";
import {
  combineRegionalHolidayDays,
  selectRegionalHolidayProviderDay,
  selectRegionalHolidayDay,
  type RegionalMarker,
  type RegionalHolidayProviderDay,
} from "./holiday-region-registry";

export interface CalendarDecorations {
  readonly calendarExtensions: readonly CalendarExtensionDay[];
  readonly calendarEvents: readonly CalendarExtensionEvent[];
  readonly holidays: readonly RegionalHoliday[];
  readonly workday: RegionalWorkday | null;
  readonly regionalMarker: RegionalMarker | null;
}

/**
 * View-lifetime cache for calendar decorations that do not depend on notes or ICS.
 *
 * The bounded map is intentionally owned by a mounted calendar surface. It is
 * neither a domain source of truth nor a module singleton, and `clear()` releases
 * every retained provider result when that surface unmounts.
 */
export class CalendarDecorationCache {
  private readonly entries = new Map<string, CalendarDecorations>();
  private readonly calendarExtensionEntries = new Map<string, CalendarExtensionDay>();
  private readonly regionalEntries = new Map<string, RegionalHolidayProviderDay>();
  private readonly lunarEntries = new Map<string, LunarDateContext>();
  private readonly capacity: number;

  constructor(capacity = 2_048) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError("Calendar decoration cache capacity must be a positive integer");
    }
    this.capacity = capacity;
  }

  get(
    date: LocalDate,
    locale: string,
    calendarExtensions: readonly CalendarExtension[],
    holidayRegions: readonly HolidayRegion[],
  ): CalendarDecorations {
    const normalizedLocale = normalizeLocale(locale);
    const dateKey = formatLocalDateKey(date);
    const key = createCacheKey(dateKey, normalizedLocale, calendarExtensions, holidayRegions);
    const existing = this.entries.get(key);
    if (existing !== undefined) {
      this.entries.delete(key);
      this.entries.set(key, existing);
      return existing;
    }

    const extensions = Object.freeze(calendarExtensions.flatMap((id) => {
      const extension = this.getCalendarExtension(date, dateKey, normalizedLocale, id);
      return extension === null ? [] : [extension];
    }));
    const regional = combineRegionalHolidayDays(holidayRegions.map((region) =>
      this.getRegionalDay(date, dateKey, normalizedLocale, region)));
    const result = Object.freeze({
      calendarExtensions: extensions,
      calendarEvents: mergeCalendarExtensionEvents(extensions),
      holidays: regional.holidays,
      workday: regional.workday,
      regionalMarker: regional.marker,
    });
    this.entries.set(key, result);
    evictOverflow(this.entries, this.capacity);
    return result;
  }

  clear(): void {
    this.entries.clear();
    this.calendarExtensionEntries.clear();
    this.regionalEntries.clear();
    this.lunarEntries.clear();
  }

  get size(): number {
    return this.entries.size;
  }

  private getCalendarExtension(
    date: LocalDate,
    dateKey: string,
    locale: string,
    id: CalendarExtension,
  ): CalendarExtensionDay | null {
    const key = JSON.stringify([dateKey, locale, id]);
    const existing = touchEntry(this.calendarExtensionEntries, key);
    if (existing !== undefined) return existing;
    const result = selectCalendarExtensionDay(
      date,
      locale,
      id,
      usesLunarCalendarContext(id)
        ? this.getLunarContext(date, dateKey)
        : undefined,
    );
    if (result === null) return null;
    this.calendarExtensionEntries.set(key, result);
    evictOverflow(this.calendarExtensionEntries, this.capacity);
    return result;
  }

  private getRegionalDay(
    date: LocalDate,
    dateKey: string,
    locale: string,
    region: HolidayRegion,
  ): RegionalHolidayProviderDay {
    const key = JSON.stringify([dateKey, locale, region]);
    const existing = touchEntry(this.regionalEntries, key);
    if (existing !== undefined) return existing;
    const result = selectRegionalHolidayProviderDay(date, locale, region);
    this.regionalEntries.set(key, result);
    evictOverflow(this.regionalEntries, this.capacity);
    return result;
  }

  private getLunarContext(date: LocalDate, dateKey: string): LunarDateContext {
    const existing = touchEntry(this.lunarEntries, dateKey);
    if (existing !== undefined) return existing;
    const result = createLunarDateContext(date);
    this.lunarEntries.set(dateKey, result);
    evictOverflow(this.lunarEntries, this.capacity);
    return result;
  }
}

export function selectCalendarDecorations(
  date: LocalDate,
  locale: string,
  calendarExtensions: readonly CalendarExtension[],
  holidayRegions: readonly HolidayRegion[],
): CalendarDecorations {
  const extensions = selectCalendarExtensionDays(date, locale, calendarExtensions);
  const regional = selectRegionalHolidayDay(date, locale, holidayRegions);
  return Object.freeze({
    calendarExtensions: extensions,
    calendarEvents: mergeCalendarExtensionEvents(extensions),
    holidays: regional.holidays,
    workday: regional.workday,
    regionalMarker: regional.marker,
  });
}

function createCacheKey(
  dateKey: string,
  locale: string,
  calendarExtensions: readonly CalendarExtension[],
  holidayRegions: readonly HolidayRegion[],
): string {
  return JSON.stringify([
    dateKey,
    locale,
    calendarExtensions,
    holidayRegions,
  ]);
}

function touchEntry<T>(entries: Map<string, T>, key: string): T | undefined {
  const existing = entries.get(key);
  if (existing === undefined) return undefined;
  entries.delete(key);
  entries.set(key, existing);
  return existing;
}

function evictOverflow<T>(entries: Map<string, T>, capacity: number): void {
  while (entries.size > capacity) {
    const oldestKey = entries.keys().next().value;
    if (oldestKey === undefined) return;
    entries.delete(oldestKey);
  }
}

function normalizeLocale(locale: string): string {
  try {
    return Intl.getCanonicalLocales(locale)[0] ?? locale;
  } catch {
    return locale.trim();
  }
}
