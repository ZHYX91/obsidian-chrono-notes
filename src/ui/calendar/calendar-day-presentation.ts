import { isObservanceGroup } from "../../core/calendar/observance-groups";
import type { CalendarExtensionDay, CalendarExtensionEvent, CalendarExtensionId } from "../../core/calendar/calendar-extension";
import type { CalendarDay } from "../../features/calendar/calendar-day-query";
import { CALENDAR_EXTENSION_DEFINITIONS } from "../../features/calendar/calendar-extension-registry";
import type { RegionalMarkerKind } from "../../features/calendar/holiday-region-registry";
import { hasIndexedPeriodicNote } from "../../features/calendar/indexed-periodic-note";
import type { Translator } from "../../shared/i18n";
import { formatNoteTaskProgress } from "../note-task-progress-presentation";
import { formatCalendarHeatmapMetric } from "./calendar-heatmap-presentation";
import { formatRegionalDayDetails } from "./calendar-regional-presentation";
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
  const regional = formatRegionalDayDetails(day, "monthView", t);
  const icsLabel = formatCalendarIcsDayLabel(day.icsEvents, t);
  return [
    dateKey,
    ...(options.includeCalendarExtensions
      ? [
          ...day.calendarExtensions.map((extension) => formatCalendarExtensionDateLabel(extension, t)),
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

function calendarName(id: CalendarExtensionId, t: Translator["t"]): string {
  const definition = CALENDAR_EXTENSION_DEFINITIONS.find((provider) => provider.id === id);
  return definition === undefined ? id : t(definition.labelKey);
}

export function formatCalendarExtensionDateLabel(day: CalendarExtensionDay, t: Translator["t"]): string {
  return `${calendarName(day.id, t)} · ${day.accessibilityText}`;
}

export function formatCalendarExtensionEventLabel(
  event: CalendarExtensionEvent,
  t: Translator["t"],
): string {
  const sources = event.sources.map((source) => {
    const sourceName = isObservanceGroup(source.id)
      ? t(`observances.group.${source.id}`)
      : calendarName(source.id, t);
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
