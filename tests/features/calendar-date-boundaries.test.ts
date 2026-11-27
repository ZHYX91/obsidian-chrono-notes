import { Solar } from "lunar-typescript";
import { describe, expect, it, vi } from "vitest";

import { formatLocalDateKey } from "../../src/core/periodic/periodic-date";
import {
  CalendarDecorationCache,
  selectCalendarDecorations,
} from "../../src/features/calendar/calendar-decoration-cache";
import {
  selectCalendarExtensionDay,
  selectCalendarExtensionDays,
} from "../../src/features/calendar/calendar-extension-registry";
import { IcsEventIndex } from "../../src/features/calendar/ics-event-index";
import { selectMonthCalendar } from "../../src/features/calendar/month-calendar-query";
import { selectWeekCalendar } from "../../src/features/calendar/week-calendar-query";
import { createFirstInstallSettings } from "../../src/features/calendar/calendar-language-preferences";
import { createParsedNoteIndexSnapshot } from "../support/note-index-snapshot";

describe("calendar extension date boundaries", () => {
  it.each([false, true])(
    "keeps the complete Gregorian month and note data with default extensions (cached=%s)",
    (cached) => {
      const settings = createFirstInstallSettings("zh-CN");
      const notes = createParsedNoteIndexSnapshot({
        "Daily/1582-10-10.md": "Historical note\n- [ ] Read the source",
      }, 1);
      const ics = new IcsEventIndex({ read: async () => "" });
      const options = {
        locale: "zh-CN",
        weekStartDay: settings.weekStartDay,
        calendarExtensions: settings.calendarExtensions,
        holidayRegions: settings.holidayRegions,
        heatmap: null,
        daily: { enabled: true, pattern: "[Daily]/YYYY-MM-DD" },
        weekly: settings.periodicNotes.weekly,
        rangeNotes: settings.rangeNotes,
        ...(cached ? { decorationCache: new CalendarDecorationCache() } : {}),
      };

      const month = selectMonthCalendar(
        { year: 1582, month: 10 }, notes, ics.getSnapshot(), options,
      );
      const days = month.weeks.flatMap((week) => week.days)
        .filter((day) => day.inCurrentMonth);
      expect(days.map((day) => formatLocalDateKey(day.date))).toEqual(
        Array.from({ length: 31 }, (_, index) => `1582-10-${String(index + 1).padStart(2, "0")}`),
      );
      expect(days[9]).toMatchObject({
        date: { year: 1582, month: 10, day: 10 },
        notePath: "Daily/1582-10-10.md",
        noteState: "has-body",
        statistics: { taskTotal: 1 },
        calendarExtensions: [{ id: "chinese-lunar", accessibilityText: expect.stringContaining("九月十四") }],
      });
      expect(days.map((day) => day.calendarExtensions.map(({ id }) => id)))
        .toEqual(Array.from({ length: 31 }, () => ["chinese-lunar"]));

      const week = selectWeekCalendar(
        { year: 1582, month: 10, day: 10 }, notes, ics.getSnapshot(),
        { ...options, today: { year: 2026, month: 10, day: 23 } },
      );
      expect(week.days.find((day) => day.date.day === 10)).toMatchObject({
        notePath: "Daily/1582-10-10.md",
        noteState: "has-body",
        calendarExtensions: [{ id: "chinese-lunar", accessibilityText: expect.stringContaining("九月十四") }],
      });
    },
  );

  it.each([
    ["vietnamese-lunar", { year: 1975, month: 12, day: 31 }],
    ["korean-lunar", { year: 2051, month: 1, day: 1 }],
    ["japanese-lunisolar", { year: 2100, month: 1, day: 1 }],
    ["japanese-era", { year: 1872, month: 12, day: 31 }],
    ["french-republican", { year: 1806, month: 1, day: 1 }],
    ["indian-panchanga", { year: 2027, month: 3, day: 22 }],
  ] as const)("retains the other selected calendar beyond the %s coverage", (id, date) => {
    const selected = [id, "julian"] as const;
    expect(selectCalendarExtensionDay(date, "en", id)).toBeNull();
    const direct = selectCalendarDecorations(date, "en", selected, []);
    const cached = new CalendarDecorationCache().get(date, "en", selected, []);
    expect(cached).toEqual(direct);
    expect(direct.calendarExtensions.map((entry) => entry.id)).toEqual(["julian"]);
    expect(direct.calendarEvents).toEqual([]);
    expect(direct.regionalMarker).toBeNull();
  });

  it.each([false, true])("retains daily notes across the Panchanga edition boundary (cached=%s)", (cached) => {
    const settings = createFirstInstallSettings("hi");
    const date = { year: 2027, month: 3, day: 22 };
    const notes = createParsedNoteIndexSnapshot({ "Daily/2027-03-22.md": "A daily note" }, 1);
    const ics = new IcsEventIndex({ read: async () => "" });
    const options = {
      locale: "hi", weekStartDay: settings.weekStartDay, holidayRegions: [], heatmap: null,
      calendarExtensions: ["indian-panchanga", "indian"] as const,
      daily: { enabled: true, pattern: "[Daily]/YYYY-MM-DD" },
      weekly: settings.periodicNotes.weekly, rangeNotes: settings.rangeNotes,
      ...(cached ? { decorationCache: new CalendarDecorationCache() } : {}),
    };
    const month = selectMonthCalendar(date, notes, ics.getSnapshot(), options);
    const days = month.weeks.flatMap((week) => week.days).filter((day) => day.inCurrentMonth);
    expect(days[20]?.calendarExtensions.map(({ id }) => id)).toEqual(["indian-panchanga", "indian"]);
    const week = selectWeekCalendar(date, notes, ics.getSnapshot(), { ...options, today: date });
    for (const day of [days[21], week.days.find((entry) => entry.date.day === 22)]) {
      expect(day).toMatchObject({ date, notePath: "Daily/2027-03-22.md", noteState: "has-body" });
      expect(day?.calendarExtensions.map(({ id }) => id)).toEqual(["indian"]);
    }
  });

  it.each([
    { year: 1582, month: 10, day: 4 },
    { year: 1582, month: 10, day: 15 },
    { year: 2026, month: 2, day: 17 },
  ])("retains both lunar extensions on supported dates: %j", (date) => {
    const selected = ["chinese-lunar", "ganzhi"] as const;
    const direct = selectCalendarExtensionDays(date, "zh-CN", selected);
    const cached = new CalendarDecorationCache().get(date, "zh-CN", selected, []);
    expect(direct.map(({ id }) => id)).toEqual(selected);
    expect(cached.calendarExtensions).toEqual(direct);
  });

  it.each([
    [4, "九月初八", "癸亥", "1582年9月24日"],
    [5, "九月初九", "甲子", "1582年9月25日"],
    [6, "九月初十", "乙丑", "1582年9月26日"],
    [7, "九月十一", "丙寅", "1582年9月27日"],
    [8, "九月十二", "丁卯", "1582年9月28日"],
    [9, "九月十三", "戊辰", "1582年9月29日"],
    [10, "九月十四", "己巳", "1582年9月30日"],
    [11, "九月十五", "庚午", "1582年10月1日"],
    [12, "九月十六", "辛未", "1582年10月2日"],
    [13, "九月十七", "壬申", "1582年10月3日"],
    [14, "九月十八", "癸酉", "1582年10月4日"],
    [15, "九月十九", "甲戌", "1582年10月5日"],
  ] as const)("anchors lunar, Ganzhi and Julian to the same Gregorian day on October %i, 1582",
    (day, lunar, ganzhi, julian) => {
      const date = { year: 1582, month: 10, day };
      for (const id of ["chinese-lunar", "ganzhi"] as const) {
        const selected = [id, "julian"] as const;
        const direct = selectCalendarExtensionDays(date, "zh-CN", selected);
        expect(selectCalendarExtensionDay(date, "zh-CN", id)).toEqual(direct[0]);
        const cache = new CalendarDecorationCache();
        const cached = cache.get(date, "zh-CN", selected, []);
        expect(cached).toEqual(selectCalendarDecorations(date, "zh-CN", selected, []));
        expect(cached.calendarExtensions).toEqual(direct);
        expect(cache.get(date, "zh-CN", selected, [])).toBe(cached);
        expect(direct[0]?.accessibilityText).toContain(id === "chinese-lunar" ? lunar : ganzhi + "日");
        expect(direct[1]?.accessibilityText).toBe(julian);
      }
    });

  it("does not hide unexpected lunar conversion failures", () => {
    const failure = new Error("Unexpected lunar conversion failure");
    const convert = vi.spyOn(Solar, "fromYmd").mockImplementation(() => { throw failure; });
    try {
      const date = { year: 2026, month: 2, day: 17 };
      expect(() => selectCalendarExtensionDays(date, "en", ["chinese-lunar"]))
        .toThrow(failure);
      expect(() => new CalendarDecorationCache().get(date, "en", ["ganzhi"], []))
        .toThrow(failure);
    } finally {
      convert.mockRestore();
    }
  });
});
