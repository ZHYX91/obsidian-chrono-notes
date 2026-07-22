import { Window } from "happy-dom";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { LocalDate } from "../../src/core/periodic/periodic-date";
import {
  selectMonthCalendar,
  type MonthCalendarQuery,
} from "../../src/features/calendar/month-calendar-query";
import type { IcsEventIndexSnapshot } from "../../src/features/calendar/ics-event-index";
import { selectYearCalendar } from "../../src/features/calendar/year-calendar-query";
import type { NoteIndexSnapshot } from "../../src/features/notes/note-index";
import { createTranslator } from "../../src/shared/i18n";
import type { RangeNoteSettings } from "../../src/shared/settings";
import { LongPressGesture } from "../../src/ui/calendar/long-press";
import { MonthDayCell } from "../../src/ui/calendar/month-day-cell";
import {
  YearView,
  type CalendarSelectionKind,
} from "../../src/ui/calendar/year-view";
import {
  createNoteIndexSnapshot,
  createParsedNoteIndexSnapshot,
} from "../support/note-index-snapshot";

const EMPTY_NOTES: NoteIndexSnapshot = createNoteIndexSnapshot({}, 1);

const DISABLED_ICS: IcsEventIndexSnapshot = Object.freeze({
  version: 0,
  contentVersion: 0,
  state: "disabled",
  enabled: false,
  totalSources: 0,
  loadedSources: 0,
  eventCount: 0,
  skippedRecurring: 0,
  skippedInvalid: 0,
  truncatedEvents: 0,
  refreshedAt: null,
  sourceStatuses: Object.freeze([]),
  errors: Object.freeze([]),
  eventsByDate: Object.freeze({}),
});

const RANGE_NOTES: RangeNoteSettings = Object.freeze({
  showInCalendar: false,
  folder: "",
  scanScope: "range-folder",
  customFolder: "",
  monthViewLimit: 2,
  weekViewLimit: 5,
});

const QUERY = selectYearCalendar(2026, EMPTY_NOTES, {
  locale: "en",
  weekStartDay: "monday",
  statisticDisplayDimension: "word-count",
  statisticValueStep: 500,
  daily: { enabled: false, pattern: "" },
  monthly: { enabled: false, pattern: "" },
  quarterly: { enabled: false, pattern: "" },
});

const HEATMAP_QUERY = selectYearCalendar(
  2026,
  createParsedNoteIndexSnapshot({
    "Daily/2026-04-18.md": "one two three four five",
  }, 2),
  {
    locale: "en",
    weekStartDay: "monday",
    statisticDisplayDimension: "word-count",
    statisticValueStep: 2,
    daily: { enabled: true, pattern: "'Daily'/yyyy-MM-dd" },
    monthly: { enabled: false, pattern: "" },
    quarterly: { enabled: false, pattern: "" },
  },
);

const APRIL_18: LocalDate = Object.freeze({
  year: 2026,
  month: 4,
  day: 18,
});

const MONTH_QUERY = selectMonthCalendar(
  { year: 2026, month: 4 },
  EMPTY_NOTES,
  DISABLED_ICS,
  {
    locale: "en",
    weekStartDay: "monday",
    calendarOverlays: [],
    holidayRegions: [],
    heatmap: null,
    daily: { enabled: false, pattern: "" },
    weekly: { enabled: false, pattern: "" },
    rangeNotes: RANGE_NOTES,
  },
);

const HEATMAP_MONTH_QUERY = selectMonthCalendar(
  { year: 2026, month: 4 },
  createParsedNoteIndexSnapshot({
    "Daily/2026-04-18.md": "one two three four five",
  }, 2),
  DISABLED_ICS,
  {
    locale: "en",
    weekStartDay: "monday",
    calendarOverlays: [],
    holidayRegions: [],
    heatmap: { dimension: "word-count", valueStep: 2 },
    daily: { enabled: true, pattern: "'Daily'/yyyy-MM-dd" },
    weekly: { enabled: false, pattern: "" },
    rangeNotes: RANGE_NOTES,
  },
);

const APRIL_18_CELL = getApril18Cell(MONTH_QUERY);
const APRIL_18_HEATMAP_CELL = getApril18Cell(HEATMAP_MONTH_QUERY);

