import { describe, expect, it } from "vitest";

import { createTranslator } from "../../src/shared/i18n";
import { formatCalendarNoteState } from "../../src/ui/calendar/calendar-note-presentation";

describe("calendar note presentation", () => {
  it("labels indexing separately from a missing note", () => {
    const t = createTranslator("en", "en").t;

    expect(formatCalendarNoteState("indexing", undefined, t)).toBe(
      "note is being indexed",
    );
    expect(formatCalendarNoteState("missing", undefined, t)).toBe("note missing");
  });

  it("uses one localized state vocabulary across calendar views", () => {
    const simplified = createTranslator("zh-CN", "en").t;
    const traditional = createTranslator("zh-TW", "en").t;

    expect(formatCalendarNoteState("yaml-only", undefined, simplified)).toBe(
      "仅含 frontmatter 的笔记",
    );
    expect(formatCalendarNoteState("error", "permission denied", traditional)).toBe(
      "筆記讀取錯誤：permission denied",
    );
    expect(formatCalendarNoteState("not-configured", undefined, simplified)).toBe(
      "未配置此类笔记",
    );
  });
});
