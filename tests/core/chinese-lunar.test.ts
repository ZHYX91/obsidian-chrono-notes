import { describe, expect, it } from "vitest";
import { I18n } from "lunar-typescript";

import { getChineseLunarDay } from "../../src/core/calendar/chinese-lunar";

describe("getChineseLunarDay", () => {
  it("keeps the lunar month visible and exposes all festivals as stable events", () => {
    const info = getChineseLunarDay({ year: 2026, month: 2, day: 17 }, "zh-CN");

    expect(info).toMatchObject({
      lunarMonth: 1,
      lunarDay: 1,
      isLeapMonth: false,
      lunarMonthName: "正月",
      lunarDayName: "初一",
      festivals: ["春节"],
      solarTerm: null,
      dateText: "正月",
      events: [{
        id: "festival:春节",
        kind: "festival",
        text: "春节",
        sources: [{
          id: "chinese-lunar",
          transitionTime: null,
        }],
      }],
      transition: "month",
      accessibilityText: "正月初一",
    });
    expect(Object.isFrozen(info)).toBe(true);
    expect(Object.isFrozen(info.events)).toBe(true);
    expect(Object.isFrozen(info.events[0]?.sources)).toBe(true);
  });

  it("keeps traditional festivals separate from ordinary lunar day text", () => {
    expect(getChineseLunarDay({ year: 2026, month: 9, day: 25 }, "zh-CN"))
      .toMatchObject({
        lunarMonth: 8,
        lunarDay: 15,
        festivals: ["中秋"],
        dateText: "十五",
        events: [{
          id: "festival:中秋节",
          kind: "festival",
          text: "中秋",
        }],
      });
  });

  it("keeps solar terms separate from ordinary lunar day text", () => {
    expect(getChineseLunarDay({ year: 2026, month: 4, day: 5 }, "zh-CN"))
      .toMatchObject({
        festivals: [],
        solarTerm: "清明",
        events: [{
          id: "solar-term:清明",
          kind: "solar-term",
          text: "清明",
        }],
      });
  });

  it("preserves leap-month identity and shows the month name on its first day", () => {
    expect(getChineseLunarDay({ year: 2025, month: 7, day: 25 }, "zh-CN"))
      .toMatchObject({
        lunarMonth: 6,
        lunarDay: 1,
        isLeapMonth: true,
        lunarMonthName: "闰六月",
        lunarDayName: "初一",
        dateText: "闰六月",
        events: [],
        transition: "month",
      });
  });

  it("uses the lunar day on an ordinary date", () => {
    expect(getChineseLunarDay({ year: 2026, month: 1, day: 1 }, "zh-CN"))
      .toMatchObject({
        lunarMonth: 11,
        lunarDay: 13,
        festivals: [],
        solarTerm: null,
        dateText: "十三",
        events: [],
        transition: null,
      });
  });

  it("keeps language calls isolated and stable ids independent of localized text", () => {
    I18n.setLanguage("en");
    const traditional = getChineseLunarDay(
      { year: 2026, month: 2, day: 17 },
      "zh-TW",
    );
    const english = getChineseLunarDay(
      { year: 2026, month: 2, day: 17 },
      "en-US",
    );

    expect(traditional).toMatchObject({
      festivals: ["春節"],
      events: [{ id: "festival:春节", text: "春節" }],
    });
    expect(english).toMatchObject({
      lunarMonthName: "Lunar month 1",
      lunarDayName: "day 1",
      dateText: "Lunar 1/1",
      festivals: ["Lunar New Year"],
      events: [{ id: "festival:春节", text: "Lunar New Year" }],
      accessibilityText: "Lunar month 1, day 1",
    });
    expect(I18n.getLanguage()).toBe("en");
  });

  it("uses compact numeric lunar dates and stable solar-term ids in English", () => {
    expect(getChineseLunarDay({ year: 2026, month: 7, day: 7 }, "en-US"))
      .toMatchObject({
        lunarMonth: 5,
        lunarDay: 23,
        lunarMonthName: "Lunar month 5",
        lunarDayName: "day 23",
        solarTerm: "Minor Heat",
        dateText: "Lunar 5/23",
        events: [{ id: "solar-term:小暑", text: "Minor Heat" }],
        accessibilityText: "Lunar month 5, day 23",
      });
    expect(getChineseLunarDay({ year: 2025, month: 7, day: 25 }, "en-US"))
      .toMatchObject({
        isLeapMonth: true,
        lunarMonthName: "Leap lunar month 6",
        dateText: "Lunar L6/1",
      });
  });
});