describe("calendar current-period layout", () => {
  it("keeps current and selected as independent month-day states", () => {
    const ordinary = renderMonthDay({ year: 2026, month: 4, day: 17 }, false, false);
    const current = renderMonthDay(APRIL_18, false, false);
    const selected = renderMonthDay({ year: 2026, month: 4, day: 17 }, true, false);
    const currentSelected = renderMonthDay(APRIL_18, true, false);

    expect(ordinary.classList.contains("is-current-period")).toBe(false);
    expect(ordinary.classList.contains("is-selected")).toBe(false);
    expect(ordinary.getAttribute("aria-current")).toBeNull();
    expect(ordinary.getAttribute("aria-selected")).toBe("false");
    expect(current.classList.contains("is-current-period")).toBe(true);
    expect(current.getAttribute("aria-current")).toBe("date");
    expect(current.classList.contains("is-selected")).toBe(false);
    expect(current.getAttribute("aria-selected")).toBe("false");
    expect(selected.classList.contains("is-current-period")).toBe(false);
    expect(selected.classList.contains("is-selected")).toBe(true);
    expect(selected.getAttribute("aria-current")).toBeNull();
    expect(selected.getAttribute("aria-selected")).toBe("true");
    expect(currentSelected.classList.contains("is-current-period")).toBe(true);
    expect(currentSelected.classList.contains("is-selected")).toBe(true);
    expect(currentSelected.getAttribute("aria-current")).toBe("date");
    expect(currentSelected.getAttribute("aria-selected")).toBe("true");
  });

  it("keeps all four month heatmap day states independent at a nonzero level", () => {
    const ordinary = renderMonthDay(
      { year: 2026, month: 4, day: 17 },
      false,
      true,
    );
    const current = renderMonthDay(APRIL_18, false, true);
    const selected = renderMonthDay(
      { year: 2026, month: 4, day: 17 },
      true,
      true,
    );
    const currentSelected = renderMonthDay(APRIL_18, true, true);

    expect(ordinary.classList.contains("is-heatmap")).toBe(true);
    expectHeatmapDayState(ordinary, false, false);
    expectHeatmapDayState(current, true, false);
    expectHeatmapDayState(selected, false, true);
    expectHeatmapDayState(currentSelected, true, true);
  });

  it("marks exactly the current quarter and month without replacing selection", () => {
    const document = renderYear(false, APRIL_18, "month", APRIL_18);
    const currentPeriods = document.querySelectorAll(
      '.chrono-notes-year-period[aria-current="true"]',
    );
    const selectedMonth = document.querySelector(
      '.chrono-notes-year-period[aria-pressed="true"]',
    );

    expect(currentPeriods).toHaveLength(2);
    expect(Array.from(currentPeriods).every((period) =>
      period.classList.contains("is-current-period"))).toBe(true);
    expect(Array.from(currentPeriods, (period) =>
      period.getAttribute("data-period-kind"))).toEqual(["quarter", "month"]);
    expect(selectedMonth?.classList.contains("is-selected")).toBe(true);
    expect(selectedMonth?.classList.contains("is-current-period")).toBe(true);
  });

  it("keeps the current quarter marker when that quarter is selected", () => {
    const document = renderYear(false, APRIL_18, "quarter", APRIL_18);
    const selectedQuarter = document.querySelector(
      '.chrono-notes-year-period[data-period-kind="quarter"][aria-pressed="true"]',
    );
    const currentMonth = document.querySelector(
      '.chrono-notes-year-period[data-period-kind="month"][aria-current="true"]',
    );

    expect(selectedQuarter?.classList.contains("is-current-period")).toBe(true);
    expect(selectedQuarter?.classList.contains("is-selected")).toBe(true);
    expect(selectedQuarter?.getAttribute("aria-current")).toBe("true");
    expect(currentMonth?.classList.contains("is-selected")).toBe(false);
  });

  it("does not mark periods when the displayed year is not current", () => {
    const document = renderYear(
      false,
      { year: 2027, month: 4, day: 18 },
      "month",
      APRIL_18,
    );

    expect(document.querySelector(".chrono-notes-year-period.is-current-period"))
      .toBeNull();
    expect(document.querySelector('[aria-current="true"]')).toBeNull();
    const selectedMonth = document.querySelector(
      '.chrono-notes-year-period[aria-pressed="true"]',
    );
    expect(selectedMonth?.classList.contains("is-selected")).toBe(true);
    expect(selectedMonth?.classList.contains("is-current-period")).toBe(false);
    expect(selectedMonth?.hasAttribute("aria-current")).toBe(false);
  });

  it("keeps heatmap data backgrounds while today and selection coexist", () => {
    const document = renderYear(true, APRIL_18, "day", APRIL_18);
    const currentPeriods = document.querySelectorAll(
      '.chrono-notes-year-period[aria-current="true"]',
    );
    const today = document.querySelector(
      '.chrono-notes-year-heatmap-day[aria-current="date"]',
    );

    expect(currentPeriods).toHaveLength(2);
    expect(today?.classList.contains("is-current-period")).toBe(true);
    expect(today?.classList.contains("is-selected")).toBe(true);
    expect(today?.getAttribute("aria-selected")).toBe("true");
    expect(today?.getAttribute("data-heatmap-level")).toBe("3");
  });

  it("keeps all four year heatmap day states independent at a nonzero level", () => {
    const ordinary = getYearDay(renderYear(
      true,
      { year: 2026, month: 4, day: 17 },
      "day",
      { year: 2026, month: 4, day: 16 },
    ));
    const current = getYearDay(renderYear(
      true,
      APRIL_18,
      "day",
      { year: 2026, month: 4, day: 17 },
    ));
    const selected = getYearDay(renderYear(
      true,
      { year: 2026, month: 4, day: 17 },
      "day",
      APRIL_18,
    ));
    const currentSelected = getYearDay(renderYear(
      true,
      APRIL_18,
      "day",
      APRIL_18,
    ));

    expectHeatmapDayState(ordinary, false, false);
    expectHeatmapDayState(current, true, false);
    expectHeatmapDayState(selected, false, true);
    expectHeatmapDayState(currentSelected, true, true);
  });
});

