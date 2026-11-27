import { describe, expect, it } from "vitest";

import { CalendarDecorationCache, selectCalendarDecorations } from "../../src/features/calendar/calendar-decoration-cache";
import { combineRegionalHolidayDays } from "../../src/features/calendar/holiday-region-registry";
import { formatCalendarPreviewRegional } from "../../src/ui/calendar/calendar-preview-presentation";
import type { MonthCalendarDay } from "../../src/features/calendar/month-calendar-query";
import { createTranslator } from "../../src/shared/i18n";
import {
  canPreviewCalendarDay,
  formatCalendarDayLabel,
  formatRegionalMarkerLabel,
} from "../../src/ui/calendar/calendar-day-presentation";
import { noteStatistics } from "../support/note-statistics";
import { noteEmbeds } from "../support/note-embeds";

function cell(overrides: Partial<MonthCalendarDay> = {}): MonthCalendarDay {
  return Object.freeze({
    date: { year: 2026, month: 7, day: 14 },
    inCurrentMonth: true,
    notePath: "Daily/2026-07-14.md",
    noteState: "has-body",
    preview: "Keep preview unchanged",
    embeds: noteEmbeds(),
    statistics: noteStatistics(),
    calendarExtensions: [],
    calendarEvents: [],
    holidays: [],
    regionalDays: [],
    workday: null,
    regionalMarker: null,
    icsEvents: [],
    heatmap: null,
    ...overrides,
  });
}

