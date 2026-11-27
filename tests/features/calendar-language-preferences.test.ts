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
    expect(getCalendarOptionsForLanguage("pt").regions).toEqual(HOLIDAY_REGION_DEFINITIONS);
    expect(getCalendarOptionsForLanguage("pt-PT").regions).toEqual(HOLIDAY_REGION_DEFINITIONS);
  });

  it("orders only existing providers and retains all remaining choices in registry order", () => {
    const { calendars } = getCalendarOptionsForLanguage("ar");
    expect(calendars.slice(0, 2).map(({ id }) => id)).toEqual(["islamic-civil", "islamic-umalqura"]);
    expect(calendars.slice(2)).toEqual(CALENDAR_EXTENSION_DEFINITIONS.filter(
      ({ id }) => id !== "islamic-civil" && id !== "islamic-umalqura",
    ));
    expect(getCalendarOptionsForLanguage("hi").calendars[0]?.id).toBe("indian");
    expect(createFirstInstallSettings("hi").calendarExtensions).toEqual([]);
  });
});
