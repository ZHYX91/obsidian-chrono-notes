// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IcsEventIndexSnapshot } from "../../src/features/calendar/ics-event-index";
import { selectWeekCalendar } from "../../src/features/calendar/week-calendar-query";
import { createTranslator } from "../../src/shared/i18n";
import { createDefaultSettings } from "../../src/shared/settings";
import { LongPressGesture } from "../../src/ui/calendar/long-press";
import { WeekView, type WeekViewProps } from "../../src/ui/calendar/week-view";
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

describe("WeekView weekly-note opening", () => {
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

  it.each([
    { name: "ordinary click", type: "click", options: {}, target: "default" },
    { name: "Ctrl click", type: "click", options: { ctrlKey: true }, target: "tab" },
    { name: "Cmd click", type: "click", options: { metaKey: true }, target: "tab" },
    { name: "middle click", type: "auxclick", options: { button: 1 }, target: "tab" },
  ] as const)("uses the requested target for $name", async ({ type, options, target }) => {
    const { button, query, onOpenPeriodic } = await renderWeeklyNote();

    await dispatch(button, new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      ...options,
    }));

    expect(onOpenPeriodic).toHaveBeenCalledExactlyOnceWith(query.weekStart, "weekly", target);
  });

  it("opens once on long press and consumes only the following synthetic click", async () => {
    const { button, query, onOpenPeriodic } = await renderWeeklyNote();

    await dispatch(button, new Event("touchstart", { bubbles: true }));
    await act(async () => vi.advanceTimersByTime(500));
    await dispatch(button, new Event("touchend", { bubbles: true }));
    await dispatch(button, new MouseEvent("click", { bubbles: true, cancelable: true }));

    expect(onOpenPeriodic).toHaveBeenCalledExactlyOnceWith(query.weekStart, "weekly", "default");

    await dispatch(button, new MouseEvent("click", { bubbles: true, ctrlKey: true }));

    expect(onOpenPeriodic).toHaveBeenCalledTimes(2);
    expect(onOpenPeriodic).toHaveBeenLastCalledWith(query.weekStart, "weekly", "tab");
  });

  async function renderWeeklyNote() {
    const settings = createDefaultSettings();
    const query = selectWeekCalendar(
      { year: 2026, month: 10, day: 23 },
      createParsedNoteIndexSnapshot({}, 1),
      DISABLED_ICS,
      {
        locale: "en-US",
        weekStartDay: "monday",
        today: { year: 2026, month: 10, day: 23 },
        calendarExtensions: [],
        holidayRegions: [],
        daily: { enabled: true, pattern: "[Daily]/YYYY-MM-DD" },
        weekly: { enabled: true, pattern: "[Weekly]/GGGG-[W]WW" },
        rangeNotes: settings.rangeNotes,
      },
    );
    const onOpenPeriodic = vi.fn<WeekViewProps["onOpenPeriodic"]>(async () => undefined);
    await act(async () => root.render(createElement(WeekView, {
      query,
      translator: createTranslator("en", "en-US"),
      selectionKind: "day",
      selectedDate: query.weekStart,
      today: query.weekStart,
      weekStartDay: "monday",
      showNoteIndicators: true,
      showTaskProgress: true,
      activePreviewKey: null,
      previewId: "preview",
      longPress,
      onSelectDate: () => undefined,
      onOpenPeriodic,
      onOpenPath: async () => undefined,
      onCreateRange: () => undefined,
      onToggleTask: async () => undefined,
      onRescheduleTask: async () => undefined,
      onOpenTaskSource: async () => undefined,
      onSchedulePreview: () => undefined,
      onDismissPreview: () => undefined,
      onOpenDateContextMenu: () => undefined,
    })));
    const button = container.querySelector<HTMLButtonElement>(".chrono-notes-weekly-note");
    if (button === null) throw new Error("Expected weekly-note entry");
    return { button, query, onOpenPeriodic };
  }
});

async function dispatch(target: EventTarget, event: Event): Promise<void> {
  await act(async () => target.dispatchEvent(event));
}

function setReactActEnvironment(enabled: boolean): void {
  (globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT: boolean;
  }).IS_REACT_ACT_ENVIRONMENT = enabled;
}
