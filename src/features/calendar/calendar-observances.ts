import {
  createCalendarExtensionEvent,
  type CalendarExtensionEvent,
} from "../../core/calendar/calendar-extension";
import { getObservance, type ObservanceGroup } from "../../core/calendar/observances";
import type { LocalDate } from "../../core/periodic/periodic-date";
import { createTranslator } from "../../shared/i18n";

export function selectObservanceEvents(
  date: LocalDate,
  locale: string,
  selected: readonly ObservanceGroup[],
): readonly CalendarExtensionEvent[] {
  return selected.flatMap(group => {
    const name = getObservance(date, group);
    if (name === null) return [];
    const { t } = createTranslator("auto", locale);
    return [createCalendarExtensionEvent(
      `observance:${name}`, "festival", t(`observances.event.${name}`), group,
    )];
  });
}
