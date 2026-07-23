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
import {
  getIntlCalendarDay,
  isIntlCalendarSupported,
} from "../../core/calendar/intl-calendar";
import type { MessageKey } from "../../shared/i18n";

export interface CalendarOverlayDefinition extends CalendarOverlayProvider {
  readonly labelKey: MessageKey;
  readonly descriptionKey: MessageKey;
  readonly usesLunarContext: boolean;
  isSupported(locale: string): boolean;
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
      usesLunarContext: true,
      isSupported: () => true,
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
      usesLunarContext: true,
      isSupported: () => true,
      getDay: (
        date: LocalDate,
        locale: string,
        context?: LunarDateContext,
      ) => context === undefined
        ? getGanzhiDay(date, locale)
        : getGanzhiDayFromContext(context, locale),
    }),
    ...([
      ["persian", "settings.appearance.persian", "settings.appearance.persianDesc"],
      ["ethiopic", "settings.appearance.ethiopic", "settings.appearance.ethiopicDesc"],
      ["hebrew", "settings.appearance.hebrew", "settings.appearance.hebrewDesc"],
      ["indian", "settings.appearance.indian", "settings.appearance.indianDesc"],
      [
        "islamic-civil",
        "settings.appearance.islamicCivil",
        "settings.appearance.islamicCivilDesc",
      ],
      [
        "islamic-umalqura",
        "settings.appearance.islamicUmmAlQura",
        "settings.appearance.islamicUmmAlQuraDesc",
      ],
    ] as const).map(([id, labelKey, descriptionKey]) => Object.freeze({
      id,
      labelKey,
      descriptionKey,
      usesLunarContext: false,
      isSupported: (locale: string) => isIntlCalendarSupported(id, locale),
      getDay: (date: LocalDate, locale: string) => getIntlCalendarDay(date, locale, id),
    })),
  ]);

const PROVIDERS = new Map<CalendarOverlayId, CalendarOverlayDefinition>(
  CALENDAR_OVERLAY_DEFINITIONS.map((provider) => [provider.id, provider]),
);

export function selectCalendarOverlayDays(
  date: LocalDate,
  locale: string,
  selected: readonly CalendarOverlayId[],
): readonly CalendarOverlayDay[] {
  const needsLunarContext = selected.some((id) => PROVIDERS.get(id)?.usesLunarContext);
  const context = needsLunarContext ? createLunarDateContext(date) : undefined;
  return Object.freeze(selected.flatMap((id) => {
    const day = selectCalendarOverlayDay(date, locale, id, context);
    return day === null ? [] : [day];
  }));
}

export function selectCalendarOverlayDay(
  date: LocalDate,
  locale: string,
  id: CalendarOverlayId,
  context?: LunarDateContext,
): CalendarOverlayDay | null {
  const provider = PROVIDERS.get(id);
  if (provider === undefined) throw new Error(`Unknown calendar overlay: ${id}`);
  if (!provider.isSupported(locale)) return null;
  return Object.freeze({ id, ...provider.getDay(date, locale, context) });
}

export function isCalendarOverlaySupported(
  id: CalendarOverlayId,
  locale: string,
): boolean {
  const provider = PROVIDERS.get(id);
  return provider?.isSupported(locale) ?? false;
}

export function usesLunarCalendarContext(id: CalendarOverlayId): boolean {
  return PROVIDERS.get(id)?.usesLunarContext ?? false;
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
