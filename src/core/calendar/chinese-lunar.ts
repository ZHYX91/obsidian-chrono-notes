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
  const rawFestivals = lunar.getFestivals();
  const canonicalFestivals = withLunarLibraryLanguage(
    "zh-CN",
    () => [...lunar.getFestivals()],
  );
  const festivals = Object.freeze([...rawFestivals]);
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
    ...festivals.map((festival, index) => createCalendarExtensionEvent(
      `festival:${canonicalFestivals[index] ?? `${signedMonth}:${lunarDay}:${index}`}`,
      "festival",
      festival,
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
