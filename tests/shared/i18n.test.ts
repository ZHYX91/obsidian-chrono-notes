import { describe, expect, it } from "vitest";

import {
  MESSAGE_CATALOGS,
  createTranslator,
  resolvePluginLocale,
  type MessageKey,
  type MessageCatalogs,
  type MessageValue,
} from "../../src/shared/i18n";

describe("resolvePluginLocale", () => {
  it("honors an explicit plugin locale", () => {
    expect(resolvePluginLocale("en", "zh-CN")).toBe("en");
    expect(resolvePluginLocale("zh-CN", "en-US")).toBe("zh-CN");
    expect(resolvePluginLocale("zh-TW", "en-US")).toBe("zh-TW");
    expect(resolvePluginLocale("ar", "en-US")).toBe("ar");
    expect(resolvePluginLocale("fa", "en-US")).toBe("fa");
    expect(resolvePluginLocale("he", "en-US")).toBe("he");
    expect(resolvePluginLocale("am", "en-US")).toBe("am");
    expect(resolvePluginLocale("hi", "en-US")).toBe("hi");
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

  it("maps the five added automatic languages, including legacy Hebrew", () => {
    expect(resolvePluginLocale("auto", "ar-SA")).toBe("ar");
    expect(resolvePluginLocale("auto", "fa-IR")).toBe("fa");
    expect(resolvePluginLocale("auto", "he-IL")).toBe("he");
    expect(resolvePluginLocale("auto", "iw-IL")).toBe("he");
    expect(resolvePluginLocale("auto", "am-ET")).toBe("am");
    expect(resolvePluginLocale("auto", "hi-IN")).toBe("hi");
  });
});

describe("createTranslator", () => {
  it("labels the automatic language choice as following Obsidian in every locale", () => {
    for (const catalog of Object.values(MESSAGE_CATALOGS)) {
      expect(catalog["settings.general.auto"]).toEqual(
        expect.stringContaining("Obsidian"),
      );
      expect(catalog["settings.general.language"]).toBeTruthy();
      expect(catalog["settings.general.languageDesc"]).toContain(
        catalog["settings.general.auto"] as string,
      );
    }
    expect(MESSAGE_CATALOGS.ar["settings.general.languageEnglish"]).toBe("الإنجليزية");
  });

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

  it("selects every Arabic plural category with an other fallback", () => {
    const translator = createTranslator("ar", "ar-SA");
    expect(translator.t("pluginNotice.events", { count: 0 })).toBe(
      "لا توجد أحداث",
    );
    expect(translator.t("pluginNotice.events", { count: 1 })).toBe(
      "حدث واحد",
    );
    expect(translator.t("pluginNotice.events", { count: 2 })).toBe(
      "حدثان",
    );
    expect(translator.t("pluginNotice.events", { count: 3 })).toBe(
      "3 أحداث",
    );
    expect(translator.t("pluginNotice.events", { count: 11 })).toBe(
      "11 حدثًا",
    );
    expect(translator.t("pluginNotice.events", { count: 100 })).toBe(
      "100 حدث",
    );
  });

  it("falls back to the required other form when a locale category is absent", () => {
    const catalogs: MessageCatalogs = {
      ...MESSAGE_CATALOGS,
      ar: {
        ...MESSAGE_CATALOGS.ar,
        "pluginNotice.events": {
          other: "fallback {count}",
        },
      },
    };

    expect(
      createTranslator("ar", "ar-SA", catalogs).t("pluginNotice.events", {
        count: 2,
      }),
    ).toBe("fallback 2");
  });

  it("selects Hebrew dual messages and keeps locale-specific zero semantics", () => {
    const hebrew = createTranslator("he", "he-IL");
    expect(hebrew.t("pluginNotice.events", { count: 1 })).toBe("אירוע 1");
    expect(hebrew.t("pluginNotice.events", { count: 2 })).toBe("2 אירועים");
    expect(hebrew.t("pluginNotice.events", { count: 3 })).toBe("אירועי 3");

    for (const locale of ["fa", "am", "hi"] as const) {
      const translator = createTranslator(locale, locale);
      const value = translator.t("pluginNotice.events", { count: 0 });
      expect(value).toContain("0");
      expect(value).not.toBe("");
    }
  });

  it("provides complete added-language catalogs with the correct direction", () => {
    expect(createTranslator("ar", "en").t("calendar.today")).toBe("اليوم");
    expect(createTranslator("fa", "en").t("calendar.today")).toBe("امروز");
    expect(createTranslator("he", "en").t("calendar.today")).toBe("היום");
    expect(createTranslator("am", "en").t("calendar.today")).toBe("ዛሬ");
    expect(createTranslator("hi", "en").t("calendar.today")).toBe("आज");

    expect(createTranslator("ar", "en").direction).toBe("rtl");
    expect(createTranslator("fa", "en").direction).toBe("rtl");
    expect(createTranslator("he", "en").direction).toBe("rtl");
    expect(createTranslator("am", "en").direction).toBe("ltr");
    expect(createTranslator("hi", "en").direction).toBe("ltr");
  });

  it("documents every custom property-format token family in all locales", () => {
    for (const catalog of Object.values(MESSAGE_CATALOGS)) {
      expect(catalog["settings.general.propertyDateCustomFormatDesc"]).toContain("MMMM");
      expect(catalog["settings.general.propertyDateCustomFormatDesc"]).toContain("dddd");
      expect(catalog["settings.general.propertyDateCustomFormatDesc"]).toContain(
        "YYYY-MM-DD dddd",
      );
      expect(catalog["settings.general.propertyTimeCustomFormatDesc"]).toContain("LT/LTS");
      expect(catalog["settings.general.propertyTimeCustomFormatDesc"]).toContain("k/kk");
      expect(catalog["settings.general.propertyTimeCustomFormatDesc"]).toContain("m/mm");
      expect(catalog["settings.general.propertyTimeCustomFormatDesc"]).toContain("s/ss");
      expect(catalog["settings.general.propertyTimeCustomFormatDesc"]).toContain("SSS");
      expect(catalog["settings.general.propertyFormatInvalid"]).toBeTruthy();
    }
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
  const messages = typeof value === "string"
    ? [value]
    : Object.values(value).filter((message): message is string =>
      typeof message === "string");
  return [...new Set(
    messages.flatMap((message) =>
      [...message.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/g)]
        .map((match) => match[1] ?? "")
        .filter(Boolean),
    ),
  )].sort();
}
