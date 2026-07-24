import { describe, expect, it } from "vitest";

import type { CalendarExtensionId } from "../../src/core/calendar/calendar-extension";
import {
  CALENDAR_EXTENSION_DEFINITIONS,
  mergeCalendarExtensionEvents,
  selectCalendarExtensionDays,
  updateCalendarExtensionSlot,
} from "../../src/features/calendar/calendar-extension-registry";

describe("calendar extension registry", () => {
  it("registers each supported provider once in stable product order", () => {
    expect(CALENDAR_EXTENSION_DEFINITIONS.map(({ id }) => id)).toEqual([
      "chinese-lunar",
      "ganzhi",
      "persian",
      "ethiopic",
      "hebrew",
      "indian",
      "islamic-civil",
      "islamic-umalqura",
    ]);
    expect(new Set(CALENDAR_EXTENSION_DEFINITIONS.map(({ id }) => id)).size)
      .toBe(CALENDAR_EXTENSION_DEFINITIONS.length);
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
