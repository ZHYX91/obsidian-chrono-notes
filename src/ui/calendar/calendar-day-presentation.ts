import type { CalendarDay } from "../../features/calendar/calendar-day-query";
import type { RegionalMarkerKind } from "../../features/calendar/holiday-region-registry";
import { hasIndexedPeriodicNote } from "../../features/calendar/indexed-periodic-note";
import type { Translator } from "../../shared/i18n";
import { formatNoteTaskProgress } from "../note-task-progress-presentation";
import { formatCalendarHeatmapMetric } from "./calendar-heatmap-presentation";
import { formatCalendarIcsDayLabel } from "./calendar-ics-presentation";
import { formatCalendarNoteState } from "./calendar-note-presentation";

export interface CalendarDayLabelOptions {
  readonly includeCalendarOverlays: boolean;
}

export function canPreviewCalendarDay(day: CalendarDay): boolean {
  return (
    day.heatmap !== null ||
    day.holidays.length > 0 ||
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
    ...(options.includeCalendarOverlays
      ? day.calendarOverlays.map((overlay) => overlay.accessibilityText)
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
