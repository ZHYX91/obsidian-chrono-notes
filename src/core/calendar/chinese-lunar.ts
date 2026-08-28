import { I18n } from "lunar-typescript";

import {
  createCalendarExtensionEvent,
  type CalendarExtensionEvent,
  type CalendarExtensionTransition,
} from "./calendar-extension";
import type { LocalDate } from "../periodic/periodic-date";
import {
  createLunarDateContext,
  type LunarDateContext,
} from "./lunar-date-context";
import {
  localizeLunarFestivalName,
  localizeSolarTermName,
  withLunarLibraryLanguage,
} from "./lunar-library-language";

export interface ChineseLunarDay {
  readonly lunarMonth: number;
  readonly lunarDay: number;
  readonly isLeapMonth: boolean;
  readonly lunarMonthName: string;
  readonly lunarDayName: string;
  readonly festivals: readonly string[];
  readonly solarTerm: string | null;
  readonly dateText: string;
  readonly events: readonly CalendarExtensionEvent[];
  readonly transition: CalendarExtensionTransition | null;
  readonly accessibilityText: string;
}

export function getChineseLunarDay(date: LocalDate, locale: string): ChineseLunarDay {
  return getChineseLunarDayFromContext(createLunarDateContext(date), locale);
}

export function getChineseLunarDayFromContext(
  context: LunarDateContext,
  locale: string,
): ChineseLunarDay {
  return withLunarLibraryLanguage(locale, () => buildChineseLunarDay(context));
}

function buildChineseLunarDay(context: LunarDateContext): ChineseLunarDay {
  const { lunar } = context;
  const signedMonth = lunar.getMonth();
  const lunarMonth = Math.abs(signedMonth);
  const lunarDay = lunar.getDay();
  const isLeapMonth = signedMonth < 0;
  const chinese = I18n.getLanguage() !== "en";
  const lunarMonthName = chinese
    ? `${lunar.getMonthInChinese()}月`
    : `${isLeapMonth ? "Leap lunar month" : "Lunar month"} ${lunarMonth}`;
  const lunarDayName = chinese ? lunar.getDayInChinese() : `day ${lunarDay}`;
  const localizedPrimaryFestivals = [...lunar.getFestivals()];
  const canonicalPrimaryFestivals = withLunarLibraryLanguage(
    "zh-CN",
    () => [...lunar.getFestivals()],
  );
  const canonicalOtherFestivals = withLunarLibraryLanguage(
    "zh-CN",
    () => [...lunar.getOtherFestivals()],
  );
  const festivalEntries = mergeFestivalEntries([
    ...localizedPrimaryFestivals.map((text, index) => ({
      canonicalName:
        canonicalPrimaryFestivals[index] ?? `${signedMonth}:${lunarDay}:${index}`,
      text,
    })),
    ...canonicalOtherFestivals.map((canonicalName) => ({
      canonicalName,
      text: localizeLunarFestivalName(canonicalName, I18n.getLanguage()),
    })),
  ]);
  const festivals = Object.freeze(festivalEntries.map(({ text }) => text));
  const rawSolarTerm = lunar.getCurrentJieQi()?.getName() ?? null;
  const canonicalSolarTerm = withLunarLibraryLanguage(
    "zh-CN",
    () => lunar.getCurrentJieQi()?.getName() ?? null,
  );
  const solarTerm = rawSolarTerm === null
    ? null
    : localizeSolarTermName(rawSolarTerm, I18n.getLanguage());

  const dateText = chinese
    ? lunarDay === 1 ? lunarMonthName : lunarDayName
    : `Lunar ${isLeapMonth ? "L" : ""}${lunarMonth}/${lunarDay}`;
  const events = Object.freeze([
    ...festivalEntries.map(({ canonicalName, text }) => createCalendarExtensionEvent(
      `festival:${canonicalName}`,
      "festival",
      text,
      "chinese-lunar",
    )),
    ...(solarTerm === null || canonicalSolarTerm === null
      ? []
      : [createCalendarExtensionEvent(
          `solar-term:${canonicalSolarTerm}`,
          "solar-term",
          solarTerm,
          "chinese-lunar",
        )]),
  ]);
  const transition = lunarDay === 1 ? "month" : null;
  const accessibilityText = chinese
    ? `${lunarMonthName}${lunarDayName}`
    : [lunarMonthName, lunarDayName].join(", ");

  return Object.freeze({
    lunarMonth,
    lunarDay,
    isLeapMonth,
    lunarMonthName,
    lunarDayName,
    festivals,
    solarTerm,
    dateText,
    events,
    transition,
    accessibilityText,
  });
}

interface FestivalEntry {
  readonly canonicalName: string;
  readonly text: string;
}

function mergeFestivalEntries(entries: readonly FestivalEntry[]): readonly FestivalEntry[] {
  const merged = new Map<string, string>();
  for (const { canonicalName, text } of entries) {
    if (!merged.has(canonicalName)) merged.set(canonicalName, text);
  }
  return Object.freeze(Array.from(merged, ([canonicalName, text]) =>
    Object.freeze({ canonicalName, text })));
}
