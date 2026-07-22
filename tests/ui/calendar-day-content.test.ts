import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { IcsEventOccurrence } from "../../src/core/calendar/ics-calendar";
import type { CalendarDay } from "../../src/features/calendar/calendar-day-query";
import { createTranslator } from "../../src/shared/i18n";
import {
  CalendarDayCalendarDetails,
  CalendarDayEvents,
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
  });
});

function emptyDay(): CalendarDay {
  return Object.freeze({
    date: { year: 2026, month: 7, day: 19 },
    notePath: null,
    noteState: "not-configured",
    preview: null,
    statistics: noteStatistics(),
    calendarOverlays: [],
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
