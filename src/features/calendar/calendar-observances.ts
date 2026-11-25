import {
  createCalendarExtensionEvent,
  type CalendarExtensionEvent,
} from "../../core/calendar/calendar-extension";
import type { ObservanceGroup } from "../../core/calendar/observance-groups";
import { resolveContentLocale } from "../../core/calendar/content-locale";
import { getObservance, type ObservanceName } from "../../core/calendar/observances";
import type { LocalDate } from "../../core/periodic/periodic-date";
import { createTranslator } from "../../shared/i18n";

const LOCAL_LANGUAGES: Readonly<Record<ObservanceGroup, readonly string[]>> = {
  western: ["de", "fr", "es", "pt"],
  orthodox: ["ru"],
  nowruz: ["fa"],
  "hebrew-feasts": ["he"],
  "ethiopian-new-year": ["am"],
};

export function selectObservanceEvents(
  date: LocalDate,
  locale: string,
  selected: readonly ObservanceGroup[],
): readonly CalendarExtensionEvent[] {
  // Coincident feasts share an event ID. Use a matching local name from either
  // tradition while preserving the user's source order.
  const languages = new Map<ObservanceName, string>();
  const occurrences = selected.flatMap(group => {
    const name = getObservance(date, group);
    if (name === null) return [];
    const language = resolveContentLocale(locale, LOCAL_LANGUAGES[group]);
    if (!languages.has(name) || language !== "en") languages.set(name, language);
    return [{ name, group }];
  });
  return occurrences.map(({ name, group }) => {
    const { t } = createTranslator("auto", languages.get(name) ?? "en");
    return createCalendarExtensionEvent(
      `observance:${name}`, "festival", t(`observances.event.${name}`), group,
    );
  });
}
