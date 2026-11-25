import { describe, expect, it } from "vitest";

import { CALENDAR_EXTENSION_IDS, type CalendarExtensionId } from "../../src/core/calendar/calendar-extension";
import {
  CALENDAR_EXTENSION_DEFINITIONS,
  mergeCalendarExtensionEvents,
  selectCalendarExtensionDay,
  selectCalendarExtensionDays,
  updateCalendarExtensionSlot,
} from "../../src/features/calendar/calendar-extension-registry";

import { createTranslator, MESSAGE_CATALOGS } from "../../src/shared/i18n";

describe("calendar extension registry", () => {
  it("registers each supported provider once in stable product order", () => {
    expect(CALENDAR_EXTENSION_DEFINITIONS.map(({ id }) => id)).toEqual(CALENDAR_EXTENSION_IDS);
    expect(new Set(CALENDAR_EXTENSION_DEFINITIONS.map(({ id }) => id)).size)
      .toBe(CALENDAR_EXTENSION_DEFINITIONS.length);
  });

  it("chooses Chinese, the local language or English for each regional lunar festival", () => {
    const festivals = [
      ["vietnamese-lunar", { year: 2030, month: 2, day: 2 }, "vn-new-year", "vi"],
      ["vietnamese-lunar", { year: 2025, month: 4, day: 7 }, "vn-hung-kings", "vi"],
      ["vietnamese-lunar", { year: 2026, month: 9, day: 25 }, "vn-mid-autumn", "vi"],
      ["korean-lunar", { year: 2028, month: 1, day: 27 }, "kr-new-year", "ko"],
      ["korean-lunar", { year: 2026, month: 9, day: 25 }, "kr-autumn", "ko"],
      ["japanese-lunisolar", { year: 2024, month: 9, day: 17 }, "jp-moon-viewing", "ja"],
    ] as const;
    for (const locale of Object.keys(MESSAGE_CATALOGS)) {
      for (const [id, date, festival, native] of festivals) {
        const language = locale.split("-")[0];
        const content = language === native || language === "zh" ? locale : "en";
        const { t } = createTranslator("auto", content);
        expect(selectCalendarExtensionDay(date, locale, id)?.events).toEqual([{
          id: `festival:${festival}`, kind: "festival", text: t(`calendar.festival.${festival}`),
          sources: [{ id, transitionTime: null }],
        }]);
      }
    }
    expect(selectCalendarExtensionDay(festivals[0][1], "vi", "vietnamese-lunar")?.events[0]?.text)
      .toBe("Tết Nguyên đán");
    expect(selectCalendarExtensionDay(festivals[3][1], "ko", "korean-lunar")?.events[0]?.text)
      .toBe("설날");
    expect(selectCalendarExtensionDay(festivals[5][1], "ja", "japanese-lunisolar")?.events[0]?.text)
      .toBe("中秋の名月");
  });

  it("retains independent harvest observances and preserves localized leap months", () => {
    const extended = selectCalendarExtensionDays(
      { year: 2026, month: 9, day: 25 }, "ko", ["korean-lunar", "vietnamese-lunar"],
    );
    expect(mergeCalendarExtensionEvents(extended).map(({ id }) => id))
      .toEqual(["festival:kr-autumn", "festival:vn-mid-autumn"]);
    const leap = { year: 2033, month: 12, day: 22 };
    expect(selectCalendarExtensionDay(leap, "ja", "japanese-lunisolar")?.dateText).toContain("閏11");
    expect(selectCalendarExtensionDay(leap, "vi", "japanese-lunisolar")).toEqual(
      selectCalendarExtensionDay(leap, "en", "japanese-lunisolar"),
    );
    for (const [locale, marker] of [["zh-Hans-MO", "闰"], ["zh-MO", "閏"]] as const) {
      expect(selectCalendarExtensionDay(leap, locale, "japanese-lunisolar")).toMatchObject({
        dateText: `${marker}11月1日`, accessibilityText: `2033年${marker}11月1日`,
      });
    }
  });

  it.each(["vietnamese-lunar", "korean-lunar", "japanese-lunisolar"] as const)(
    "shows Chinese year, month and day units in the full %s date", (calendar) => {
      for (const locale of ["zh-Hans", "zh-Hant"]) {
        expect(selectCalendarExtensionDay({ year: 2026, month: 9, day: 25 }, locale, calendar))
          .toMatchObject({ accessibilityText: "2026年8月15日", transition: null });
      }
    },
  );

  it.each(CALENDAR_EXTENSION_IDS)("uses English content for an unrelated interface language with %s", (id) => {
    const date = id === "french-republican"
      ? { year: 1792, month: 9, day: 22 }
      : { year: 2026, month: 11, day: 25 };
    const english = selectCalendarExtensionDay(date, "en", id);
    expect(english).not.toBeNull();
    expect(selectCalendarExtensionDay(date, "de-DE", id)).toEqual(english);
  });

  it.each([
    ["julian", "ru-RU", /\p{Script=Cyrillic}/u],
    ["coptic", "ar-EG", /\p{Script=Arabic}/u],
    ["persian", "fa-IR", /\p{Script=Arabic}/u],
    ["ethiopic", "am-ET", /\p{Script=Ethiopic}/u],
    ["hebrew", "he-IL", /\p{Script=Hebrew}/u],
    ["indian", "hi-IN", /\p{Script=Devanagari}/u],
    ["islamic-civil", "ar-SA", /\p{Script=Arabic}/u],
    ["islamic-umalqura", "ar-SA", /\p{Script=Arabic}/u],
    ["japanese-era", "ja-JP", /令和/u],
  ] as const)("keeps native and Chinese full-date labels for %s", (id, native, script) => {
    const date = { year: 2026, month: 11, day: 25 };
    expect(selectCalendarExtensionDay(date, native, id)?.accessibilityText).toMatch(script);
    for (const locale of ["zh-Hans", "zh-Hant"]) {
      expect(selectCalendarExtensionDay(date, locale, id)?.accessibilityText).toMatch(/\p{Script=Han}/u);
    }
  });

  it("returns recursively frozen results in selected slot order", () => {
    const result = selectCalendarExtensionDays(
      { year: 2026, month: 2, day: 17 },
      "zh-CN",
      ["ganzhi", "chinese-lunar"],
    );

    expect(result.map(({ id }) => id)).toEqual(["ganzhi", "chinese-lunar"]);
    expect(result[1]).toMatchObject({
      dateText: "正月",
      events: [{ id: "festival:春节", text: "春节" }],
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(result.every(Object.isFrozen)).toBe(true);
  });

  it("deduplicates shared events by stable id and merges ordered sources", () => {
    const extensions = selectCalendarExtensionDays(
      { year: 2026, month: 7, day: 7 },
      "zh-CN",
      ["chinese-lunar", "ganzhi"],
    );

    expect(mergeCalendarExtensionEvents(extensions)).toEqual([{
      id: "solar-term:小暑",
      kind: "solar-term",
      text: "小暑",
      sources: [
        { id: "chinese-lunar", transitionTime: null },
        { id: "ganzhi", transitionTime: "09:56" },
      ],
    }]);
  });

  it("keeps a one-source event independent from both calendar dates", () => {
    const extensions = selectCalendarExtensionDays(
      { year: 2026, month: 7, day: 23 },
      "zh-CN",
      ["chinese-lunar", "ganzhi"],
    );

    expect(mergeCalendarExtensionEvents(extensions)).toEqual([{
      id: "solar-term:大暑",
      kind: "solar-term",
      text: "大暑",
      sources: [{ id: "chinese-lunar", transitionTime: null }],
    }]);
  });

  it("retains every distinct event id even when visible text matches", () => {
    const extensions = Object.freeze([
      Object.freeze({
        id: "chinese-lunar" as const,
        dateText: "初一",
        events: Object.freeze([
          Object.freeze({
            id: "festival:first",
            kind: "festival" as const,
            text: "同名事件",
            sources: Object.freeze([
              Object.freeze({
                id: "chinese-lunar" as const,
                transitionTime: null,
              }),
            ]),
          }),
          Object.freeze({
            id: "festival:second",
            kind: "festival" as const,
            text: "同名事件",
            sources: Object.freeze([
              Object.freeze({
                id: "chinese-lunar" as const,
                transitionTime: null,
              }),
            ]),
          }),
        ]),
        transition: "month" as const,
        accessibilityText: "正月初一",
      }),
    ]);

    expect(mergeCalendarExtensionEvents(extensions).map(({ id }) => id)).toEqual([
      "festival:first",
      "festival:second",
    ]);
  });

  it("rejects provider ids outside the explicit registry", () => {
    expect(() => selectCalendarExtensionDays(
      { year: 2026, month: 2, day: 17 },
      "zh-CN",
      ["unknown" as CalendarExtensionId],
    )).toThrow("Unknown calendar extension: unknown");
  });

  it("updates compact ordered slots without allowing duplicate providers", () => {
    expect(updateCalendarExtensionSlot(["chinese-lunar"], 1, "ganzhi")).toEqual([
      "chinese-lunar",
      "ganzhi",
    ]);
    expect(updateCalendarExtensionSlot(["chinese-lunar", "ganzhi"], 0, null)).toEqual([
      "ganzhi",
    ]);
    expect(updateCalendarExtensionSlot(["chinese-lunar", "ganzhi"], 1, "chinese-lunar"))
      .toEqual(["chinese-lunar"]);
  });
});
