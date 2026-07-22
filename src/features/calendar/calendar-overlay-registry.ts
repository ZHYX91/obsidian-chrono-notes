import type {
  CalendarOverlayDay,
  CalendarOverlayId,
  CalendarOverlayProvider,
  CalendarOverlayResult,
} from "../../core/calendar/calendar-overlay";
import {
  getChineseLunarDay,
  getChineseLunarDayFromContext,
} from "../../core/calendar/chinese-lunar";
import {
  getGanzhiDay,
  getGanzhiDayFromContext,
} from "../../core/calendar/ganzhi";
import {
  createLunarDateContext,
  type LunarDateContext,
} from "../../core/calendar/lunar-date-context";
import type { LocalDate } from "../../core/periodic/periodic-date";

export interface CalendarOverlayDefinition extends CalendarOverlayProvider {
  readonly labelKey:
    | "settings.appearance.chineseLunar"
    | "settings.appearance.ganzhi";
  readonly descriptionKey:
    | "settings.appearance.chineseLunarDesc"
    | "settings.appearance.ganzhiDesc";
  getDay(
    date: LocalDate,
    locale: string,
    context?: LunarDateContext,
  ): CalendarOverlayResult;
}

export const CALENDAR_OVERLAY_DEFINITIONS: readonly CalendarOverlayDefinition[] =
  Object.freeze([
    Object.freeze({
      id: "chinese-lunar",
      labelKey: "settings.appearance.chineseLunar",
      descriptionKey: "settings.appearance.chineseLunarDesc",
      getDay: (
        date: LocalDate,
        locale: string,
        context?: LunarDateContext,
      ) => context === undefined
        ? getChineseLunarDay(date, locale)
        : getChineseLunarDayFromContext(context, locale),
    }),
    Object.freeze({
      id: "ganzhi",
      labelKey: "settings.appearance.ganzhi",
      descriptionKey: "settings.appearance.ganzhiDesc",
      getDay: (
        date: LocalDate,
        locale: string,
        context?: LunarDateContext,
      ) => context === undefined
        ? getGanzhiDay(date, locale)
        : getGanzhiDayFromContext(context, locale),
    }),
  ]);

const PROVIDERS = new Map<CalendarOverlayId, CalendarOverlayDefinition>(
  CALENDAR_OVERLAY_DEFINITIONS.map((provider) => [provider.id, provider]),
);

export function selectCalendarOverlayDays(
  date: LocalDate,
  locale: string,
  selected: readonly CalendarOverlayId[],
): readonly CalendarOverlayDay[] {
  const context = selected.length === 0 ? undefined : createLunarDateContext(date);
  return Object.freeze(selected.map((id) =>
    selectCalendarOverlayDay(date, locale, id, context)));
}

export function selectCalendarOverlayDay(
  date: LocalDate,
  locale: string,
  id: CalendarOverlayId,
  context?: LunarDateContext,
): CalendarOverlayDay {
  const provider = PROVIDERS.get(id);
  if (provider === undefined) throw new Error(`Unknown calendar overlay: ${id}`);
  return Object.freeze({ id, ...provider.getDay(date, locale, context) });
}

export function updateCalendarOverlaySlot(
  selected: readonly CalendarOverlayId[],
  slot: 0 | 1,
  nextId: CalendarOverlayId | null,
): readonly CalendarOverlayId[] {
  const slots: [CalendarOverlayId | null, CalendarOverlayId | null] = [
    selected[0] ?? null,
    selected[1] ?? null,
  ];
  slots[slot] = nextId;
  return Object.freeze(slots.filter(
    (id, index): id is CalendarOverlayId => id !== null && slots.indexOf(id) === index,
  ));
}
