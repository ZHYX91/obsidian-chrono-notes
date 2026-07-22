// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MonthCalendarQuery } from "../../src/features/calendar/month-calendar-query";

const selectors = vi.hoisted(() => ({
  month: vi.fn((target: Readonly<{ year: number; month: number }>): MonthCalendarQuery => ({
    year: target.year,
    month: target.month,
    noteSnapshotVersion: 1,
    icsSnapshotVersion: 1,
    weeks: [],
  })),
  week: vi.fn((_target: Readonly<{
    year: number;
    month: number;
    day: number;
  }>) => ({
    noteSnapshotVersion: 1,
    icsSnapshotVersion: 1,
    weekStart: { year: 2026, month: 7, day: 13 },
    weekEnd: { year: 2026, month: 7, day: 19 },
    weekNumber: 29,
    weekYear: 2026,
    days: [],
    weeklyNote: { noteState: "not-configured" },
    tasks: [],
    rangeNotesVisible: false,
    rangeCreationConfigured: false,
    intervals: {
      items: [],
      visibleLaneCount: 0,
      hiddenCount: 0,
      totalCount: 0,
    },
  })),
  year: vi.fn((year: number) => ({
    year,
    noteSnapshotVersion: 1,
    quarters: [],
  })),
}));

const preview = vi.hoisted(() => ({
  dismiss: vi.fn(),
  hide: vi.fn(),
  schedule: vi.fn(),
  suppress: vi.fn(),
}));

vi.mock("../../src/features/calendar/month-calendar-query", () => ({
  selectMonthCalendar: selectors.month,
}));
vi.mock("../../src/features/calendar/week-calendar-query", () => ({
  selectWeekCalendar: selectors.week,
}));
vi.mock("../../src/features/calendar/year-calendar-query", () => ({
  selectYearCalendarOverview: selectors.year,
  selectYearCalendarHeatmap: selectors.year,
}));
vi.mock("../../src/ui/use-local-today", () => {
  const today = Object.freeze({ year: 2026, month: 1, day: 3 });
  return { useLocalToday: () => today };
});
vi.mock("../../src/shared/local-date-clock", () => ({
  getCurrentLocalDate: () => Object.freeze({ year: 2026, month: 1, day: 3 }),
}));
vi.mock("../../src/ui/calendar/use-calendar-preview", () => ({
  useCalendarPreview: () => ({
    activePreview: null,
    activePreviewKey: null,
    previewId: "calendar-preview-test",
    schedulePreview: preview.schedule,
    dismissPreview: preview.dismiss,
    hidePreviewWithoutCancelling: preview.hide,
    suppressPreviewFor: preview.suppress,
  }),
}));

import type { IcsEventIndex } from "../../src/features/calendar/ics-event-index";
import type { NoteIndex } from "../../src/features/notes/note-index";
import {
  CalendarApp,
  type CalendarAppProps,
} from "../../src/ui/calendar/calendar-app";
import { LongPressGesture } from "../../src/ui/calendar/long-press";
import { createDefaultSettings } from "../../src/shared/settings";
import { noteStatistics } from "../support/note-statistics";
import {
  createNoteIndexSnapshot,
  createParsedNoteIndexSnapshot,
} from "../support/note-index-snapshot";

