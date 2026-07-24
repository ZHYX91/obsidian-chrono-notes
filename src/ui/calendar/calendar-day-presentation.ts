import type { CalendarExtensionEvent } from "../../core/calendar/calendar-extension";
import type { CalendarDay } from "../../features/calendar/calendar-day-query";
import { CALENDAR_EXTENSION_DEFINITIONS } from "../../features/calendar/calendar-extension-registry";
import type { RegionalMarkerKind } from "../../features/calendar/holiday-region-registry";
import { hasIndexedPeriodicNote } from "../../features/calendar/indexed-periodic-note";
import type { Translator } from "../../shared/i18n";
import { formatNoteTaskProgress } from "../note-task-progress-presentation";
import { formatCalendarHeatmapMetric } from "./calendar-heatmap-presentation";
import { formatCalendarIcsDayLabel } from "./calendar-ics-presentation";
import { formatCalendarNoteState } from "./calendar-note-presentation";

export interface CalendarDayLabelOptions {
  readonly includeCalendarExtensions: boolean;
}

export function canPreviewCalendarDay(day: CalendarDay): boolean {
  return (
    day.heatmap !== null ||
    day.calendarExtensions.length > 0 ||
    day.calendarEvents.length > 0 ||
    day.holidays.length > 0 ||
    day.workday !== null ||
    day.icsEvents.length > 0 ||
    hasIndexedPeriodicNote(day.noteState)
  );
}

export function formatCalendarDayLabel(
  dateKey: string,
  day: CalendarDay,
  options: CalendarDayLabelOptions,
  t: Translator["t"],
): string {
  const regional = formatRegionalLabel(day, t);
  const icsLabel = formatCalendarIcsDayLabel(day.icsEvents, t);
  return [
    dateKey,
    ...(options.includeCalendarExtensions
      ? [
          ...day.calendarExtensions.map(
            (extension) => extension.accessibilityText,
          ),
          ...day.calendarEvents.map((event) =>
            formatCalendarExtensionEventLabel(event, t)),
        ]
      : []),
    ...(regional === null ? [] : [regional]),
    ...(day.heatmap === null
      ? []
      : [formatCalendarHeatmapMetric(day.heatmap, t)]),
    formatCalendarNoteState(day.noteState, day.errorMessage, t),
    ...(day.statistics.taskTotal === 0
      ? []
      : [formatNoteTaskProgress(day.statistics, t)]),
    ...(icsLabel.length === 0 ? [] : [icsLabel]),
  ].join(t("calendar.itemSeparator"));
}

export function formatCalendarExtensionEventLabel(
  event: CalendarExtensionEvent,
  t: Translator["t"],
): string {
  const sources = event.sources.map((source) => {
    const definition = CALENDAR_EXTENSION_DEFINITIONS.find(
      ({ id }) => id === source.id,
    );
    const sourceName = definition === undefined
      ? source.id
      : t(definition.labelKey);
    return source.transitionTime === null
      ? sourceName
      : t("calendar.calendarEventSourceTransition", {
          source: sourceName,
          time: source.transitionTime,
        });
  });
  return t("calendar.calendarEventSources", {
    event: event.text,
    sources: sources.join(t("monthView.nameSeparator")),
  });
}

export function formatRegionalMarkerLabel(
  kind: RegionalMarkerKind,
  t: Translator["t"],
): string {
  return t(`monthView.regionalMarker.${kind}`);
}

function formatRegionalLabel(
  day: Pick<CalendarDay, "holidays" | "workday">,
  t: Translator["t"],
): string | null {
  if (day.holidays.length > 0) {
    return t("monthView.publicHoliday", {
      names: day.holidays
        .map((holiday) => holiday.name)
        .join(t("monthView.nameSeparator")),
    });
  }
  return day.workday?.isWorkday === true
    ? t("monthView.adjustedWorkday", { name: day.workday.name })
    : null;
}
