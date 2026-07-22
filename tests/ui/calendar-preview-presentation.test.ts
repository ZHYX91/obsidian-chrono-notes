import { describe, expect, it } from "vitest";

import { createTranslator } from "../../src/shared/i18n";
import {
  formatCalendarPreviewError,
  formatCalendarPreviewHeatmap,
  formatCalendarPreviewRegional,
  formatCalendarPreviewTaskProgress,
  getCalendarPreviewStateText,
} from "../../src/ui/calendar/calendar-preview-presentation";

describe("calendar preview presentation", () => {
  it("formats heatmap and task progress in English", () => {
    const t = createTranslator("en", "en").t;

    expect(formatCalendarPreviewHeatmap({
      dimension: "word-count",
      value: 120,
      level: 2,
    }, t)).toBe("Words: 120, heatmap level 2 of 4");
    expect(formatCalendarPreviewTaskProgress({ completed: 1, total: 1 }, t)).toBe(
      "1/1 task complete",
    );
    expect(formatCalendarPreviewTaskProgress({ completed: 1, total: 2 }, t)).toBe(
      "1/2 tasks complete",
    );
  });

  it("translates regional prefixes without changing source names", () => {
    const t = createTranslator("zh-CN", "en").t;

    expect(formatCalendarPreviewRegional({
      holidays: [{
        region: "sg",
        name: "National Day",
      }],
    }, t)).toBe("公共假日：National Day");
  });

  it("translates note states and preserves indexed errors", () => {
    const t = createTranslator("zh-TW", "en").t;

    expect(getCalendarPreviewStateText("yaml-only", t)).toBe("僅含 frontmatter 的筆記");
    expect(getCalendarPreviewStateText("not-configured", t)).toBe("未設定日記");
    expect(formatCalendarPreviewError("permission denied", t)).toBe(
      "無法讀取筆記：permission denied",
    );
    expect(formatCalendarPreviewError(undefined, t)).toBe("無法讀取筆記：未知錯誤");
  });
});
