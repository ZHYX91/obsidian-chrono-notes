// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IcsEventIndexSnapshot } from "../../src/features/calendar/ics-event-index";
import { selectWeekCalendar } from "../../src/features/calendar/week-calendar-query";
import { createTranslator } from "../../src/shared/i18n";
import { LongPressGesture } from "../../src/ui/calendar/long-press";
import {
  WeekView,
  type WeekViewProps,
} from "../../src/ui/calendar/week-view";
import { createParsedNoteIndexSnapshot } from "../support/note-index-snapshot";

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

describe("WeekView task rescheduling", () => {
  let container: HTMLDivElement;
  let root: Root;
  let longPress: LongPressGesture;

  beforeEach(() => {
    setReactActEnvironment(true);
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    longPress = new LongPressGesture({
      setTimeout: (callback, delay) => window.setTimeout(callback, delay),
      clearTimeout: (handle) => window.clearTimeout(handle),
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    longPress.dispose();
    container.remove();
    vi.useRealTimers();
    setReactActEnvironment(false);
  });

  it("offers the seven week dates through a native keyboard and touch control", async () => {
    const onRescheduleTask = vi.fn<WeekViewProps["onRescheduleTask"]>(
      async () => undefined,
    );
    const query = selectWeekCalendar(
      { year: 2026, month: 7, day: 22 },
      createParsedNoteIndexSnapshot({
        "Projects/release.md": "- [ ] Ship release 📅 2026-07-22",
      }, 1),
      DISABLED_ICS,
      {
        locale: "en-US",
        weekStartDay: "monday",
        today: { year: 2026, month: 7, day: 20 },
        calendarOverlays: [],
        holidayRegions: [],
        daily: { enabled: false, pattern: "" },
        weekly: { enabled: false, pattern: "" },
        rangeNotes: {
          showInCalendar: false,
          folder: "Ranges",
          scanScope: "range-folder",
          customFolder: "",
          monthViewLimit: 2,
          weekViewLimit: 2,
        },
      },
    );

    await act(async () => root.render(createElement(WeekView, {
      query,
      translator: createTranslator("en", "en-US"),
      selectionKind: "day",
      selectedDate: query.weekStart,
      today: { year: 2026, month: 7, day: 20 },
      showHoverPreview: false,
      showNoteIndicators: true,
      taskAnnotationMode: "hole",
      activePreviewKey: null,
      previewId: "preview",
      onSelectDate: () => undefined,
      onOpenPeriodic: async () => undefined,
      onOpenPath: async () => undefined,
      onCreateRange: () => undefined,
      onToggleTask: async () => undefined,
      onRescheduleTask,
      onOpenTaskSource: async () => undefined,
      onSchedulePreview: () => undefined,
      onDismissPreview: () => undefined,
      onOpenDateContextMenu: () => undefined,
      longPress,
    })));

    const select = container.querySelector<HTMLSelectElement>(
      ".chrono-notes-week-task-due",
    );
    if (select === null) throw new Error("Expected task due-date selector");
    expect(select.value).toBe("2026-07-22");
    expect(select.options).toHaveLength(7);
    expect(select.getAttribute("aria-label")).toContain("Ship release");

    await act(async () => {
      select.value = "2026-07-24";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(onRescheduleTask).toHaveBeenCalledOnce();
    expect(onRescheduleTask).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "Projects/release.md",
        dueDate: "2026-07-22",
      }),
      { year: 2026, month: 7, day: 24 },
    );
  });

  it("opens one date menu instead of also opening the daily note on Android", async () => {
    const onSelectDate = vi.fn<WeekViewProps["onSelectDate"]>();
    const onOpenPeriodic = vi.fn<WeekViewProps["onOpenPeriodic"]>(
      async () => undefined,
    );
    const onOpenDateContextMenu =
      vi.fn<WeekViewProps["onOpenDateContextMenu"]>();
    const query = selectWeekCalendar(
      { year: 2026, month: 7, day: 22 },
      createParsedNoteIndexSnapshot({}, 1),
      DISABLED_ICS,
      {
        locale: "en-US",
        weekStartDay: "monday",
        today: { year: 2026, month: 7, day: 20 },
        calendarOverlays: [],
        holidayRegions: [],
        daily: { enabled: true, pattern: "'Daily'/yyyy-MM-dd" },
        weekly: { enabled: false, pattern: "" },
        rangeNotes: {
          showInCalendar: false,
          folder: "",
          scanScope: "range-folder",
          customFolder: "",
          monthViewLimit: 2,
          weekViewLimit: 2,
        },
      },
    );

    await act(async () => root.render(createElement(WeekView, {
      query,
      translator: createTranslator("en", "en-US"),
      selectionKind: "day",
      selectedDate: query.weekStart,
      today: { year: 2026, month: 7, day: 20 },
      showHoverPreview: false,
      showNoteIndicators: true,
      taskAnnotationMode: "hole",
      activePreviewKey: null,
      previewId: "preview",
      onSelectDate,
      onOpenPeriodic,
      onOpenPath: async () => undefined,
      onCreateRange: () => undefined,
      onToggleTask: async () => undefined,
      onRescheduleTask: async () => undefined,
      onOpenTaskSource: async () => undefined,
      onSchedulePreview: () => undefined,
      onDismissPreview: () => undefined,
      onOpenDateContextMenu,
      longPress,
    })));
    const day = container.querySelector<HTMLButtonElement>(
      ".chrono-notes-week-day",
    );
    if (day === null) throw new Error("Expected a week date button");

    await dispatch(day, new Event("touchstart", {
      bubbles: true,
      cancelable: true,
    }));
    await act(async () => vi.advanceTimersByTime(500));
    expect(onOpenPeriodic).not.toHaveBeenCalled();

    await dispatch(day, new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    }));
    await dispatch(day, new Event("touchend", {
      bubbles: true,
      cancelable: true,
    }));
    await act(async () => vi.runOnlyPendingTimers());
    await dispatch(day, new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    }));

    expect(onOpenDateContextMenu).toHaveBeenCalledOnce();
    expect(onSelectDate).toHaveBeenCalledOnce();
    expect(onOpenPeriodic).not.toHaveBeenCalled();

    await dispatch(day, new MouseEvent("dblclick", {
      bubbles: true,
      cancelable: true,
    }));
    await dispatch(day, new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    }));
    expect(onOpenPeriodic).toHaveBeenCalledOnce();
    expect(onOpenDateContextMenu).toHaveBeenCalledTimes(2);
  });
});

async function dispatch(target: EventTarget, event: Event): Promise<void> {
  await act(async () => target.dispatchEvent(event));
}

function setReactActEnvironment(enabled: boolean): void {
  (globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT: boolean;
  }).IS_REACT_ACT_ENVIRONMENT = enabled;
}
