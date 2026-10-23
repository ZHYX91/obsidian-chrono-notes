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
import { createDefaultSettings } from "../../src/shared/settings";
import { createParsedNoteIndexSnapshot } from "../support/note-index-snapshot";

describe("calendar extension date boundaries", () => {
  it.each([false, true])(
    "keeps the complete Gregorian month and note data with default extensions (cached=%s)",
    (cached) => {
      const settings = createDefaultSettings();
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
        calendarExtensions: [],
        calendarEvents: [],
      });
      expect(days[3]?.calendarExtensions.map(({ id }) => id)).toEqual(["chinese-lunar"]);
      expect(days[14]?.calendarExtensions.map(({ id }) => id)).toEqual(["chinese-lunar"]);

      const week = selectWeekCalendar(
        { year: 1582, month: 10, day: 10 }, notes, ics.getSnapshot(),
        { ...options, today: { year: 2026, month: 10, day: 23 } },
      );
      expect(week.days.find((day) => day.date.day === 10)).toMatchObject({
        notePath: "Daily/1582-10-10.md",
        noteState: "has-body",
        calendarExtensions: [],
      });
    },
  );

  it.each(["chinese-lunar", "ganzhi"] as const)(
    "omits only %s on every unsupported date and retains the other extension",
    (extension) => {
      const cache = new CalendarDecorationCache();
      for (let day = 5; day <= 14; day += 1) {
        const date = { year: 1582, month: 10, day };
        const expected = selectCalendarExtensionDays(date, "en", ["persian"]);
        expect(selectCalendarExtensionDay(date, "en", extension)).toBeNull();
        expect(selectCalendarExtensionDays(date, "en", [extension, "persian"]))
          .toEqual(expected);
        const direct = selectCalendarDecorations(date, "en", [extension, "persian"], []);
        const cached = cache.get(date, "en", [extension, "persian"], []);
        expect(cached).toEqual(direct);
        expect(cached.calendarExtensions).toEqual(expected);
        expect(cache.get(date, "en", [extension, "persian"], [])).toBe(cached);
      }
    },
  );

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
