import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { IcsEventOccurrence } from "../../src/core/calendar/ics-calendar";
import type { CalendarDay } from "../../src/features/calendar/calendar-day-query";
import { createTranslator } from "../../src/shared/i18n";
import {
  CalendarDayCalendarDetails,
  CalendarDayEvents,
  CalendarDayStatusRow,
} from "../../src/ui/calendar/calendar-day-content";
import { noteStatistics } from "../support/note-statistics";

describe("calendar day content", () => {
  it("renders no holiday or ICS rows when both collections are empty", () => {
    const translator = createTranslator("en", "en");
    const details = renderToStaticMarkup(
      createElement(CalendarDayCalendarDetails, {
        day: emptyDay(),
        translator,
      }),
    );
    const events = renderToStaticMarkup(
      createElement(CalendarDayEvents, {
        events: [],
        translator,
      }),
    );

    expect(details).toBe("");
    expect(events).toBe("");
  });

  it("reserves overflow space at medium density without inventing wide overflow", () => {
    const events = Object.freeze([occurrence("first"), occurrence("second")]);
    const markup = renderToStaticMarkup(
      createElement(CalendarDayEvents, {
        events,
        translator: createTranslator("en", "en"),
        responsive: true,
      }),
    );

    expect(markup).toContain('data-has-overflow="true"');
    expect(markup).toContain('data-wide-overflow="false"');
    expect(markup).toContain("chrono-notes-ics-more is-medium");
    expect(markup).not.toContain("chrono-notes-ics-more is-wide");
    expect(markup).not.toContain("title=");
  });

  it("exposes status layout state without relational CSS selectors", () => {
    const day = {
      ...emptyDay(),
      noteState: "has-body" as const,
      regionalMarker: { kind: "work" as const, region: "cn" as const },
    };
    const markup = renderToStaticMarkup(createElement(CalendarDayStatusRow, {
      day,
      showNoteIndicators: true,
      showTaskProgress: true,
      translator: createTranslator("en", "en"),
    }));

    expect(markup).toContain('data-has-note-indicator="true"');
    expect(markup).toContain('data-has-regional-marker="true"');
    expect(markup).toContain('class="chrono-notes-day-accessories"');
    expect(markup).toContain('dir="ltr"');
    expect(markup).toContain('class="chrono-notes-regional-marker" aria-hidden="true" dir="ltr"');
  });

  it("keeps physical status slots left-to-right while regional text follows RTL", () => {
    const day = {
      ...emptyDay(),
      noteState: "has-body" as const,
      regionalMarker: { kind: "rest" as const, region: "cn" as const },
    };
    const markup = renderToStaticMarkup(createElement(CalendarDayStatusRow, {
      day,
      showNoteIndicators: true,
      showTaskProgress: true,
      translator: createTranslator("ar", "ar"),
    }));

    expect(markup).toContain(
      'class="chrono-notes-day-accessories" data-has-note-indicator="true" data-has-regional-marker="true" dir="ltr"',
    );
    expect(markup).toContain(
      'class="chrono-notes-regional-marker" aria-hidden="true" dir="rtl"',
    );
  });

  it("renders deduplicated events after all calendar dates without native titles", () => {
    const day: CalendarDay = Object.freeze({
      ...emptyDay(),
      calendarExtensions: Object.freeze([
        Object.freeze({
          id: "chinese-lunar",
          dateText: "廿三",
          events: Object.freeze([]),
          transition: null,
          accessibilityText: "六月廿三",
        }),
        Object.freeze({
          id: "ganzhi",
          dateText: "戊戌",
          events: Object.freeze([]),
          transition: null,
          accessibilityText: "丙午年，乙未月，戊戌日",
        }),
      ]),
      calendarEvents: Object.freeze([
        Object.freeze({
          id: "solar-term:大暑",
          kind: "solar-term",
          text: "大暑",
          sources: Object.freeze([
            Object.freeze({
              id: "chinese-lunar",
              transitionTime: null,
            }),
          ]),
        }),
      ]),
    });
    const markup = renderToStaticMarkup(
      createElement(CalendarDayCalendarDetails, {
        day,
        translator: createTranslator("zh-CN", "en"),
      }),
    );

    expect(markup.match(/data-calendar-extension-id=/gu)).toHaveLength(2);
    expect(markup.match(/>大暑</gu)).toHaveLength(1);
    expect(markup.indexOf("data-calendar-extension-id=\"ganzhi\""))
      .toBeLessThan(markup.indexOf("chrono-notes-calendar-extension-events"));
    expect(markup).not.toContain("title=");
  });
});

function emptyDay(): CalendarDay {
  return Object.freeze({
    date: { year: 2026, month: 7, day: 19 },
    notePath: null,
    noteState: "not-configured",
    preview: null,
    statistics: noteStatistics(),
    calendarExtensions: [],
    calendarEvents: [],
    holidays: [],
    workday: null,
    regionalMarker: null,
    icsEvents: [],
    heatmap: null,
  });
}

function occurrence(id: string): IcsEventOccurrence {
  return Object.freeze({
    id,
    title: id,
    source: "team.ics",
    sourceLabel: "Team",
    isAllDay: true,
    startsOnDate: true,
    endsOnDate: true,
    continuesBefore: false,
    continuesAfter: false,
    timeLabel: null,
    sortTimestamp: 0,
  });
}
