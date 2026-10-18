import { describe, expect, it } from "vitest";

import { createTranslator } from "../../src/shared/i18n";
import {
  formatHigherNoteLabel,
  formatNoteNavbarLabel,
  getNoteNavbarMessages,
} from "../../src/ui/note-navbar/note-navbar-presentation";

describe("note navbar presentation", () => {
  it("builds translated command and related-range labels", () => {
    const messages = getNoteNavbarMessages(createTranslator("zh-CN", "en").t);

    expect(messages).toMatchObject({
      previousPeriod: "上一个周期",
      nextPeriod: "下一个周期",
      chooseDate: "选择日期",
      openCalendar: "打开 Chrono Notes",
      relatedRangeNotes: "相关区间笔记",
    });
  });

  it("formats the higher periodic-note target without exposing enum ids", () => {
    const en = createTranslator("en", "en").t;
    const zhTw = createTranslator("zh-TW", "en").t;

    expect(formatHigherNoteLabel("quarterly", en)).toBe("Open quarterly note");
    expect(formatHigherNoteLabel("weekly", zhTw)).toBe("開啟週記");
  });

  it("translates week labels while preserving the ISO week identity at New Year", () => {
    expect(formatNoteNavbarLabel(
      { year: 2025, month: 12, day: 29 }, "weekly", createTranslator("en", "en"), "monday",
    )).toBe("Week 1");
    expect(formatNoteNavbarLabel(
      { year: 2025, month: 12, day: 28 }, "weekly", createTranslator("zh-TW", "en"), "sunday",
    )).toBe("第1週");
    expect(formatNoteNavbarLabel(
      { year: 2025, month: 12, day: 29 }, "weekly", createTranslator("ar", "en"), "monday",
    )).not.toContain("Week");
  });

  it("formats civil dates without changing their year in locale-specific calendars", () => {
    const translator = createTranslator("fa", "en");
    const result = formatNoteNavbarLabel(
      { year: 2026, month: 1, day: 1 }, "yearly", translator, "monday",
    );
    expect(result).toContain(new Intl.NumberFormat("fa", { useGrouping: false }).format(2026));
    expect(formatNoteNavbarLabel(
      { year: 7, month: 1, day: 2 }, "daily", createTranslator("en", "en"), "monday",
    )).toBe("0007-01-02");
  });
});
