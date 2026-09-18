import { describe, expect, it } from "vitest";

import {
  formatPeriodicNotePath,
  parsePeriodicNotePath,
} from "../../src/core/periodic/periodic-note-path";

describe("periodic path locale", () => {
  const date = { year: 2026, month: 9, day: 17 } as const;
  const rule = {
    noteType: "daily" as const,
    pattern: "[Journal]/MMMM/YYYY-MM-DD",
    pathLocale: "en",
  };

  it("keeps localized filenames stable when the interface locale changes", () => {
    const englishUi = formatPeriodicNotePath(date, rule, {
      locale: "en",
      weekStartDay: "monday",
    });
    const chineseUi = formatPeriodicNotePath(date, rule, {
      locale: "zh-CN",
      weekStartDay: "monday",
    });

    expect(englishUi).toBe("Journal/September/2026-09-17.md");
    expect(chineseUi).toBe(englishUi);
    expect(parsePeriodicNotePath(chineseUi!, rule, {
      locale: "zh-CN",
      weekStartDay: "monday",
    })).toEqual(date);
  });

  it("uses the canonical English path locale when no explicit override exists", () => {
    const legacyRule = { noteType: "daily" as const, pattern: "[Journal]/MMMM/YYYY-MM-DD" };
    const englishUi = formatPeriodicNotePath(date, legacyRule, {
      locale: "en",
      weekStartDay: "monday",
    });
    const chineseUi = formatPeriodicNotePath(date, legacyRule, {
      locale: "zh-CN",
      weekStartDay: "monday",
    });

    expect(englishUi).toBe("Journal/September/2026-09-17.md");
    expect(chineseUi).toBe(englishUi);
  });
});
