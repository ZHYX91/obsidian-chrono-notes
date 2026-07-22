import { describe, expect, it } from "vitest";

import { createTranslator } from "../../src/shared/i18n";
import {
  formatHigherNoteLabel,
  getNoteNavbarMessages,
} from "../../src/ui/note-navbar/note-navbar-presentation";

describe("note navbar presentation", () => {
  it("builds translated command and related-range labels", () => {
    const messages = getNoteNavbarMessages(createTranslator("zh-CN", "en").t);

    expect(messages).toMatchObject({
      previousPeriod: "上一个周期",
      nextPeriod: "下一个周期",
      chooseDate: "选择日期",
      openCalendar: "打开 Chrono Notes 日历",
      relatedRangeNotes: "相关区间笔记",
    });
  });

  it("formats the higher periodic-note target without exposing enum ids", () => {
    const en = createTranslator("en", "en").t;
    const zhTw = createTranslator("zh-TW", "en").t;

    expect(formatHigherNoteLabel("quarterly", en)).toBe("Open quarterly note");
    expect(formatHigherNoteLabel("weekly", zhTw)).toBe("開啟週記");
  });
});
