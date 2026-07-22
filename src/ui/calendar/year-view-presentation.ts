import type { HeatmapMetric } from "../../core/statistics/heatmap";
import type { NoteStatistics } from "../../core/note/note-statistics";
import type { YearHeatmapDay } from "../../features/calendar/year-calendar-query";
import type { Translator } from "../../shared/i18n";
import type { QuarterNameMode } from "../../shared/settings";
import { formatNoteTaskProgress } from "../note-task-progress-presentation";
import { formatCalendarHeatmapMetric } from "./calendar-heatmap-presentation";
import { formatCalendarNoteState } from "./calendar-note-presentation";

export function formatYearQuarterLabel(
  quarter: number,
  mode: QuarterNameMode,
  t: Translator["t"],
): string {
  if (mode === "chinese") {
    return ["春", "夏", "秋", "冬"][quarter - 1]
      ?? t("yearView.quarter", { quarter });
  }
  return t("yearView.quarter", { quarter });
}

export function formatYearPeriodLabel(
  label: string,
  state: YearHeatmapDay["noteState"],
  errorMessage: string | undefined,
  statistics: NoteStatistics,
  t: Translator["t"],
): string {
  return [
    label,
    formatCalendarNoteState(state, errorMessage, t),
    ...(statistics.taskTotal === 0
      ? []
      : [formatNoteTaskProgress(statistics, t)]),
  ].join(
    t("calendar.itemSeparator"),
  );
}

export function formatYearHeatmapGridLabel(
  month: string,
  t: Translator["t"],
): string {
  return t("yearView.heatmapGrid", { month });
}

export function resolveYearHeatmapTabIndex(
  selected: boolean,
  fallback: boolean,
  hasDaySelection: boolean,
): 0 | -1 {
  return selected || (fallback && !hasDaySelection) ? 0 : -1;
}

export function formatYearHeatmapMetric(
  heatmap: HeatmapMetric,
  t: Translator["t"],
): string {
  return formatCalendarHeatmapMetric(heatmap, t);
}

export function formatYearHeatmapDayLabel(
  dateKey: string,
  cell: YearHeatmapDay,
  t: Translator["t"],
): string {
  return [
    dateKey,
    formatYearHeatmapMetric(cell.heatmap, t),
    formatCalendarNoteState(cell.noteState, cell.errorMessage, t),
  ].join(t("calendar.itemSeparator"));
}
