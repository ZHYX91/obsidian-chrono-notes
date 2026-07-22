import { describe, expect, it } from "vitest";

import { createTranslator } from "../../../src/shared/i18n";
import {
  formatCopiedDateNotice,
  getCopyDateFailedNotice,
  getDateContextMenuActionLabel,
} from "../../../src/adapters/obsidian/date-context-menu-presentation";

describe("date context menu presentation", () => {
  it("translates open and create variants without changing action ids", () => {
    const t = createTranslator("zh-CN", "en").t;

    expect(getDateContextMenuActionLabel("open-default", true, t)).toBe("打开日记");
    expect(getDateContextMenuActionLabel("open-default", false, t)).toBe("创建日记");
    expect(getDateContextMenuActionLabel("open-tab", false, t)).toBe("在新标签页中打开");
    expect(getDateContextMenuActionLabel("create-range", false, t)).toBe("创建区间笔记");
    expect(getDateContextMenuActionLabel("copy-date", false, t)).toBe("复制日期");
  });

  it("preserves the formatted date in localized clipboard feedback", () => {
    const traditional = createTranslator("zh-TW", "en").t;
    expect(formatCopiedDateNotice("2026-07-14", traditional)).toBe(
      "已複製日期：2026-07-14",
    );
    expect(getCopyDateFailedNotice(traditional)).toBe("複製日期失敗");

    const english = createTranslator("en", "en").t;
    expect(formatCopiedDateNotice("2026-07-14", english)).toBe(
      "Copied date: 2026-07-14",
    );
  });
});
