import type { NoteStatistics } from "../note/note-statistics";

export const HEATMAP_LEVEL_UPPER_LIMIT = 4;

export type StatisticDisplayDimension =
  | "word-count"
  | "link-count"
  | "tag-count"
  | "task-completion-rate";

export interface HeatmapMetric {
  readonly dimension: StatisticDisplayDimension;
  readonly value: number;
  readonly level: number;
}

export function getHeatmapMetric(
  statistics: NoteStatistics,
  dimension: StatisticDisplayDimension,
  valueStep: number,
): HeatmapMetric {
  const value = getStatisticValue(statistics, dimension);
  const step = dimension === "task-completion-rate" ? 25 : Math.max(1, valueStep);
  const level = value <= 0
    ? 0
    : Math.min(HEATMAP_LEVEL_UPPER_LIMIT, Math.ceil(value / step));
  return Object.freeze({ dimension, value, level });
}

function getStatisticValue(
  statistics: NoteStatistics,
  dimension: StatisticDisplayDimension,
): number {
  switch (dimension) {
    case "link-count":
      return statistics.linkCount;
    case "tag-count":
      return statistics.tagCount;
    case "task-completion-rate":
      return statistics.taskCompletionRate;
    case "word-count":
    default:
      return statistics.wordCount;
  }
}
