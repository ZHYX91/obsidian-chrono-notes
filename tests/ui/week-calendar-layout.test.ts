import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { IcsEventOccurrence } from "../../src/core/calendar/ics-calendar";
import type { LocalDate } from "../../src/core/periodic/periodic-date";
import type { IcsEventIndexSnapshot } from "../../src/features/calendar/ics-event-index";
import {
  selectWeekCalendar,
  type WeekCalendarQueryOptions,
  type WeekCalendarQuery,
} from "../../src/features/calendar/week-calendar-query";
import type { NoteIndexSnapshot } from "../../src/features/notes/note-index";
import { createTranslator } from "../../src/shared/i18n";
import { LongPressGesture } from "../../src/ui/calendar/long-press";
import { WeekView } from "../../src/ui/calendar/week-view";
import {
  createNoteIndexSnapshot,
  createParsedNoteIndexSnapshot,
} from "../support/note-index-snapshot";
import { readPluginStyles } from "../support/plugin-styles";

const styles = readPluginStyles();
const weekViewSource = readFileSync(
  new URL("../../src/ui/calendar/week-view.tsx", import.meta.url),
  "utf8",
);

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

describe("week calendar layout", () => {
  it("renders the shared rich-day content after status, weekday, and date", () => {
    const events = Object.freeze([
      occurrence("first"),
      occurrence("second", 1),
      occurrence("third", 2),
      occurrence("fourth", 3),
    ]);
    const query = selectWeekCalendar(
      { year: 2026, month: 2, day: 17 },
      EMPTY_NOTES,
      readyIcs(Object.freeze({ "2026-02-17": events })),
      weekOptions({
        calendarOverlays: ["chinese-lunar"],
        holidayRegions: ["cn"],
      }),
    );
    const document = renderWeek(query, query.weekStart, query.weekEnd);
    const richDay = document.querySelector(
      '.chrono-notes-week-day[data-has-ics="true"]',
    );

    expect(richDay).not.toBeNull();
    expect(Array.from(richDay!.children, (child) => child.className)).toEqual([
      "chrono-notes-day-accessories",
      "chrono-notes-week-day-name",
      "chrono-notes-week-day-date",
      "chrono-notes-week-day-content",
    ]);
    expect(richDay?.querySelector(".chrono-notes-calendar-overlays")).not.toBeNull();
    expect(richDay?.querySelector(".chrono-notes-holiday-footer")).not.toBeNull();
    expect(richDay?.querySelectorAll(".chrono-notes-ics-event")).toHaveLength(3);
    expect(richDay?.querySelector(".chrono-notes-ics-more.is-medium")?.textContent).toBe("+3");
    expect(richDay?.querySelector(".chrono-notes-ics-more.is-wide")?.textContent).toBe("+1");
  });

  it("supports wide, medium, and compact information densities", () => {
    expect(weekViewSource).toContain("<CalendarDayCalendarDetails");
    expect(weekViewSource).toContain("<CalendarDayEvents");
    expect(weekViewSource).toContain("responsive");
    expect(styles).toMatch(
      /\.chrono-notes-week-day-name \.is-full,\s*\.chrono-notes-week-day-name \.is-compact\s*\{[^}]*display:\s*none;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-week-day-name \.is-medium\s*\{[^}]*display:\s*inline;/s,
    );
    expect(styles).toMatch(
      /@container \(min-width: 560px\)[\s\S]*?\.chrono-notes-week-day-name \.is-full\s*\{[^}]*display:\s*inline;[\s\S]*?data-event-index="1"\],[\s\S]*?data-event-index="2"\]\s*\{[^}]*display:\s*flex;/s,
    );
    expect(styles).toMatch(
      /@container \(max-width: 360px\)[\s\S]*?\.chrono-notes-week-day-name \.is-compact\s*\{[^}]*display:\s*inline;[\s\S]*?\.chrono-notes-week-day-content\s*\{[^}]*display:\s*none;/s,
    );
  });

  it("uses the shared note indicator and exact fraction for the weekly note", () => {
    const query = selectWeekCalendar(
      { year: 2026, month: 7, day: 15 },
      noteSnapshot({
        "Weekly/2026-W29.md": "- [x] Finished\n- [ ] Remaining",
      }),
      DISABLED_ICS,
      weekOptions({
        weekly: { enabled: true, pattern: "'Weekly'/kkkk-'W'WW" },
      }),
    );
    const document = renderWeek(query, query.weekStart, query.weekEnd);
    const weeklyNote = document.querySelector(".chrono-notes-weekly-note");

    expect(weeklyNote?.querySelector(
      '.chrono-notes-calendar-indicator[data-progress-text="1/2"]',
    )).not.toBeNull();
    expect(weeklyNote?.querySelector("strong")?.textContent).toBe("1/2");
    expect(weeklyNote?.querySelector(".chrono-notes-weekly-note-heading"))
      .not.toBeNull();
  });

  it("places one interval Gantt in a dedicated flow section below the day cards", () => {
    const query = selectWeekCalendar(
      { year: 2026, month: 7, day: 15 },
      noteSnapshot({
        "Ranges/planning.md": "---\nstart: 2026-07-14\nend: 2026-07-16\n---",
      }),
      DISABLED_ICS,
      weekOptions(),
    );
    const document = renderWeek(query, query.weekStart, query.weekEnd);
    const calendar = document.querySelector(".chrono-notes-week-calendar");

    expect(Array.from(calendar!.children, (child) => child.className)).toEqual([
      "chrono-notes-week-overview",
      "chrono-notes-week-ranges",
    ]);
    expect(calendar?.querySelector(".chrono-notes-week-overview")?.children).toHaveLength(7);
    expect(calendar?.querySelector(".chrono-notes-week-overview .chrono-notes-interval-gantt"))
      .toBeNull();
    expect(calendar?.querySelector(".chrono-notes-week-ranges > header h3")?.textContent)
      .toBe("Range notes");
    expect(calendar?.querySelectorAll(".chrono-notes-interval-gantt")).toHaveLength(1);
    const intervalBar = calendar?.querySelector(
      ".chrono-notes-week-interval-item",
    ) as HTMLElement | null | undefined;
    expect(intervalBar?.style.gridColumn).toBe("2 / 5");
    expect(weekViewSource).not.toContain("chrono-notes-week-interval-overlay");
    expect(weekViewSource).not.toContain("--chrono-notes-week-interval-height");
    expect(styles).toMatch(
      /\.chrono-notes-week-ranges\s*\{[^}]*margin-top:\s*7px;[^}]*min-width:\s*0;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-calendar button\.chrono-notes-week-interval-item\s*\{[^}]*--chrono-notes-interval-surface:\s*color-mix\(in srgb, var\(--chrono-notes-interval-color\) 72%, var\(--background-primary\)\);[^}]*box-shadow:\s*inset 0 0 0 1px[^}]*inline-size:\s*100%;[^}]*justify-self:\s*stretch;/s,
    );
  });

  it("keeps creation available and explains empty dated tasks", () => {
    const query = selectWeekCalendar(
      { year: 2026, month: 7, day: 15 },
      EMPTY_NOTES,
      DISABLED_ICS,
      weekOptions(),
    );
    const document = renderWeek(query, query.weekStart, query.weekEnd);

    expect(document.querySelector(".chrono-notes-week-ranges")).not.toBeNull();
    expect(document.querySelector(".chrono-notes-week-interval-item")).toBeNull();
    expect(document.querySelector(".chrono-notes-week-create-range")).not.toBeNull();
    expect(document.querySelector(".chrono-notes-week-task-list")).toBeNull();
    expect(document.querySelector(".chrono-notes-week-tasks > header span")?.textContent).toBe("0");
    expect(document.querySelector(".chrono-notes-week-tasks-empty strong")?.textContent)
      .toBeTruthy();
    expect(document.querySelector(".chrono-notes-week-tasks-empty span")?.textContent)
      .toBeTruthy();
  });

  it("separates selected-day and today semantics", () => {
    const query = selectWeekCalendar(
      { year: 2026, month: 7, day: 15 },
      EMPTY_NOTES,
      DISABLED_ICS,
      weekOptions(),
    );
    const selected = { year: 2026, month: 7, day: 15 };
    const today = { year: 2026, month: 7, day: 18 };
    const document = renderWeek(query, selected, today);
    const selectedCell = document.querySelector(
      '.chrono-notes-week-day[aria-pressed="true"]',
    );
    const todayCell = document.querySelector(
      '.chrono-notes-week-day[aria-current="date"]',
    );
    const ordinaryCell = document.querySelector(
      '.chrono-notes-week-day:not(.is-selected):not(.is-current-period)',
    );
    const selectedTodayDocument = renderWeek(query, today, today);
    const selectedTodayCell = selectedTodayDocument.querySelector(
      '.chrono-notes-week-day[aria-current="date"]',
    );

    expect(selectedCell?.classList.contains("is-selected")).toBe(true);
    expect(selectedCell?.classList.contains("is-current-period")).toBe(false);
    expect(todayCell?.classList.contains("is-current-period")).toBe(true);
    expect(todayCell?.getAttribute("aria-pressed")).toBe("false");
    expect(ordinaryCell?.classList.contains("is-selected")).toBe(false);
    expect(ordinaryCell?.classList.contains("is-current-period")).toBe(false);
    expect(selectedTodayCell?.classList.contains("is-selected")).toBe(true);
    expect(selectedTodayCell?.classList.contains("is-current-period")).toBe(true);
    expect(selectedTodayCell?.getAttribute("aria-pressed")).toBe("true");
    expect(styles).toMatch(
      /\.chrono-notes-week-day\.is-selected,[\s\S]*?\.chrono-notes-year-heatmap-day\.is-selected\s*\{[^}]*box-shadow:\s*0 0 0 2px var\(--interactive-accent\) !important;/s,
    );
    expect(styles).not.toMatch(
      /\.chrono-notes-week-day\.is-current-period\s*\{[^}]*background:/s,
    );
    expect(styles).toContain(
      ".chrono-notes-week-day.is-current-period:not(.is-drop-target)::after,",
    );
    expect(styles).not.toMatch(
      /\.chrono-notes-week-day\.is-current-period \.chrono-notes-week-day-date\s*\{/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-week-day-content\s*\{[^}]*gap:\s*2px;[^}]*margin-block-start:\s*1px;/s,
    );
    expect(styles).toMatch(
      /@container \(max-width: 360px\)[\s\S]*?\.chrono-notes-week-day-content\s*\{[^}]*display:\s*none;/s,
    );
  });

  it("exposes the seven native day buttons as a labelled selection group", () => {
    const query = selectWeekCalendar(
      { year: 2026, month: 7, day: 15 },
      EMPTY_NOTES,
      DISABLED_ICS,
      weekOptions(),
    );
    const document = renderWeek(query, query.weekStart, query.weekEnd);
    const overview = document.querySelector(".chrono-notes-week-overview");
    const buttons = overview?.querySelectorAll(".chrono-notes-week-day");

    expect(overview?.getAttribute("role")).toBe("group");
    expect(overview?.getAttribute("aria-label")).toBeTruthy();
    expect(overview?.querySelector('[role="gridcell"]')).toBeNull();
    expect(buttons).toHaveLength(7);
    expect(Array.from(buttons ?? [], (button) => button.getAttribute("aria-pressed")))
      .toEqual(["true", "false", "false", "false", "false", "false", "false"]);
    expect(weekViewSource).toContain('aria-label={messages.rangeNotes}');
    expect(weekViewSource).toContain('aria-label={messages.datedTasks}');
    expect(weekViewSource).toContain(
      "aria-label={datedTaskCountLabel} title={datedTaskCountLabel}",
    );
    expect(weekViewSource).not.toContain("aria-labelledby=");
    expect(weekViewSource).not.toContain('id="chrono-notes-week-');
  });
});

