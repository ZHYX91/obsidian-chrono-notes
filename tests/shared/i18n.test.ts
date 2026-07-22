import { describe, expect, it } from "vitest";

import {
  MESSAGE_CATALOGS,
  createTranslator,
  resolvePluginLocale,
  type MessageKey,
  type MessageValue,
} from "../../src/shared/i18n";

describe("resolvePluginLocale", () => {
  it("honors an explicit plugin locale", () => {
    expect(resolvePluginLocale("en", "zh-CN")).toBe("en");
    expect(resolvePluginLocale("zh-CN", "en-US")).toBe("zh-CN");
    expect(resolvePluginLocale("zh-TW", "en-US")).toBe("zh-TW");
  });

  it("maps automatic Chinese scripts and regions without conflating them", () => {
    expect(resolvePluginLocale("auto", "zh-Hans-SG")).toBe("zh-CN");
    expect(resolvePluginLocale("auto", "zh-Hant-HK")).toBe("zh-TW");
    expect(resolvePluginLocale("auto", "zh-MO")).toBe("zh-TW");
    expect(resolvePluginLocale("auto", "zh")).toBe("zh-CN");
  });

  it("falls back unknown automatic locales to English", () => {
    expect(resolvePluginLocale("auto", "fr-FR")).toBe("en");
    expect(resolvePluginLocale("auto", "")).toBe("en");
  });
});

describe("createTranslator", () => {
  it("translates and interpolates the three complete runtime catalogs", () => {
    expect(createTranslator("en", "zh-CN").t("calendar.previous", {
      period: "month",
    })).toBe("Previous month");
    expect(createTranslator("zh-CN", "en").t("calendar.previous", {
      period: "一个月",
    })).toBe("上一个月");
    expect(createTranslator("zh-TW", "en").t("calendar.previous", {
      period: "一個月",
    })).toBe("上一個月");
  });

  it("selects singular and plural count messages", () => {
    const translator = createTranslator("en", "en-US");
    expect(translator.t("calendar.ics.moreEvents", { count: 1 })).toBe("1 more event");
    expect(translator.t("calendar.ics.moreEvents", { count: 2 })).toBe("2 more events");
  });

  it("distinguishes This month and ISO week-picker actions in all locales", () => {
    const english = createTranslator("en", "en-US");
    const simplified = createTranslator("zh-CN", "en-US");
    const traditional = createTranslator("zh-TW", "en-US");

    expect(english.t("calendar.thisMonth")).toBe("This month");
    expect(simplified.t("calendar.thisMonth")).toBe("本月");
    expect(traditional.t("calendar.thisMonth")).toBe("本月");
    expect(simplified.t("calendar.selectThisMonth", {
      year: 2026,
      month: "7月",
    })).toBe("选择本月：2026 年 7月");
    expect(english.t("calendar.selectWeekYear", { year: 2026 })).toBe(
      "Select week year 2026",
    );
    expect(simplified.t("calendar.weekYearPicker")).toBe("周历年选择器");
    expect(traditional.t("calendar.weekPicker")).toBe("週選擇器");
    expect(simplified.t("calendar.selectWeek", {
      week: 1,
      weekYear: 2026,
      details: "2025年12月29日–2026年1月4日",
    })).toBe("选择第 1 周（2026），2025年12月29日–2026年1月4日");
    expect(english.t("calendar.currentPickerTarget", {
      target: "Select 2026",
    })).toBe("Select 2026 (current)");
    expect(simplified.t("calendar.currentPickerTarget", {
      target: "选择 2026 年",
    })).toBe("选择 2026 年（当前）");
    expect(traditional.t("calendar.currentPickerTarget", {
      target: "選擇 2026 年",
    })).toBe("選擇 2026 年（目前）");
  });

  it("keeps every runtime catalog key-complete with matching placeholders", () => {
    const sourceKeys = Object.keys(MESSAGE_CATALOGS["zh-CN"]) as MessageKey[];
    const expectedKeys = [...sourceKeys].sort();

    for (const catalog of Object.values(MESSAGE_CATALOGS)) {
      expect(Object.keys(catalog).sort()).toEqual(expectedKeys);
      for (const key of sourceKeys) {
        expect(collectPlaceholders(catalog[key]), key).toEqual(
          collectPlaceholders(MESSAGE_CATALOGS["zh-CN"][key]),
        );
      }
    }
  });
});

function collectPlaceholders(value: MessageValue): string[] {
  const messages = typeof value === "string" ? [value] : [value.one, value.other];
  return [...new Set(
    messages.flatMap((message) =>
      [...message.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/g)]
        .map((match) => match[1] ?? "")
        .filter(Boolean),
    ),
  )].sort();
}
