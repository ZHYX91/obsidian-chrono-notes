import type { HeatmapMetric } from "../../core/statistics/heatmap";
import { formatRegionalDayDetails, type RegionalDayPresentation } from "./calendar-regional-presentation";
import type { Translator } from "../../shared/i18n";
import type { PeriodicNoteType } from "../../core/periodic/periodic-date";
import { formatCalendarHeatmapMetric } from "./calendar-heatmap-presentation";

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
  cell: RegionalDayPresentation,
  t: Translator["t"],
): string | null {
  return formatRegionalDayDetails(cell, "calendarPreview", t);
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
  noteType?: PeriodicNoteType,
): string | null {
  if (noteType !== undefined) {
    const period = t(`calendarPreview.period.${noteType}`);
    switch (state) {
      case "empty":
      case "yaml-only":
        return t("calendarPreview.periodNoBody", { period });
      case "missing":
        return t("calendarPreview.periodMissing", { period });
      case "not-configured":
        return t("calendarPreview.periodNotConfigured", { period });
    }
  }
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
