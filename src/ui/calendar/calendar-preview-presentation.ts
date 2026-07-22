import type { HeatmapMetric } from "../../core/statistics/heatmap";
import type { RegionalHoliday, RegionalWorkday } from "../../core/calendar/regional-holidays";
import type { Translator } from "../../shared/i18n";
import { formatCalendarHeatmapMetric } from "./calendar-heatmap-presentation";

interface RegionalPreview {
  readonly holidays?: readonly RegionalHoliday[];
  readonly workday?: RegionalWorkday | null;
}

interface TaskProgress {
  readonly completed: number;
  readonly total: number;
}

export function formatCalendarPreviewHeatmap(
  heatmap: HeatmapMetric,
  t: Translator["t"],
): string {
  return formatCalendarHeatmapMetric(heatmap, t);
}

export function formatCalendarPreviewRegional(
  cell: RegionalPreview,
  t: Translator["t"],
): string | null {
  const holidays = cell.holidays ?? [];
  if (holidays.length > 0) {
    return t("calendarPreview.publicHoliday", {
      names: holidays.map((holiday) => holiday.name).join(t("calendarPreview.nameSeparator")),
    });
  }
  return cell.workday?.isWorkday === true
    ? t("calendarPreview.adjustedWorkday", { name: cell.workday.name })
    : null;
}

export function formatCalendarPreviewTaskProgress(
  summary: TaskProgress,
  t: Translator["t"],
): string {
  return t("calendarPreview.taskProgress", {
    completed: summary.completed,
    total: summary.total,
    count: summary.total,
  });
}

export function formatCalendarPreviewError(
  errorMessage: string | undefined,
  t: Translator["t"],
): string {
  return t("calendarPreview.unableRead", {
    error: errorMessage ?? t("calendarPreview.unknownError"),
  });
}

export function getCalendarPreviewStateText(
  state: string,
  t: Translator["t"],
): string | null {
  switch (state) {
    case "empty":
      return t("calendarPreview.emptyNote");
    case "yaml-only":
      return t("calendarPreview.yamlOnly");
    case "missing":
      return t("calendarPreview.missingDaily");
    case "not-configured":
      return t("calendarPreview.notConfiguredDaily");
    default:
      return null;
  }
}

export function getCalendarPreviewBody(
  preview: string | null,
  t: Translator["t"],
): string {
  return preview ?? t("calendarPreview.noContent");
}
