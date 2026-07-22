import type { HeatmapMetric, StatisticDisplayDimension } from "../../core/statistics/heatmap";
import type { Translator } from "../../shared/i18n";

export function formatCalendarHeatmapMetric(
  heatmap: HeatmapMetric,
  t: Translator["t"],
): string {
  return t("calendar.heatmap.value", {
    dimension: formatStatisticDimension(heatmap.dimension, t),
    value: heatmap.dimension === "task-completion-rate"
      ? `${heatmap.value}%`
      : heatmap.value,
    level: heatmap.level,
  });
}

function formatStatisticDimension(
  dimension: StatisticDisplayDimension,
  t: Translator["t"],
): string {
  switch (dimension) {
    case "link-count":
      return t("calendar.statistic.links");
    case "tag-count":
      return t("calendar.statistic.tags");
    case "task-completion-rate":
      return t("calendar.statistic.taskCompletion");
    case "word-count":
    default:
      return t("calendar.statistic.words");
  }
}
