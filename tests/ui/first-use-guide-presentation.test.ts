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
    expect(messages.intro).toBe("先了解这几个常用操作：");
    expect(messages.hints).toEqual([
      "单击日期或周期只会选中，不会打开笔记。",
      "双击或按 Enter 打开笔记；中键或 Ctrl+单击在新标签页打开。触屏长按周、月等周期入口可直接打开笔记。",
      "右键或长按日期可打开菜单，进行日记、日历事件、区间笔记和复制日期等操作。长按未弹出菜单时，松手后会打开或创建日记。",
      "日期格里的标记和数字表示笔记状态、任务进度和日历事件。",
      "周期笔记上方的导航栏可以切换前后周期，或打开更大周期的笔记。",
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
