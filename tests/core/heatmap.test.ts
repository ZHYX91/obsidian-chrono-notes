import { describe, expect, it } from "vitest";

import {
  getHeatmapMetric,
  HEATMAP_LEVEL_UPPER_LIMIT,
} from "../../src/core/statistics/heatmap";
import type { NoteStatistics } from "../../src/core/note/note-statistics";

function statistics(overrides: Partial<NoteStatistics> = {}): NoteStatistics {
  return {
    wordCount: 0,
    linkCount: 0,
    tagCount: 0,
    taskTotal: 0,
    taskCompleted: 0,
    taskCompletionRate: 0,
    ...overrides,
  };
}

describe("getHeatmapMetric", () => {
  it("maps count dimensions through a positive step and four-level cap", () => {
    expect(getHeatmapMetric(statistics(), "word-count", 200)).toEqual({
      dimension: "word-count",
      value: 0,
      level: 0,
    });
    expect(getHeatmapMetric(statistics({ wordCount: 1 }), "word-count", 200).level).toBe(1);
    expect(getHeatmapMetric(statistics({ wordCount: 200 }), "word-count", 200).level).toBe(1);
    expect(getHeatmapMetric(statistics({ wordCount: 201 }), "word-count", 200).level).toBe(2);
    expect(getHeatmapMetric(statistics({ wordCount: 999 }), "word-count", 200).level)
      .toBe(HEATMAP_LEVEL_UPPER_LIMIT);
  });

  it("selects links and tags from the unified note statistics", () => {
    const value = statistics({ wordCount: 100, linkCount: 3, tagCount: 2 });

    expect(getHeatmapMetric(value, "link-count", 2)).toMatchObject({ value: 3, level: 2 });
    expect(getHeatmapMetric(value, "tag-count", 2)).toMatchObject({ value: 2, level: 1 });
  });

  it("uses a fixed 25 percent step for task completion rate", () => {
    expect(getHeatmapMetric(
      statistics({ taskTotal: 4, taskCompleted: 1, taskCompletionRate: 25 }),
      "task-completion-rate",
      999,
    )).toMatchObject({ value: 25, level: 1 });
    expect(getHeatmapMetric(
      statistics({ taskTotal: 4, taskCompleted: 4, taskCompletionRate: 100 }),
      "task-completion-rate",
      1,
    )).toMatchObject({ value: 100, level: 4 });
  });

  it("returns a frozen metric", () => {
    expect(Object.isFrozen(getHeatmapMetric(statistics({ wordCount: 1 }), "word-count", 200)))
      .toBe(true);
  });
});
