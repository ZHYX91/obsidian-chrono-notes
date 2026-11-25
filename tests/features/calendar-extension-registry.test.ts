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

  it("localizes each regional lunar festival in every catalog and keeps its source", () => {
    const festivals = [
      ["vietnamese-lunar", { year: 2030, month: 2, day: 2 }, "vn-new-year"],
      ["vietnamese-lunar", { year: 2025, month: 4, day: 7 }, "vn-hung-kings"],
      ["vietnamese-lunar", { year: 2026, month: 9, day: 25 }, "vn-mid-autumn"],
      ["korean-lunar", { year: 2028, month: 1, day: 27 }, "kr-new-year"],
      ["korean-lunar", { year: 2026, month: 9, day: 25 }, "kr-autumn"],
      ["japanese-lunisolar", { year: 2024, month: 9, day: 17 }, "jp-moon-viewing"],
    ] as const;
    for (const locale of Object.keys(MESSAGE_CATALOGS)) {
      const { t } = createTranslator("auto", locale);
      for (const [id, date, festival] of festivals) {
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
    expect(selectCalendarExtensionDay(leap, "vi", "japanese-lunisolar")?.dateText).toContain("11 nhuận");
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
