import type {
  CalendarExtensionDay,
  CalendarExtensionEvent,
  CalendarExtensionEventSource,
  CalendarExtensionId,
  CalendarExtensionProvider,
  CalendarExtensionResult,
} from "../../core/calendar/calendar-extension";
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

export interface CalendarExtensionDefinition extends CalendarExtensionProvider {
  readonly labelKey: MessageKey;
  readonly descriptionKey: MessageKey;
  readonly usesLunarContext: boolean;
  isSupported(locale: string): boolean;
  getDay(
    date: LocalDate,
    locale: string,
    context?: LunarDateContext,
  ): CalendarExtensionResult;
}

export const CALENDAR_EXTENSION_DEFINITIONS: readonly CalendarExtensionDefinition[] =
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

const PROVIDERS = new Map<CalendarExtensionId, CalendarExtensionDefinition>(
  CALENDAR_EXTENSION_DEFINITIONS.map((provider) => [provider.id, provider]),
);

export function selectCalendarExtensionDays(
  date: LocalDate,
  locale: string,
  selected: readonly CalendarExtensionId[],
): readonly CalendarExtensionDay[] {
  const needsLunarContext = selected.some((id) => PROVIDERS.get(id)?.usesLunarContext);
  const context = needsLunarContext ? createLunarDateContext(date) : undefined;
  return Object.freeze(selected.flatMap((id) => {
    const day = selectCalendarExtensionDay(date, locale, id, context);
    return day === null ? [] : [day];
  }));
}

export function selectCalendarExtensionDay(
  date: LocalDate,
  locale: string,
  id: CalendarExtensionId,
  context?: LunarDateContext,
): CalendarExtensionDay | null {
  const provider = PROVIDERS.get(id);
  if (provider === undefined) throw new Error(`Unknown calendar extension: ${id}`);
  if (!provider.isSupported(locale)) return null;
  return Object.freeze({ id, ...provider.getDay(date, locale, context) });
}

export function mergeCalendarExtensionEvents(
  extensions: readonly CalendarExtensionDay[],
): readonly CalendarExtensionEvent[] {
  const merged = new Map<string, {
    kind: CalendarExtensionEvent["kind"];
    text: string;
    sources: CalendarExtensionEventSource[];
  }>();

  for (const extension of extensions) {
    for (const event of extension.events) {
      const existing = merged.get(event.id);
      if (existing === undefined) {
        merged.set(event.id, {
          kind: event.kind,
          text: event.text,
          sources: [...event.sources],
        });
        continue;
      }
      for (const source of event.sources) {
        if (!existing.sources.some(({ id }) => id === source.id)) {
          existing.sources.push(source);
        }
      }
    }
  }

  return Object.freeze(Array.from(merged, ([id, event]) => Object.freeze({
    id,
    kind: event.kind,
    text: event.text,
    sources: Object.freeze([...event.sources]),
  })));
}

export function isCalendarExtensionSupported(
  id: CalendarExtensionId,
  locale: string,
): boolean {
  const provider = PROVIDERS.get(id);
  return provider?.isSupported(locale) ?? false;
}

export function usesLunarCalendarContext(id: CalendarExtensionId): boolean {
  return PROVIDERS.get(id)?.usesLunarContext ?? false;
}

export function updateCalendarExtensionSlot(
  selected: readonly CalendarExtensionId[],
  slot: 0 | 1,
  nextId: CalendarExtensionId | null,
): readonly CalendarExtensionId[] {
  const slots: [CalendarExtensionId | null, CalendarExtensionId | null] = [
    selected[0] ?? null,
    selected[1] ?? null,
  ];
  slots[slot] = nextId;
  return Object.freeze(slots.filter(
    (id, index): id is CalendarExtensionId => id !== null && slots.indexOf(id) === index,
  ));
}