function weekOptions(
  overrides: Partial<WeekCalendarQueryOptions> = {},
): WeekCalendarQueryOptions {
  return {
    locale: "zh-CN",
    weekStartDay: "monday" as const,
    today: { year: 2026, month: 7, day: 18 },
    calendarOverlays: [],
    holidayRegions: [],
    daily: { enabled: false, pattern: "" },
    weekly: { enabled: false, pattern: "" },
    rangeNotes: {
      showInCalendar: true,
      folder: "Ranges",
      scanScope: "range-folder" as const,
      customFolder: "",
      monthViewLimit: 2,
      weekViewLimit: 2,
    },
    ...overrides,
  };
}

function renderWeek(
  query: WeekCalendarQuery,
  selectedDate: LocalDate,
  today: LocalDate,
) {
  const markup = renderToStaticMarkup(createElement(WeekView, {
    query,
    translator: createTranslator("en", "en"),
    selectedDate,
    today,
    showHoverPreview: true,
    showNoteIndicators: true,
    taskAnnotationMode: "hole",
    activePreviewKey: null,
    previewId: "preview",
    onSelectDate: () => undefined,
    onOpenPeriodic: async () => undefined,
    onOpenPath: async () => undefined,
    onCreateRange: () => undefined,
    onToggleTask: async () => undefined,
    onRescheduleTask: async () => undefined,
    onOpenTaskSource: async () => undefined,
    onSchedulePreview: () => undefined,
    onDismissPreview: () => undefined,
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

function occurrence(id: string, sortTimestamp = 0): IcsEventOccurrence {
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
    sortTimestamp,
  });
}

function readyIcs(
  eventsByDate: IcsEventIndexSnapshot["eventsByDate"],
): IcsEventIndexSnapshot {
  return Object.freeze({
    ...DISABLED_ICS,
    version: 4,
    state: "ready",
    enabled: true,
    totalSources: 1,
    loadedSources: 1,
    eventCount: Object.values(eventsByDate).reduce((total, events) => total + events.length, 0),
    refreshedAt: 1,
    eventsByDate,
  });
}

function noteSnapshot(contents: Record<string, string>): NoteIndexSnapshot {
  return createParsedNoteIndexSnapshot(contents, 2);
}
