import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { IcsEventIndex } from "../../src/features/calendar/ics-event-index";
import { selectMonthCalendar } from "../../src/features/calendar/month-calendar-query";
import { createDefaultSettings } from "../../src/shared/settings";
import { createTranslator } from "../../src/shared/i18n";
import { MonthSelectedDayDetails } from "../../src/ui/calendar/month-selected-day-details";
import { formatCalendarDayLabel } from "../../src/ui/calendar/calendar-day-presentation";
import { createParsedNoteIndexSnapshot } from "../support/note-index-snapshot";

it("keeps every selected-day event and its source readable without hover or truncation", async () => {
  const ics = new IcsEventIndex({ read: async () => [
    "BEGIN:VCALENDAR", "VERSION:2.0",
    ...["First", "Second", "Third", "Fourth"].flatMap((title) => [
      "BEGIN:VEVENT", `UID:${title}`, "DTSTART;VALUE=DATE:20261020", `SUMMARY:${title}`, "END:VEVENT",
    ]), "END:VCALENDAR", "",
  ].join("\r\n") });
  await ics.refresh({ enabled: true, sources: ["Calendars/example.ics"], displayZone: "UTC" });
  const settings = createDefaultSettings();
  const query = selectMonthCalendar({ year: 2026, month: 10 }, createParsedNoteIndexSnapshot({
    "Daily/2026-10-20.md": "- [x] Done\n- [ ] Pending",
  }, 1), ics.getSnapshot(), {
    locale: "en-US", weekStartDay: "monday", calendarExtensions: [], holidayRegions: [], heatmap: null,
    daily: { enabled: true, pattern: "[Daily]/YYYY-MM-DD" }, weekly: settings.periodicNotes.weekly,
    rangeNotes: settings.rangeNotes,
  });
  const day = query.weeks.flatMap((week) => week.days).find((day) => day.date.day === 20)!;
  const html = renderToStaticMarkup(createElement(MonthSelectedDayDetails, { day, translator: createTranslator("en", "en-US") }));
  expect(html).toContain("Selected day · 2026-10-20");
  for (const title of ["First", "Second", "Third", "Fourth"]) expect(html).toContain(title);
  expect(html.match(/example\.ics/g)).toHaveLength(4);
  expect(html).toContain("1/2");
});

it("identifies the two lunisolar dates in slot order in selected details and day labels", () => {
  const settings = createDefaultSettings();
  const translator = createTranslator("zh-CN", "en");
  const query = selectMonthCalendar({ year: 2027, month: 2 }, createParsedNoteIndexSnapshot({}, 1),
    new IcsEventIndex({ read: async () => "" }).getSnapshot(), {
      locale: translator.locale, weekStartDay: "monday", calendarExtensions: ["korean-lunar", "vietnamese-lunar"],
      holidayRegions: [], heatmap: null, daily: settings.periodicNotes.daily, weekly: settings.periodicNotes.weekly,
      rangeNotes: settings.rangeNotes,
    });
  const day = query.weeks.flatMap((week) => week.days).find((cell) => cell.date.month === 2 && cell.date.day === 7)!;
  const korean = "韩国农历 · 2027年1月1日";
  const vietnamese = "越南农历 · 2027年1月2日";
  const html = renderToStaticMarkup(createElement(MonthSelectedDayDetails, { day, translator }));
  expect(html).toContain(`<p>${korean}</p><p>${vietnamese}</p>`);
  expect(formatCalendarDayLabel("2027-02-07", day, { includeCalendarExtensions: true }, translator.t))
    .toContain(`${korean}，${vietnamese}`);
});
