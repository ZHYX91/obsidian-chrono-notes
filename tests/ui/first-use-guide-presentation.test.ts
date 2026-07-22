import { describe, expect, it } from "vitest";

import { createTranslator } from "../../src/shared/i18n";
import { getFirstUseGuideMessages } from "../../src/ui/modals/first-use-guide-presentation";

describe("first-use guide presentation", () => {
  it("builds the complete Simplified Chinese guide", () => {
    const messages = getFirstUseGuideMessages(
      createTranslator("zh-CN", "en").t,
      "Ctrl",
    );

    expect(messages.title).toBe("快速上手 Chrono Notes");
    expect(messages.intro).toBe("这些常用操作可能不太显眼：");
    expect(messages.hints).toEqual([
      "单击日期或周期只会选中，不会打开笔记。",
      "双击或按 Enter 打开笔记；中键、Ctrl+单击可在新标签页打开，触摸端可长按。",
      "右键日期可打开或创建日记、创建区间笔记、在新标签页打开或复制日期。",
      "日期格的形状、数字和文字表示笔记、任务与日历状态。",
      "周期笔记顶部的 Note Navbar 可切换前后周期或打开上级周期笔记。",
    ]);
    expect(messages.openSettings).toBe("打开设置");
    expect(messages.dismiss).toBe("知道了");
  });

  it("interpolates the platform modifier without translating it", () => {
    const messages = getFirstUseGuideMessages(createTranslator("en", "en").t, "Cmd");

    expect(messages.hints[1]).toContain("Cmd-click");
    expect(messages.hints[1]).toContain("long-press");
  });
});
