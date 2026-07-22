import { I18n } from "lunar-typescript";

import type {
  CalendarOverlayEventKind,
  CalendarOverlayTransition,
} from "./calendar-overlay";
import type { LocalDate } from "../periodic/periodic-date";
import {
  createLunarDateContext,
  type LunarDateContext,
} from "./lunar-date-context";
import {
  localizeSolarTermName,
  withLunarLibraryLanguage,
} from "./lunar-library-language";

export interface ChineseLunarDay {
  readonly lunarMonth: number;
  readonly lunarDay: number;
  readonly isLeapMonth: boolean;
  readonly lunarMonthName: string;
  readonly lunarDayName: string;
  readonly festival: string | null;
  readonly solarTerm: string | null;
  readonly dateText: string;
  readonly eventText: string | null;
  readonly eventKind: CalendarOverlayEventKind | null;
  readonly transition: CalendarOverlayTransition | null;
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
  const rawFestival = lunar.getFestivals()[0] ?? null;
  const language = I18n.getLanguage();
  const festival = rawFestival === null
    ? null
    : language === "en" || rawFestival.length < 3
      ? rawFestival
      : rawFestival.slice(0, 2);
  const rawSolarTerm = lunar.getCurrentJieQi()?.getName() ?? null;
  const solarTerm = rawSolarTerm === null
    ? null
    : localizeSolarTermName(rawSolarTerm, I18n.getLanguage());

  const dateText = chinese
    ? lunarDay === 1 ? lunarMonthName : lunarDayName
    : `Lunar ${isLeapMonth ? "L" : ""}${lunarMonth}/${lunarDay}`;
  const eventText = festival ?? solarTerm;
  const eventKind = festival !== null
    ? "festival"
    : solarTerm !== null ? "solar-term" : null;
  const transition = lunarDay === 1 ? "month" : null;
  const accessibilityText = chinese
    ? `${lunarMonthName}${lunarDayName}${eventText === null ? "" : `，${eventText}`}`
    : [lunarMonthName, lunarDayName, ...(eventText === null ? [] : [eventText])].join(", ");

  return Object.freeze({
    lunarMonth,
    lunarDay,
    isLeapMonth,
    lunarMonthName,
    lunarDayName,
    festival,
    solarTerm,
    dateText,
    eventText,
    eventKind,
    transition,
    accessibilityText,
  });
}
