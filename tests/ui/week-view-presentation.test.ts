import { describe, expect, it } from "vitest";

import { createTranslator } from "../../src/shared/i18n";
import {
  formatDatedTaskCount,
  formatCompactWeekRange,
  formatWeekDayVisualLabels,
  formatWeekPickerLabels,
  formatWeekTaskDateKinds,
  formatWeekTaskOverdue,
  formatWeekTaskRescheduleLabel,
  formatWeekTaskToggleLabel,
  getWeekViewMessages,
} from "../../src/ui/calendar/week-view-presentation";

describe("week view presentation", () => {
  it("builds localized date-kind and overdue checkbox labels", () => {
    const t = createTranslator("zh-TW", "en").t;

    expect(formatWeekTaskDateKinds(["due", "scheduled", "start"], t)).toBe(
      "到期、排程、開始",
    );
    expect(formatWeekTaskOverdue("none", t)).toBeNull();
    expect(formatWeekTaskOverdue("warning", t)).toBe("已逾期");
    expect(formatWeekTaskOverdue("severe", t)).toBe("嚴重逾期");
    expect(formatWeekTaskToggleLabel(
      "提交報告",
      ["due"],
      "severe",
      t,
    )).toBe("切換任務：提交報告。到期，嚴重逾期。");
  });

  it("keeps source task text unchanged", () => {
    const t = createTranslator("en", "en").t;
    expect(formatWeekTaskToggleLabel("Ship v2 #work", ["scheduled"], "none", t)).toBe(
      "Toggle task: Ship v2 #work. Scheduled.",
    );
  });

  it("localizes the due-date action in all supported languages", () => {
    expect(formatWeekTaskRescheduleLabel(
      "Ship",
      createTranslator("en", "en").t,
    )).toBe("Change due date for task: Ship");
    expect(formatWeekTaskRescheduleLabel(
      "发布",
      createTranslator("zh-CN", "en").t,
    )).toBe("调整任务“发布”的截止日期");
    expect(formatWeekTaskRescheduleLabel(
      "發佈",
      createTranslator("zh-TW", "en").t,
    )).toBe("調整任務「發佈」的到期日");
  });

  it("uses compact day labels only at narrow widths and keeps month boundaries", () => {
    expect(formatWeekDayVisualLabels(
      { year: 2026, month: 9, day: 28 },
      "zh-CN",
    )).toEqual({ full: "9/28", compact: "28" });
    expect(formatWeekDayVisualLabels(
      { year: 2026, month: 10, day: 1 },
      "zh-CN",
    )).toEqual({ full: "10/1", compact: "10/1" });
  });

  it("formats compact week-picker labels with complete accessible ranges", () => {
    expect(formatCompactWeekRange(
      { year: 2026, month: 7, day: 20 },
      { year: 2026, month: 7, day: 26 },
    )).toBe("7/20–26");
    expect(formatWeekPickerLabels(
      { year: 2026, month: 9, day: 28 },
      { year: 2026, month: 10, day: 4 },
      40,
      2026,
      createTranslator("zh-CN", "en"),
    )).toEqual({
      trigger: "第40周",
      item: "W40",
      range: "9/28–10/4",
      accessible: "第 40 周（2026），2026年9月28日–2026年10月4日",
      selectAccessible: "选择第 40 周（2026），2026年9月28日–2026年10月4日",
    });
    expect(formatWeekPickerLabels(
      { year: 2025, month: 12, day: 29 },
      { year: 2026, month: 1, day: 4 },
      1,
      2026,
      createTranslator("en", "en"),
    )).toEqual({
      trigger: "W1",
      item: "W01",
      range: "12/29–1/4",
      accessible: "Week 1, 2026, December 29, 2025–January 4, 2026",
      selectAccessible: "Select week 1, 2026, December 29, 2025–January 4, 2026",
    });
    expect(formatWeekPickerLabels(
      { year: 2026, month: 12, day: 28 },
      { year: 2027, month: 1, day: 3 },
      53,
      2026,
      createTranslator("zh-TW", "en"),
    )).toMatchObject({
      trigger: "第53週",
      item: "W53",
      range: "12/28–1/3",
    });
  });

  it("provides translated section actions and empty states", () => {
    expect(getWeekViewMessages(createTranslator("zh-CN", "en").t)).toMatchObject({
      overview: "周笔记概览",
      weeklyNote: "周记",
      rangeNotes: "区间笔记",
      createRange: "为本周创建区间笔记",
      datedTasks: "日期任务",
      emptyDatedTasks: "本周没有带日期的任务",
      datedTaskScope: "这里只统计开始、计划或截止日期落在本周的任务。",
    });
  });

  it("explains that the task count represents distinct dated occurrences", () => {
    const t = createTranslator("en", "en").t;
    expect(formatDatedTaskCount(1, t)).toBe(
      "1 dated item; start, scheduled, and due dates for the same task are shown separately.",
    );
    expect(formatDatedTaskCount(3, t)).toBe(
      "3 dated items; start, scheduled, and due dates for the same task are shown separately.",
    );
  });
});
