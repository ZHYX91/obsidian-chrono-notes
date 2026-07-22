import { describe, expect, it } from "vitest";

import { CalendarDecorationCache } from "../../src/features/calendar/calendar-decoration-cache";

describe("CalendarDecorationCache", () => {
  it("reuses frozen decorations for a canonical locale and ordered settings", () => {
    const cache = new CalendarDecorationCache(8);
    const date = { year: 2026, month: 2, day: 17 } as const;

    const first = cache.get(
      date,
      "zh-cn",
      ["chinese-lunar", "ganzhi"],
      ["cn", "sg"],
    );
    const second = cache.get(
      date,
      "zh-CN",
      ["chinese-lunar", "ganzhi"],
      ["cn", "sg"],
    );

    expect(second).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.calendarOverlays)).toBe(true);
    expect(Object.isFrozen(first.holidays)).toBe(true);
    expect(cache.size).toBe(1);
  });

  it("keeps overlay and region order in the cache identity", () => {
    const cache = new CalendarDecorationCache(8);
    const date = { year: 2026, month: 2, day: 17 } as const;

    const original = cache.get(
      date,
      "zh-CN",
      ["chinese-lunar", "ganzhi"],
      ["cn", "sg"],
    );
    const reversedOverlays = cache.get(
      date,
      "zh-CN",
      ["ganzhi", "chinese-lunar"],
      ["cn", "sg"],
    );
    const reversedRegions = cache.get(
      date,
      "zh-CN",
      ["chinese-lunar", "ganzhi"],
      ["sg", "cn"],
    );

    expect(reversedOverlays).not.toBe(original);
    expect(reversedRegions).not.toBe(original);
    expect(cache.size).toBe(3);
  });

  it("reuses provider-level results across different overlay and region selections", () => {
    const cache = new CalendarDecorationCache(8);
    const date = { year: 2026, month: 2, day: 17 } as const;

    const combined = cache.get(
      date,
      "zh-CN",
      ["chinese-lunar", "ganzhi"],
      ["cn", "sg"],
    );
    const subsets = cache.get(date, "zh-CN", ["ganzhi"], ["cn"]);

    expect(subsets.calendarOverlays[0]).toBe(combined.calendarOverlays[1]);
    expect(subsets.holidays[0]).toBe(combined.holidays[0]);
    expect(cache.size).toBe(2);
  });

  it("keeps localized provider results in separate cache entries", () => {
    const cache = new CalendarDecorationCache(8);
    const date = { year: 2026, month: 2, day: 17 } as const;

    const chinese = cache.get(date, "zh-CN", ["chinese-lunar"], ["cn"]);
    const english = cache.get(date, "en", ["chinese-lunar"], ["cn"]);

    expect(english).not.toBe(chinese);
    expect(english.calendarOverlays[0]?.accessibilityText).not.toBe(
      chinese.calendarOverlays[0]?.accessibilityText,
    );
    expect(cache.size).toBe(2);
  });

  it("evicts least-recently-used entries and releases all entries on clear", () => {
    const cache = new CalendarDecorationCache(2);
    const empty = [] as const;
    const firstDate = { year: 2026, month: 7, day: 1 } as const;
    const secondDate = { year: 2026, month: 7, day: 2 } as const;
    const thirdDate = { year: 2026, month: 7, day: 3 } as const;

    const first = cache.get(firstDate, "en", empty, empty);
    const second = cache.get(secondDate, "en", empty, empty);
    expect(cache.get(firstDate, "en", empty, empty)).toBe(first);
    cache.get(thirdDate, "en", empty, empty);

    expect(cache.size).toBe(2);
    expect(cache.get(secondDate, "en", empty, empty)).not.toBe(second);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it("rejects invalid capacities", () => {
    expect(() => new CalendarDecorationCache(0)).toThrow(RangeError);
    expect(() => new CalendarDecorationCache(1.5)).toThrow(RangeError);
  });
});
