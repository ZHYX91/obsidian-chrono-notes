import { describe, expect, it, vi } from "vitest";

import { CALENDAR_EXTENSION_DEFINITIONS } from "../../src/features/calendar/calendar-extension-registry";
import {
  createFirstInstallSettings,
  getCalendarOptionsForLanguage,
} from "../../src/features/calendar/calendar-language-preferences";
import { HOLIDAY_REGION_DEFINITIONS } from "../../src/features/calendar/holiday-region-registry";
import { createTranslator } from "../../src/shared/i18n";

describe("calendar language preferences", () => {
  it.each([
    ["zh", "chinese-lunar"], ["zh_Hant_HK", "chinese-lunar"],
    ["ja", "japanese-lunisolar"], ["ko", "korean-lunar"], ["vi", "vietnamese-lunar"],
    ["fa", "persian"], ["iw", "hebrew"], ["am", "ethiopic"],
    ["en", null], ["de", null], ["fr-CA", null], ["es-MX", null], ["pt-BR", null],
    ["ru", null], ["ar-EG", null], ["hi", null], ["zz", null], ["", null],
  ] as const)("uses only supported initial selections for %s", (language, expected) => {
    const settings = createFirstInstallSettings(language);
    const availableCalendar = CALENDAR_EXTENSION_DEFINITIONS.find(({ id }) => id === expected);
    expect(settings.calendarExtensions).toEqual(availableCalendar?.isSupported(language) ? [expected] : []);
    const availableRegion = HOLIDAY_REGION_DEFINITIONS.find(({ id }) => String(id) === "jp");
    expect(settings.holidayRegions).toEqual(language === "ja" && availableRegion ? [availableRegion.id] : []);
  });

  it.each([
    ["ja", ["japanese-lunisolar", "japanese-era"], ["japanese-lunisolar"]],
    ["ko-KR", ["korean-lunar"], ["korean-lunar"]],
    ["vi-VN", ["vietnamese-lunar"], ["vietnamese-lunar"]],
    ["hi-IN", ["indian", "indian-panchanga"], []],
    ["fr-CA", ["french-republican"], []],
    ["es-GT", ["chol-qij"], []],
    ["quc-GT", ["chol-qij"], []],
  ] as const)("separates suggested options from one-time defaults for %s", (locale, ranked, enabled) => {
    const options = getCalendarOptionsForLanguage(locale);
    expect(options.calendars.slice(0, ranked.length).map(({ id }) => id)).toEqual(ranked);
    expect(createFirstInstallSettings(locale).calendarExtensions).toEqual(enabled);
  });

  it("omits unsupported calendars when initializing", () => {
    const support = vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      locale: "en", calendar: "gregory", numberingSystem: "latn", timeZone: "UTC",
    });
    try {
      expect(createFirstInstallSettings("fa").calendarExtensions).toEqual([]);
    } finally {
      support.mockRestore();
    }
  });

  it("prioritizes candidates from the original language tag without consuming a slot", () => {
    const cn = createTranslator("auto", "zh-SG");
    expect(cn.locale).toBe("zh-CN");
    expect(getCalendarOptionsForLanguage(cn.languageTag).regions.slice(0, 2).map(({ id }) => id))
      .toEqual(["sg", "cn"]);
    expect(createFirstInstallSettings(cn.languageTag).holidayRegions).toEqual([]);

    const explicit = createTranslator("es-ES", "zh-SG");
    expect(explicit.languageTag).toBe("es-ES");
    const unknown = createTranslator("auto", "it");
    expect(unknown.locale).toBe("en");
    expect(getCalendarOptionsForLanguage(unknown.languageTag).regions)
      .toEqual(HOLIDAY_REGION_DEFINITIONS);
  });

  it.each([
    ["de", ["de", "at"]], ["de-AT", ["at", "de"]],
    ["fr", ["fr", "ca-qc"]], ["fr-CA", ["ca-qc", "fr"]],
    ["es", ["es", "mx"]], ["es-MX", ["mx", "es"]],
    ["pt", ["pt"]], ["pt-PT", ["pt"]], ["pt-BR", ["br"]],
  ] as const)("prioritizes published regional options for %s without selecting them", (locale, preferred) => {
    const offered = getCalendarOptionsForLanguage(locale).regions.map(({ id }) => id);
    const available = preferred.filter((id) => HOLIDAY_REGION_DEFINITIONS.some((item) => String(item.id) === id));
    expect(offered.slice(0, available.length)).toEqual(available);
    expect(createFirstInstallSettings(locale).holidayRegions).toEqual([]);
  });

  it("orders only existing providers and retains all remaining choices in registry order", () => {
    const { calendars } = getCalendarOptionsForLanguage("ar");
    expect(calendars.slice(0, 2).map(({ id }) => id)).toEqual(["islamic-civil", "islamic-umalqura"]);
    expect(calendars.slice(2)).toEqual(CALENDAR_EXTENSION_DEFINITIONS.filter(
      ({ id }) => id !== "islamic-civil" && id !== "islamic-umalqura",
    ));
    expect(getCalendarOptionsForLanguage("hi").calendars[0]?.id).toBe("indian");
    if (CALENDAR_EXTENSION_DEFINITIONS.some(({ id }) => String(id) === "indian-panchanga")) {
      expect(getCalendarOptionsForLanguage("hi").calendars[1]?.id).toBe("indian-panchanga");
    }
    expect(createFirstInstallSettings("hi").calendarExtensions).toEqual([]);
  });
});