const noteSnapshot = createNoteIndexSnapshot({}, 1);
const icsSnapshot = Object.freeze({
  version: 1,
  contentVersion: 1,
  state: "disabled" as const,
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

describe("CalendarApp active query", () => {
  beforeEach(() => {
    selectors.month.mockClear();
    selectors.week.mockClear();
    selectors.year.mockClear();
    preview.dismiss.mockClear();
    preview.hide.mockClear();
    preview.schedule.mockClear();
    preview.suppress.mockClear();
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("selects and caches only the query for the active view", async () => {
    const noteUnsubscribe = vi.fn();
    const icsUnsubscribe = vi.fn();
    const noteSubscribe = vi.fn(() => noteUnsubscribe);
    const icsSubscribe = vi.fn(() => icsUnsubscribe);
    const props = createProps(noteSubscribe, icsSubscribe);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(CalendarApp, props));
    });

    expect(selectors.month).toHaveBeenCalledOnce();
    expect(selectors.week).not.toHaveBeenCalled();
    expect(selectors.year).not.toHaveBeenCalled();

    await act(async () => {
      root.render(createElement(CalendarApp, props));
    });
    expect(selectors.month).toHaveBeenCalledOnce();

    const viewButtons = container.querySelectorAll<HTMLButtonElement>(
      ".chrono-notes-view-mode button",
    );
    await act(async () => {
      viewButtons[0]?.click();
    });
    expect(selectors.month).toHaveBeenCalledOnce();
    expect(selectors.week).toHaveBeenCalledOnce();
    expect(selectors.year).not.toHaveBeenCalled();
    expect(container.querySelector(".chrono-notes-week-view")).not.toBeNull();

    await act(async () => {
      viewButtons[2]?.click();
    });
    expect(selectors.month).toHaveBeenCalledOnce();
    expect(selectors.week).toHaveBeenCalledOnce();
    expect(selectors.year).toHaveBeenCalledOnce();
    expect(container.querySelector(".chrono-notes-year-view")).not.toBeNull();

    await act(async () => {
      viewButtons[1]?.click();
    });
    expect(selectors.month).toHaveBeenCalledTimes(2);
    expect(selectors.week).toHaveBeenCalledOnce();
    expect(selectors.year).toHaveBeenCalledOnce();
    expect(container.querySelector(".chrono-notes-month-grid")).not.toBeNull();
    expect(noteSubscribe).toHaveBeenCalledTimes(4);
    expect(icsSubscribe).toHaveBeenCalledTimes(4);
    expect(noteUnsubscribe).toHaveBeenCalledTimes(3);
    expect(icsUnsubscribe).toHaveBeenCalledTimes(3);

    await act(async () => {
      root.unmount();
    });
    expect(noteUnsubscribe).toHaveBeenCalledTimes(4);
    expect(icsUnsubscribe).toHaveBeenCalledTimes(4);
  });

  it("uses the configured Sunday boundary for the current week number", async () => {
    selectors.month.mockReturnValueOnce({
      year: 2026,
      month: 1,
      noteSnapshotVersion: 1,
      icsSnapshotVersion: 1,
      weeks: [{
        weekStart: { year: 2025, month: 12, day: 28 },
        weekNumber: 1,
        weekYear: 2026,
        weeklyNote: {
          date: { year: 2025, month: 12, day: 28 },
          notePath: null,
          noteState: "not-configured",
          preview: null,
          statistics: noteStatistics(),
        },
        days: [],
        intervals: {
          items: [],
          visibleLaneCount: 0,
          hiddenCount: 0,
          hiddenItems: [],
          totalCount: 0,
        },
      }],
    });
    const settings = {
      ...createDefaultSettings(),
      weekStartDay: "sunday" as const,
    };
    const baseProps = createProps(() => () => undefined, () => () => undefined);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(CalendarApp, {
        ...baseProps,
        getSettings: () => settings,
      }));
    });

    const weekNumber = container.querySelector(".chrono-notes-week-number-button");
    expect(weekNumber?.classList.contains("is-current-period")).toBe(true);
    expect(weekNumber?.getAttribute("aria-current")).toBe("true");

    await act(async () => {
      root.unmount();
    });
  });

  it("selects weeks from the week picker without leaving the week view", async () => {
    const props = createProps(() => () => undefined, () => () => undefined);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(CalendarApp, props));
    });
    const viewButtons = container.querySelectorAll<HTMLButtonElement>(
      ".chrono-notes-view-mode button",
    );
    await act(async () => viewButtons[0]?.click());

    const triggers = container.querySelectorAll<HTMLButtonElement>(
      ".chrono-notes-calendar-period-anchor > .chrono-notes-calendar-picker-trigger",
    );
    expect(triggers).toHaveLength(2);
    await act(async () => triggers[1]?.click());
    expect(container.querySelector(".chrono-notes-week-picker")).not.toBeNull();

    const secondWeek = container.querySelector<HTMLButtonElement>(
      '[data-week-index="1"]',
    );
    await act(async () => secondWeek?.click());

    expect(selectors.week.mock.calls.at(-1)?.[0]).toEqual({
      year: 2026,
      month: 1,
      day: 10,
    });
    expect(container.querySelector(".chrono-notes-week-view")).not.toBeNull();
    expect(container.querySelector(".chrono-notes-week-picker")).toBeNull();

    await act(async () => root.unmount());
  });

  it("uses This month as a month-granularity action only in year view", async () => {
    const props = createProps(() => () => undefined, () => () => undefined);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(CalendarApp, props));
    });
    const todayButton = container.querySelector<HTMLButtonElement>(
      ".chrono-notes-today",
    );
    expect(todayButton?.textContent).toBe("Today");

    const viewButtons = container.querySelectorAll<HTMLButtonElement>(
      ".chrono-notes-view-mode button",
    );
    await act(async () => viewButtons[2]?.click());
    expect(todayButton?.textContent).toBe("This month");
    expect(todayButton?.getAttribute("aria-label")).toBe(
      "Select this month: Jan 2026",
    );

    const navigationButtons = container.querySelectorAll<HTMLButtonElement>(
      ".chrono-notes-calendar-navigation > button",
    );
    await act(async () => navigationButtons[1]?.click());
    expect(selectors.year.mock.calls.at(-1)?.[0]).toBe(2027);
    await act(async () => todayButton?.click());
    expect(selectors.year.mock.calls.at(-1)?.[0]).toBe(2026);
    expect(container.querySelector(".chrono-notes-year-view")).not.toBeNull();

    await act(async () => root.unmount());
  });

  it("shares enabled heatmap controls between month and year while omitting week", async () => {
    const setStatisticDimension = vi.fn(async () => undefined);
    const settings = {
      ...createDefaultSettings(),
      locale: "en" as const,
      yearViewHeatmap: true,
      statisticDisplayDimension: "word-count" as const,
    };
    const baseProps = createProps(() => () => undefined, () => () => undefined);
    const props: CalendarAppProps = {
      ...baseProps,
      getSettings: () => settings,
      onSetStatisticDimension: setStatisticDimension,
    };
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(createElement(CalendarApp, props)));
    expect(container.querySelector(".chrono-notes-heatmap-dimension")).toBeNull();
    expect(container.querySelector(".chrono-notes-heatmap-legend")).toBeNull();

    const monthHeatmapToggle = container.querySelector<HTMLButtonElement>(
      ".chrono-notes-heatmap-toggle",
    );
    await act(async () => monthHeatmapToggle?.click());
    expect(container.querySelectorAll(".chrono-notes-heatmap-legend span")).toHaveLength(5);
    expect(container.querySelector(".chrono-notes-heatmap-dimension")).not.toBeNull();
    expect(container.querySelector(".chrono-notes-heatmap-tools")?.getAttribute(
      "data-view-mode",
    )).toBe("month");

    const statisticSelect = container.querySelector<HTMLSelectElement>(
      ".chrono-notes-heatmap-dimension select",
    );
    if (statisticSelect === null) throw new Error("Expected heatmap statistic select");
    statisticSelect.value = "link-count";
    await act(async () => {
      statisticSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(setStatisticDimension).toHaveBeenCalledWith("link-count");

    const viewButtons = container.querySelectorAll<HTMLButtonElement>(
      ".chrono-notes-view-mode button",
    );
    await act(async () => viewButtons[0]?.click());
    expect(container.querySelector(".chrono-notes-heatmap-tools")).toBeNull();

    await act(async () => viewButtons[2]?.click());
    expect(container.querySelectorAll(".chrono-notes-heatmap-legend span")).toHaveLength(5);
    expect(container.querySelector<HTMLSelectElement>(
      ".chrono-notes-heatmap-dimension select",
    )?.value).toBe("word-count");
    expect(container.querySelector(".chrono-notes-heatmap-tools")?.getAttribute(
      "data-view-mode",
    )).toBe("year");

    await act(async () => root.unmount());
  });

  it("does not dismiss preview state for an unrelated note snapshot", async () => {
    let currentSnapshot = noteSnapshot;
    let sourceListener: (() => void) | null = null;
    const noteIndex = {
      subscribe: vi.fn((listener: () => void) => {
        sourceListener = listener;
        return () => undefined;
      }),
      getSnapshot: () => currentSnapshot,
    } as unknown as NoteIndex;
    const baseProps = createProps(() => () => undefined, () => () => undefined);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(CalendarApp, { ...baseProps, noteIndex }));
    });
    const dismissCount = preview.dismiss.mock.calls.length;
    expect(selectors.month).toHaveBeenCalledOnce();

    currentSnapshot = createParsedNoteIndexSnapshot({
      "Other/unrelated.md": "Unrelated content",
    }, 2);
    const notify = sourceListener as (() => void) | null;
    if (notify === null) throw new Error("Expected a NoteIndex subscription");
    await act(async () => notify());

    expect(selectors.month).toHaveBeenCalledOnce();
    expect(preview.dismiss).toHaveBeenCalledTimes(dismissCount);
    expect(container.querySelector(".chrono-notes-month-grid")).not.toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it("cancels touch work when the app blurs or the page becomes hidden", async () => {
    const cancel = vi.spyOn(LongPressGesture.prototype, "cancel");
    const props = createProps(() => () => undefined, () => () => undefined);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(createElement(CalendarApp, props)));
    const mountedCancelCount = cancel.mock.calls.length;

    window.dispatchEvent(new Event("blur"));
    expect(cancel).toHaveBeenCalledTimes(mountedCancelCount + 1);

    const visibilityState = vi.spyOn(document, "visibilityState", "get")
      .mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(cancel).toHaveBeenCalledTimes(mountedCancelCount + 2);

    visibilityState.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(cancel).toHaveBeenCalledTimes(mountedCancelCount + 2);

    await act(async () => root.unmount());
    window.dispatchEvent(new Event("blur"));
    document.dispatchEvent(new Event("visibilitychange"));
    expect(cancel).toHaveBeenCalledTimes(mountedCancelCount + 2);
  });
});

function createProps(
  noteSubscribe: (listener: () => void) => () => void,
  icsSubscribe: (listener: () => void) => () => void,
): CalendarAppProps {
  const settings = createDefaultSettings();
  const noteIndex = {
    subscribe: noteSubscribe,
    getSnapshot: () => noteSnapshot,
  } as unknown as NoteIndex;
  const icsEventIndex = {
    subscribe: icsSubscribe,
    getSnapshot: () => icsSnapshot,
  } as unknown as IcsEventIndex;
  return {
    noteIndex,
    icsEventIndex,
    getSettings: () => settings,
    onOpenPeriodic: async () => undefined,
    onSetYearHeatmap: async () => undefined,
    onSetStatisticDimension: async () => undefined,
    onOpenPath: async () => undefined,
    onCreateRange: () => undefined,
    onToggleTask: async () => undefined,
    onRescheduleTask: async () => undefined,
    onOpenTaskSource: async () => undefined,
    onOpenDateContextMenu: () => undefined,
    navigationRequest: null,
  };
}
