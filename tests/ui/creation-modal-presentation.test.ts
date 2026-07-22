import { describe, expect, it } from "vitest";

import { createTranslator } from "../../src/shared/i18n";
import {
  formatIntervalSummary,
  getCreationModalMessages,
} from "../../src/ui/modals/creation-modal-presentation";

describe("creation modal presentation", () => {
  it("builds periodic and shared confirmation controls", () => {
    const messages = getCreationModalMessages(createTranslator("en", "en").t);

    expect(messages).toMatchObject({
      createPeriodicTitle: "Create periodic note?",
      suppressFuturePeriodicConfirmation:
        "Do not confirm future periodic-note creation",
      suppressFutureIntervalConfirmation:
        "Do not confirm future range-note creation",
      cancel: "Cancel",
      create: "Create",
    });
  });

  it("builds range-input labels and validation text", () => {
    const messages = getCreationModalMessages(createTranslator("zh-CN", "en").t);

    expect(messages).toMatchObject({
      createRangeTitle: "创建区间笔记",
      startDate: "开始日期",
      endDate: "结束日期",
      continue: "继续",
      invalidRange: "请输入两个不同的有效日期，格式为 YYYY-MM-DD。",
    });
  });

  it("formats an inclusive range summary without changing the title", () => {
    const t = createTranslator("zh-TW", "en").t;

    expect(formatIntervalSummary("2026-07-04 - 2026-07-10", 7, t))
      .toBe("2026-07-04 - 2026-07-10（共 7 天）");
  });
});
