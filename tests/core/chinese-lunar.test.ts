import { describe, expect, it } from "vitest";
import { I18n } from "lunar-typescript";

import { getChineseLunarDay } from "../../src/core/calendar/chinese-lunar";

describe("getChineseLunarDay", () => {
  it("keeps the lunar month visible when Spring Festival starts a month", () => {
    const info = getChineseLunarDay({ year: 2026, month: 2, day: 17 }, "zh-CN");

    expect(info).toEqual({
      lunarMonth: 1,
      lunarDay: 1,
      isLeapMonth: false,
      lunarMonthName: "正月",
      lunarDayName: "初一",
      festival: "春节",
      solarTerm: null,
      dateText: "正月",
      eventText: "春节",
      eventKind: "festival",
      transition: "month",
      accessibilityText: "正月初一，春节",
    });
    expect(Object.isFrozen(info)).toBe(true);
  });

  it("keeps traditional festivals separate from ordinary lunar day text", () => {
    expect(getChineseLunarDay({ year: 2026, month: 9, day: 25 }, "zh-CN")).toMatchObject({
      lunarMonth: 8,
      lunarDay: 15,
      festival: "中秋",
      dateText: "十五",
      eventText: "中秋",
      eventKind: "festival",
    });
  });

  it("keeps solar terms separate from ordinary lunar day text", () => {
    expect(getChineseLunarDay({ year: 2026, month: 4, day: 5 }, "zh-CN")).toMatchObject({
      festival: null,
      solarTerm: "清明",
      eventText: "清明",
      eventKind: "solar-term",
    });
  });

  it("preserves leap-month identity and shows the month name on its first day", () => {
    expect(getChineseLunarDay({ year: 2025, month: 7, day: 25 }, "zh-CN")).toMatchObject({
      lunarMonth: 6,
      lunarDay: 1,
      isLeapMonth: true,
      lunarMonthName: "闰六月",
      lunarDayName: "初一",
      dateText: "闰六月",
      eventText: null,
      transition: "month",
    });
  });

  it("uses the lunar day on an ordinary date", () => {
    expect(getChineseLunarDay({ year: 2026, month: 1, day: 1 }, "zh-CN")).toMatchObject({
      lunarMonth: 11,
      lunarDay: 13,
      festival: null,
      solarTerm: null,
      dateText: "十三",
      eventText: null,
      transition: null,
    });
  });

  it("keeps language calls isolated and preserves complete English festival names", () => {
    I18n.setLanguage("en");
    const traditional = getChineseLunarDay({ year: 2026, month: 2, day: 17 }, "zh-TW");
    const english = getChineseLunarDay({ year: 2026, month: 2, day: 17 }, "en-US");

    expect(traditional).toMatchObject({ festival: "春節", eventText: "春節" });
    expect(english).toMatchObject({
      festival: "Lunar New Year",
      eventText: "Lunar New Year",
    });
    expect(I18n.getLanguage()).toBe("en");
  });
});
