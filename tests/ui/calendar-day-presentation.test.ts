import { describe, expect, it } from "vitest";

import type { MonthCalendarDay } from "../../src/features/calendar/month-calendar-query";
import { createTranslator } from "../../src/shared/i18n";
import {
  canPreviewCalendarDay,
  formatCalendarDayLabel,
  formatRegionalMarkerLabel,
} from "../../src/ui/calendar/calendar-day-presentation";
import { noteStatistics } from "../support/note-statistics";

function cell(overrides: Partial<MonthCalendarDay> = {}): MonthCalendarDay {
  return Object.freeze({
    date: { year: 2026, month: 7, day: 14 },
    inCurrentMonth: true,
    notePath: "Daily/2026-07-14.md",
    noteState: "has-body",
    preview: "Keep preview unchanged",
    statistics: noteStatistics(),
    calendarOverlays: [],
    holidays: [],
    workday: null,
    regionalMarker: null,
    icsEvents: [],
    heatmap: null,
    ...overrides,
  });
}

describe("calendar day presentation", () => {
  it("opens previews only when the shared day has useful indexed content", () => {
    expect(canPreviewCalendarDay(cell())).toBe(true);
    expect(
      canPreviewCalendarDay(
        cell({
          notePath: null,
          noteState: "not-configured",
          preview: null,
        }),
      ),
    ).toBe(false);
    expect(
      canPreviewCalendarDay(
        cell({
          notePath: null,
          noteState: "not-configured",
          preview: null,
          holidays: [{ region: "sg", name: "National Day" }],
        }),
      ),
    ).toBe(true);
  });

  it("combines localized labels while preserving source calendar text", () => {
    const t = createTranslator("zh-CN", "en").t;
    const value = cell({
      calendarOverlays: [
        {
          id: "chinese-lunar",
          dateText: "六月",
          eventText: "初伏",
          eventKind: "festival",
          transition: "month",
          accessibilityText: "六月初一，初伏",
        },
      ],
      holidays: [{ region: "sg", name: "National Day" }],
      heatmap: { dimension: "word-count", value: 120, level: 2 },
      statistics: noteStatistics({
        taskCompleted: 1,
        taskTotal: 2,
        taskCompletionRate: 50,
      }),
    });

    expect(
      formatCalendarDayLabel(
        "2026-07-14",
        value,
        {
          includeCalendarOverlays: true,
        },
        t,
      ),
    ).toBe(
      "2026-07-14，六月初一，初伏，公共假日：National Day，字数：120，热力图等级 2/4，含正文的笔记，已完成 1/2 个任务",
    );
    expect(
      formatCalendarDayLabel(
        "2026-07-14",
        value,
        {
          includeCalendarOverlays: false,
        },
        t,
      ),
    ).not.toContain("六月初一");
  });

  it("keeps indexed error details adjacent to the translated state", () => {
    const t = createTranslator("en", "en").t;
    const value = cell({
      noteState: "error",
      errorMessage: "permission denied",
      statistics: noteStatistics({ taskTotal: 1 }),
    });

    expect(
      formatCalendarDayLabel(
        "2026-07-14",
        value,
        {
          includeCalendarOverlays: true,
        },
        t,
      ),
    ).toBe("2026-07-14, note read error: permission denied, 0/1 task complete");
  });

  it("formats Traditional Chinese adjusted workdays", () => {
    const t = createTranslator("zh-TW", "en").t;

    expect(
      formatCalendarDayLabel(
        "2026-07-14",
        cell({
          noteState: "missing",
          workday: {
            region: "cn",
            name: "Spring Festival shift",
            isWorkday: true,
          },
          heatmap: { dimension: "task-completion-rate", value: 75, level: 3 },
        }),
        {
          includeCalendarOverlays: true,
        },
        t,
      ),
    ).toBe(
      "2026-07-14，調休工作日：Spring Festival shift，任務完成率：75%，熱力圖等級 3/4，筆記不存在",
    );
  });

  it("localizes semantic regional markers with the resolved plugin language", () => {
    expect(
      formatRegionalMarkerLabel("work", createTranslator("zh-CN", "en").t),
    ).toBe("班");
    expect(
      formatRegionalMarkerLabel("rest", createTranslator("zh-TW", "en").t),
    ).toBe("休");
    expect(
      formatRegionalMarkerLabel("holiday", createTranslator("zh-CN", "en").t),
    ).toBe("公假");
    expect(
      formatRegionalMarkerLabel("holiday", createTranslator("en", "zh-CN").t),
    ).toBe("PH");
  });
});
