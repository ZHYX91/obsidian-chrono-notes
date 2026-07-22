import type {
  CalendarOverlayEventKind,
  CalendarOverlayTransition,
} from "./calendar-overlay";
import { withLunarLibraryLanguage } from "./lunar-library-language";
import type { LocalDate } from "../periodic/periodic-date";
import {
  createLunarDateContext,
  type LunarDateContext,
} from "./lunar-date-context";

export interface GanzhiDay {
  readonly yearPillar: string;
  readonly monthPillar: string;
  readonly dayPillar: string;
  readonly solarTerm: string | null;
  readonly solarTermTime: string | null;
  readonly dateText: string;
  readonly eventText: string | null;
  readonly eventKind: CalendarOverlayEventKind | null;
  readonly transition: CalendarOverlayTransition | null;
  readonly accessibilityText: string;
}

export function getGanzhiDay(date: LocalDate, locale: string): GanzhiDay {
  return getGanzhiDayFromContext(createLunarDateContext(date), locale);
}

export function getGanzhiDayFromContext(
  context: LunarDateContext,
  locale: string,
): GanzhiDay {
  const raw = withLunarLibraryLanguage("zh-CN", () => calculateGanzhiDay(context));
  const solarTerm = raw.solarTerm === null
    ? null
    : withLunarLibraryLanguage(locale, () =>
        context.lunar.getCurrentJie()?.getName() ?? raw.solarTerm);
  const chinese = locale.toLowerCase().startsWith("zh");
  const dateText = raw.transition === null
    ? raw.dayPillar
    : chinese ? `${raw.monthPillar}月` : `M ${raw.monthPillar}`;
  const accessibilityText = chinese
    ? [
        `${raw.yearPillar}年`,
        `${raw.monthPillar}月`,
        `${raw.dayPillar}日`,
        ...(solarTerm === null ? [] : [`${solarTerm} ${raw.solarTermTime}`]),
      ].join("，")
    : [
        `Year ${raw.yearPillar}`,
        `month ${raw.monthPillar}`,
        `day ${raw.dayPillar}`,
        ...(solarTerm === null ? [] : [`${solarTerm} ${raw.solarTermTime}`]),
      ].join(", ");

  return Object.freeze({
    ...raw,
    solarTerm,
    dateText,
    eventText: solarTerm,
    eventKind: solarTerm === null ? null : "solar-term",
    accessibilityText,
  });
}

function calculateGanzhiDay(context: LunarDateContext): Omit<
  GanzhiDay,
  "dateText" | "eventText" | "eventKind" | "accessibilityText"
> {
  const { lunar } = context;
  const currentJie = lunar.getCurrentJie();
  const afterTransition = currentJie === null ? lunar : lunar.next(1);
  const previousYearPillar = lunar.getYearInGanZhiExact();
  const yearPillar = afterTransition.getYearInGanZhiExact();
  const monthPillar = afterTransition.getMonthInGanZhiExact();
  const dayPillar = lunar.getDayInGanZhi();
  const solarTerm = currentJie?.getName() ?? null;
  const solarTermTime = currentJie === null
    ? null
    : currentJie.getSolar().toYmdHms().slice(11, 16);
  const transition = currentJie === null
    ? null
    : previousYearPillar === yearPillar ? "month" : "year-month";
  return Object.freeze({
    yearPillar,
    monthPillar,
    dayPillar,
    solarTerm,
    solarTermTime,
    transition,
  });
}
