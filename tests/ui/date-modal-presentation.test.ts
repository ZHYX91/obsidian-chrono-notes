import { describe, expect, it } from "vitest";

import { createTranslator } from "../../src/shared/i18n";
import { getDateModalMessages } from "../../src/ui/modals/date-modal-presentation";

describe("date modal presentation", () => {
  it("builds mini-calendar controls in the selected locale", () => {
    const messages = getDateModalMessages(createTranslator("zh-CN", "en").t);

    expect(messages).toMatchObject({
      chooseDate: "选择日期",
      previousYear: "上一年",
      previousMonth: "上一个月",
      nextMonth: "下一个月",
      nextYear: "下一年",
      today: "今天",
    });
  });

  it("builds direct-jump controls and validation text", () => {
    const messages = getDateModalMessages(createTranslator("zh-TW", "en").t);

    expect(messages).toMatchObject({
      jumpToDate: "跳至日期",
      date: "日期",
      formats: "支援 2026-07-19、2026/07/19、2026.07.19 或 20260719。",
      cancel: "取消",
      jump: "跳至",
      invalidDate: "請輸入有效日期。",
    });
  });
});