function renderMonthDay(today: LocalDate, selected: boolean, heatmapEnabled: boolean) {
  const markup = renderToStaticMarkup(createElement(MonthDayCell, {
    cell: heatmapEnabled ? APRIL_18_HEATMAP_CELL : APRIL_18_CELL,
    translator: createTranslator("en", "en"),
    today,
    selected,
    tabStop: selected,
    heatmapEnabled,
    showHoverPreview: false,
    showNoteIndicators: true,
    taskAnnotationMode: "hole",
    rangePreview: null,
    activePreviewKey: null,
    previewId: "calendar-day-preview",
    longPress: new LongPressGesture({
      setTimeout: () => 1,
      clearTimeout: () => undefined,
    }),
    onSetButtonRef: () => undefined,
    onClick: () => undefined,
    onKeyDown: () => undefined,
    onOpenPeriodic: () => undefined,
    onMouseDown: () => undefined,
    onMouseEnter: () => undefined,
    onFocus: () => undefined,
    onMouseUp: () => undefined,
    onDismissPreview: () => undefined,
    onTouchPreviewStart: () => undefined,
    onContextMenu: () => undefined,
  }));
  const window = new Window();
  window.document.body.innerHTML = markup;
  const button = window.document.querySelector(".chrono-notes-day");
  if (!(button instanceof window.HTMLElement)) {
    throw new Error("Expected the rendered month day button");
  }
  return button;
}

function getApril18Cell(query: MonthCalendarQuery) {
  const cell = query.weeks
    .flatMap((week) => week.days)
    .find((day) => day.date.day === 18 && day.inCurrentMonth);
  if (cell === undefined) {
    throw new Error("Expected April 18 in the month calendar query");
  }
  return cell;
}

function getYearDay(document: ReturnType<typeof renderYear>) {
  const day = document.querySelector(
    '.chrono-notes-year-heatmap-day[aria-label^="2026-04-18"]',
  );
  if (day === null) {
    throw new Error("Expected April 18 in the year heatmap");
  }
  return day;
}

function expectHeatmapDayState(
  day: Readonly<{
    classList: Readonly<{ contains(token: string): boolean }>;
    getAttribute(name: string): string | null;
  }>,
  current: boolean,
  selected: boolean,
): void {
  expect(day.classList.contains("is-current-period")).toBe(current);
  expect(day.classList.contains("is-selected")).toBe(selected);
  expect(day.getAttribute("aria-current")).toBe(current ? "date" : null);
  expect(day.getAttribute("aria-selected")).toBe(String(selected));
  expect(day.getAttribute("data-heatmap-level")).toBe("3");
}

function renderYear(
  heatmap: boolean,
  today: LocalDate,
  selectionKind: CalendarSelectionKind,
  selectionDate: LocalDate,
) {
  const markup = renderToStaticMarkup(createElement(YearView, {
    query: heatmap ? HEATMAP_QUERY : QUERY,
    translator: createTranslator("en", "en"),
    today,
    heatmap,
    showHoverPreview: false,
    showNoteIndicators: true,
    taskAnnotationMode: "hole",
    quarterNameMode: "number",
    selection: { kind: selectionKind, date: selectionDate },
    monthSelectionRequest: 0,
    onSelect: () => undefined,
    onOpenPeriodic: async () => undefined,
    onOpenDateContextMenu: () => undefined,
    longPress: new LongPressGesture({
      setTimeout: () => 1,
      clearTimeout: () => undefined,
    }),
  }));
  const window = new Window();
  window.document.body.innerHTML = markup;
  return window.document;
}
