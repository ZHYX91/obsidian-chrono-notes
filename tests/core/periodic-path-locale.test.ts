import { describe, expect, it } from "vitest";
import { getPeriodAnchor } from "../../src/core/periodic/periodic-date";
import { migrateSettings, normalizeSettings } from "../../src/shared/settings";

import {
  formatPeriodicNotePath,
  parsePeriodicNotePath,
} from "../../src/core/periodic/periodic-note-path";

describe("periodic path locale", () => {
  it.each([
    ["daily", "[Daily]/YYYY-MM-DD"],
    ["daily", "[Daily]/GGGG-WW-dddd"],
    ["daily", "[Daily]/YYYY-MMMM-DD"],
    ["weekly", "[Weekly]/GGGG-[W]WW"],
    ["monthly", "[Monthly]/YYYY-MMMM"],
    ["quarterly", "YYYY-[Q]Q"],
    ["yearly", "YYYY"],
    ["decadal", "DEC[s]"],
    ["century", "[C]CEN"],
    ["daily", "[C]CEN/DEC[s]/YYYY-MM-DD"],
  ] as const)("migrates and reverses Persian %s filenames in %s", (noteType, pattern) => {
    const settings = normalizeSettings(migrateSettings({ schemaVersion: 18, locale: "fa",
      periodicNotes: { [noteType]: { enabled: true, pattern, templatePath: "" } } }));
    const rule = { noteType, ...settings.periodicNotes[noteType] };
    const options = { locale: "zh-CN", weekStartDay: "monday" } as const;
    const path = formatPeriodicNotePath(date, rule, options);
    expect(rule.pathLocale).toBe("fa");
    expect(path).not.toBeNull();
    expect(parsePeriodicNotePath(path!, rule, options))
      .toEqual(getPeriodAnchor(date, noteType, "monday"));
    if (pattern === "[Daily]/YYYY-MM-DD") expect(path).toBe("Daily/۲۰۲۶-۰۹-۱۷.md");
  });
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