describe("calendar day presentation", () => {
  it("opens previews only when the shared day has useful indexed content", () => {
    expect(canPreviewCalendarDay(cell())).toBe(true);
    expect(
      canPreviewCalendarDay(
        cell({
          notePath: null,
          noteState: "not-configured",
          preview: null,
        }),
      ),
    ).toBe(false);
    expect(
      canPreviewCalendarDay(
        cell({
          notePath: null,
          noteState: "not-configured",
          preview: null,
          holidays: [{ region: "sg", name: "National Day" }],
        }),
      ),
    ).toBe(true);
    expect(
      canPreviewCalendarDay(
        cell({
          notePath: null,
          noteState: "not-configured",
          preview: null,
          calendarExtensions: [{
            id: "chinese-lunar",
            dateText: "Lunar 6/1",
            events: [],
            transition: "month",
            accessibilityText: "Lunar month 6, day 1",
          }],
        }),
      ),
    ).toBe(true);
  });

  it("combines localized labels while preserving source calendar text", () => {
    const t = createTranslator("en", "en").t;
    const value = cell({
      calendarExtensions: [
        {
          id: "chinese-lunar",
          dateText: "Lunar 6/1",
          events: [],
          transition: "month",
          accessibilityText: "Lunar month 6, day 1",
        },
      ],
      calendarEvents: [{
        id: "festival:初伏",
        kind: "festival",
        text: "First Fu",
        sources: [
          { id: "chinese-lunar", transitionTime: null },
          { id: "ganzhi", transitionTime: "09:56" },
        ],
      }],
      holidays: [{ region: "sg", name: "National Day" }],
      heatmap: { dimension: "word-count", value: 120, level: 2 },
      statistics: noteStatistics({
        taskCompleted: 1,
        taskTotal: 2,
        taskCompletionRate: 50,
      }),
    });

    const label = formatCalendarDayLabel(
      "2026-07-14",
      value,
      {
        includeCalendarExtensions: true,
      },
      t,
    );
    expect(label).toContain("Lunar month 6, day 1");
    expect(label).toContain(
      "First Fu; sources: Chinese lunar calendar, Ganzhi calendar (transition 09:56)",
    );
    expect(label).toContain("public holiday: National Day");
    expect(label).toContain("1/2 tasks complete");
    expect(
      formatCalendarDayLabel(
        "2026-07-14",
        value,
        {
          includeCalendarExtensions: false,
        },
        t,
      ),
    ).not.toContain("六月初一");
  });

  it("keeps indexed error details adjacent to the translated state", () => {
    const t = createTranslator("en", "en").t;
    const value = cell({
      noteState: "error",
      errorMessage: "permission denied",
      statistics: noteStatistics({ taskTotal: 1 }),
    });

    expect(
      formatCalendarDayLabel(
        "2026-07-14",
        value,
        {
          includeCalendarExtensions: true,
        },
        t,
      ),
    ).toBe("2026-07-14, note read error: permission denied, 0/1 task complete");
  });

  it("keeps work, rest and employer choices in the accessible and preview text", () => {
    const t = createTranslator("en", "en").t;
    const cache = new CalendarDecorationCache();
    const cases = [
      {
        date: { year: 2026, month: 2, day: 28 },
        regions: ["cn", "tw"] as const,
        expected: ["Mainland China · adjusted workday: Spring Festival", "Taiwan (government offices) · public holiday: Peace Memorial Day"],
        marker: { region: "cn", kind: "work" },
      },
      {
        date: { year: 2027, month: 3, day: 26 },
        regions: ["ca-qc", "de"] as const,
        expected: ["Québec · Possible holiday: Good Friday (employer chooses Good Friday or Easter Monday)", "Germany (nationwide) · public holiday: Good Friday"],
        marker: { region: "de", kind: "holiday" },
      },
    ];
    for (const { date, regions, expected, marker } of cases) {
      const direct = selectCalendarDecorations(date, "en", [], regions);
      const cached = cache.get(date, "en", [], regions);
      expect(cached).toEqual(direct);
      for (const decorations of [direct, cached]) {
        const day = cell({ ...decorations, date });
        expect(day.regionalMarker).toEqual(marker);
        const label = formatCalendarDayLabel("date", day, { includeCalendarExtensions: false }, t);
        const preview = formatCalendarPreviewRegional(day, t);
        for (const text of expected) {
          expect(label).toContain(text);
          expect(preview?.toLowerCase()).toContain(text.toLowerCase());
        }
      }
    }
  });

  it("names both regions when two working Saturdays share the same description", () => {
    const t = createTranslator("en", "en").t;
    const combined = combineRegionalHolidayDays([
      { region: "ru", holidays: [], workday: { region: "ru", name: "Working Saturday", isWorkday: true } },
      { region: "vn", holidays: [], workday: { region: "vn", name: "Working Saturday", isWorkday: true } },
    ]);
    const day = cell({ ...combined, regionalMarker: combined.marker });
    const preview = formatCalendarPreviewRegional(day, t);
    const label = formatCalendarDayLabel("date", day, { includeCalendarExtensions: false }, t);
    for (const region of ["Russia", "Vietnam (public sector)"]) {
      expect(preview).toContain(`${region} · Adjusted workday: Working Saturday`);
      expect(label).toContain(`${region} · adjusted workday: Working Saturday`);
    }
  });

  it.each([[7, "巴西（全国）"], [16, "墨西哥（联邦）"]] as const)(
    "identifies the source of Independence Day on September %i with Brazil and Mexico enabled",
    (dayOfMonth, region) => {
      const date = { year: 2026, month: 9, day: dayOfMonth };
      const day = cell(selectCalendarDecorations(date, "zh-CN", [], ["br", "mx"]));
      const t = createTranslator("zh-CN", "en").t;
      const detail = `${region} · 公共假日：独立日`;
      expect(formatCalendarPreviewRegional(day, t)).toBe(detail);
      expect(formatCalendarDayLabel("date", day, { includeCalendarExtensions: true }, t)).toContain(detail);
    },
  );

  it("formats Traditional Chinese adjusted workdays", () => {
    const t = createTranslator("zh-TW", "en").t;

    expect(
      formatCalendarDayLabel(
        "2026-07-14",
        cell({
          noteState: "missing",
          workday: {
            region: "cn",
            name: "Spring Festival shift",
            isWorkday: true,
          },
          heatmap: { dimension: "task-completion-rate", value: 75, level: 3 },
        }),
        {
          includeCalendarExtensions: true,
        },
        t,
      ),
    ).toBe(
      "2026-07-14，調休工作日：Spring Festival shift，任務完成率：75%，熱力圖等級 3/4，筆記不存在",
    );
  });

  it("localizes semantic regional markers with the resolved plugin language", () => {
    expect(
      formatRegionalMarkerLabel("work", createTranslator("zh-CN", "en").t),
    ).toBe("班");
    expect(
      formatRegionalMarkerLabel("rest", createTranslator("zh-TW", "en").t),
    ).toBe("休");
    expect(
      formatRegionalMarkerLabel("holiday", createTranslator("zh-CN", "en").t),
    ).toBe("公假");
    expect(
      formatRegionalMarkerLabel("holiday", createTranslator("en", "zh-CN").t),
    ).toBe("PH");
  });
});
