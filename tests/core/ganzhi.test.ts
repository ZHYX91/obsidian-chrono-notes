import { describe, expect, it } from "vitest";

import { getGanzhiDay } from "../../src/core/calendar/ganzhi";

describe("getGanzhiDay", () => {
  it("returns an ordinary day pillar without unrelated almanac content", () => {
    expect(getGanzhiDay({ year: 2026, month: 2, day: 3 }, "zh-CN")).toEqual({
      yearPillar: "乙巳",
      monthPillar: "己丑",
      dayPillar: "戊申",
      solarTerm: null,
      solarTermTime: null,
      dateText: "戊申",
      eventText: null,
      eventKind: null,
      transition: null,
      accessibilityText: "乙巳年，己丑月，戊申日",
    });
  });

  it("marks the civil date containing Start of Spring as a year and month transition", () => {
    expect(getGanzhiDay({ year: 2026, month: 2, day: 4 }, "zh-CN")).toMatchObject({
      yearPillar: "丙午",
      monthPillar: "庚寅",
      dayPillar: "己酉",
      solarTerm: "立春",
      solarTermTime: "04:02",
      dateText: "庚寅月",
      eventText: "立春",
      eventKind: "solar-term",
      transition: "year-month",
      accessibilityText: "丙午年，庚寅月，己酉日，立春 04:02",
    });
  });

  it("marks each later jie as a month transition", () => {
    expect(getGanzhiDay({ year: 2026, month: 3, day: 5 }, "zh-CN")).toMatchObject({
      yearPillar: "丙午",
      monthPillar: "辛卯",
      dayPillar: "戊寅",
      solarTerm: "惊蛰",
      solarTermTime: "21:59",
      dateText: "辛卯月",
      transition: "month",
    });
  });

  it("freezes results and restores lunar library language", () => {
    const value = getGanzhiDay({ year: 2026, month: 7, day: 7 }, "en-US");
    expect(Object.isFrozen(value)).toBe(true);
    expect(value.monthPillar).toBe("乙未");
  });
});
