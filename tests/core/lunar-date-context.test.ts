import { describe, expect, it } from "vitest";

import {
  getChineseLunarDay,
  getChineseLunarDayFromContext,
} from "../../src/core/calendar/chinese-lunar";
import {
  getGanzhiDay,
  getGanzhiDayFromContext,
} from "../../src/core/calendar/ganzhi";
import { createLunarDateContext } from "../../src/core/calendar/lunar-date-context";

describe("LunarDateContext", () => {
  it("shares one conversion across overlays without coupling locale state", () => {
    const date = { year: 2026, month: 2, day: 4 } as const;
    const context = createLunarDateContext(date);

    const englishGanzhi = getGanzhiDayFromContext(context, "en-US");
    const traditionalLunar = getChineseLunarDayFromContext(context, "zh-TW");
    const chineseGanzhi = getGanzhiDayFromContext(context, "zh-CN");
    const englishLunar = getChineseLunarDayFromContext(context, "en-US");

    expect(englishGanzhi).toEqual(getGanzhiDay(date, "en-US"));
    expect(traditionalLunar).toEqual(getChineseLunarDay(date, "zh-TW"));
    expect(chineseGanzhi).toEqual(getGanzhiDay(date, "zh-CN"));
    expect(englishLunar).toEqual(getChineseLunarDay(date, "en-US"));
    expect(Object.isFrozen(context)).toBe(true);
  });
});
