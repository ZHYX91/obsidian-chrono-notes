import { describe, expect, it } from "vitest";

import { createTranslator } from "../../src/shared/i18n";
import {
  formatYearHeatmapDayLabel,
  formatYearHeatmapGridLabel,
  formatYearHeatmapMetric,
  formatYearPeriodLabel,
  formatYearQuarterLabel,
  resolveYearHeatmapTabIndex,
} from "../../src/ui/calendar/year-view-presentation";
import { noteStatistics } from "../support/note-statistics";
import { readPluginStyles } from "../support/plugin-styles";

describe("year view presentation", () => {
  it("formats numeric and Chinese quarter labels across runtime languages", () => {
    expect(formatYearQuarterLabel(3, "number", createTranslator("en", "en").t)).toBe("Q3");
    expect(formatYearQuarterLabel(3, "number", createTranslator("zh-CN", "en").t)).toBe("第3季度");
    expect(formatYearQuarterLabel(1, "chinese", createTranslator("en", "en").t)).toBe("春");
    expect(formatYearQuarterLabel(2, "chinese", createTranslator("zh-CN", "en").t)).toBe("夏");
    expect(formatYearQuarterLabel(3, "chinese", createTranslator("zh-TW", "en").t)).toBe("秋");
    expect(formatYearQuarterLabel(4, "chinese", createTranslator("en", "en").t)).toBe("冬");
    expect(formatYearQuarterLabel(0, "chinese", createTranslator("en", "en").t)).toBe("Q0");
  });

  it("reserves enough narrow-summary width for full Chinese quarter labels", () => {
    const styles = readPluginStyles();

    expect(styles).toMatch(
      /@container \(max-width: 360px\)[\s\S]*?\.chrono-notes-year-summary-row\s*{[^}]*grid-template-columns:\s*minmax\(60px,\s*0\.6fr\)/,
    );
  });

  it("combines shared note states and task progress in period labels", () => {
    const t = createTranslator("zh-TW", "en").t;

    expect(formatYearPeriodLabel(
      "7月",
      "error",
      "permission denied",
      noteStatistics(),
      t,
    )).toBe(
      "7月，筆記讀取錯誤：permission denied",
    );
    expect(formatYearPeriodLabel(
      "7月",
      "has-body",
      undefined,
      noteStatistics({ taskCompleted: 1, taskTotal: 4, taskCompletionRate: 25 }),
      createTranslator("zh-CN", "en").t,
    )).toBe("7月，含正文的笔记，已完成 1/4 个任务");
  });

  it("formats heatmap dimensions, percentage values, and levels", () => {
    const t = createTranslator("en", "en").t;

    expect(formatYearHeatmapMetric({
      dimension: "task-completion-rate",
      value: 75,
      level: 3,
    }, t)).toBe("task completion: 75%, heatmap level 3 of 4");
    expect(formatYearHeatmapMetric({
      dimension: "word-count",
      value: 120,
      level: 2,
    }, t)).toBe("Words: 120, heatmap level 2 of 4");
  });

  it("builds localized grid and daily accessible labels", () => {
    const t = createTranslator("zh-CN", "en").t;
    const cell = {
      date: { year: 2026, month: 7, day: 14 },
      notePath: "Daily/2026-07-14.md",
      noteState: "has-body" as const,
      preview: "Keep preview unchanged",
      statistics: noteStatistics({ wordCount: 120 }),
      heatmap: {
        dimension: "word-count" as const,
        value: 120,
        level: 2 as const,
      },
    };

    expect(formatYearHeatmapGridLabel("7月", t)).toBe("7月热力图");
    expect(formatYearHeatmapDayLabel("2026-07-14", cell, t)).toBe(
      "2026-07-14，字数：120，热力图等级 2/4，含正文的笔记",
    );
  });

  it("keeps exactly one heatmap day in the roving tab order", () => {
    expect(resolveYearHeatmapTabIndex(false, true, false)).toBe(0);
    expect(resolveYearHeatmapTabIndex(true, true, true)).toBe(0);
    expect(resolveYearHeatmapTabIndex(false, true, true)).toBe(-1);
    expect(resolveYearHeatmapTabIndex(false, false, false)).toBe(-1);
  });
});
