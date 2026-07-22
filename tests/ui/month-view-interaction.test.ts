// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseNoteInterval } from "../../src/core/note/note-interval";
import type { LocalDate } from "../../src/core/periodic/periodic-date";
import type {
  MonthCalendarDay,
  MonthCalendarQuery,
} from "../../src/features/calendar/month-calendar-query";
import { createTranslator } from "../../src/shared/i18n";
import { LongPressGesture } from "../../src/ui/calendar/long-press";
import {
  MonthView,
  type MonthViewProps,
} from "../../src/ui/calendar/month-view";
import { noteStatistics } from "../support/note-statistics";

const JULY_31 = Object.freeze({ year: 2026, month: 7, day: 31 });
const AUGUST_1 = Object.freeze({ year: 2026, month: 8, day: 1 });
const AUGUST_2 = Object.freeze({ year: 2026, month: 8, day: 2 });

describe("MonthView interactions", () => {
  let container: HTMLDivElement;
  let root: Root;
  let scheduledLongPress: (() => void) | undefined;
  let longPress: LongPressGesture;

  beforeEach(() => {
    setReactActEnvironment(true);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    scheduledLongPress = undefined;
    longPress = new LongPressGesture({
      setTimeout: (callback) => {
        scheduledLongPress = callback;
        return 1;
      },
      clearTimeout: () => {
        scheduledLongPress = undefined;
      },
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    longPress.dispose();
    container.remove();
    setReactActEnvironment(false);
  });

  it("moves across a month through onMoveSelection and restores focus after rerender", async () => {
    const onMoveSelection = vi.fn<(date: LocalDate) => void>();

    await renderView(
      monthQuery(2026, 7, [monthDay(JULY_31, true)]),
      JULY_31,
      { onMoveSelection },
    );
    const source = getDayButton("31");
    source.focus();

    await dispatch(
      source,
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(onMoveSelection).toHaveBeenCalledOnce();
    expect(onMoveSelection).toHaveBeenCalledWith(AUGUST_1);

    await renderView(
      monthQuery(2026, 8, [monthDay(AUGUST_1, true)]),
      AUGUST_1,
      { onMoveSelection },
    );

    expect(document.activeElement).toBe(getDayButton("1"));
  });

  it("keeps one visible date tab stop for period and cross-query selections", async () => {
    const query = monthQuery(2026, 8, [
      monthDay(JULY_31, false),
      monthDay(AUGUST_1, true),
    ]);

    await renderView(query, JULY_31, {
      selection: { kind: "week", date: JULY_31 },
    });
    expect(getDateTabStops()).toEqual([getDayButton("31")]);

    await renderView(query, JULY_31, {
      selection: { kind: "month", date: JULY_31 },
      heatmapEnabled: true,
    });
    expect(getDateTabStops()).toEqual([getDayButton("1")]);

    await renderView(query, { year: 2027, month: 1, day: 1 }, {
      selection: {
        kind: "day",
        date: { year: 2027, month: 1, day: 1 },
      },
    });
    expect(getDateTabStops()).toEqual([getDayButton("1")]);
  });

  it("moves right from a week number into its first enabled date", async () => {
    const onMoveSelection = vi.fn<(date: LocalDate) => void>();
    const augustQuery = monthQuery(2026, 8, [
      monthDay(JULY_31, false),
      monthDay(AUGUST_1, true),
    ]);
    await renderView(augustQuery, JULY_31, {
      selection: { kind: "week", date: JULY_31 },
      onMoveSelection,
    });
    const weekNumber = container.querySelector<HTMLButtonElement>(
      ".chrono-notes-week-number-button",
    );
    if (weekNumber === null) throw new Error("Expected week number button");
    weekNumber.focus();

    await dispatch(weekNumber, new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    }));

    expect(onMoveSelection).toHaveBeenCalledWith(JULY_31);

    await renderView(
      monthQuery(2026, 7, [monthDay(JULY_31, true)]),
      JULY_31,
      { onMoveSelection },
    );
    expect(document.activeElement).toBe(getDayButton("31"));
  });

  it("skips disabled outside-month heatmap dates when entering from a week number", async () => {
    const onMoveSelection = vi.fn<(date: LocalDate) => void>();
    const query = monthQuery(2026, 8, [
      monthDay(JULY_31, false),
      monthDay(AUGUST_1, true),
    ]);
    await renderView(query, JULY_31, {
      selection: { kind: "week", date: JULY_31 },
      heatmapEnabled: true,
      onMoveSelection,
    });
    const weekNumber = container.querySelector<HTMLButtonElement>(
      ".chrono-notes-week-number-button",
    );
    if (weekNumber === null) throw new Error("Expected week number button");

    await dispatch(weekNumber, new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    }));
    expect(onMoveSelection).toHaveBeenCalledWith(AUGUST_1);

    await renderView(query, AUGUST_1, {
      heatmapEnabled: true,
      onMoveSelection,
    });
    expect(document.activeElement).toBe(getDayButton("1"));
  });

  it("consumes the long-press click before a pending range-drag click", async () => {
    const onSelect = vi.fn<MonthViewProps["onSelect"]>();
    const onCreateRange = vi.fn<MonthViewProps["onCreateRange"]>();
    const onOpenPeriodic = vi.fn<MonthViewProps["onOpenPeriodic"]>(
      async () => undefined,
    );
    await renderView(
      monthQuery(2026, 8, [
        monthDay(AUGUST_1, true),
        monthDay(AUGUST_2, true),
      ]),
      AUGUST_1,
      { onSelect, onCreateRange, onOpenPeriodic },
    );
    const first = getDayButton("1");
    const second = getDayButton("2");

    await startAndCompleteRange(first, second);
    expect(onCreateRange).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledOnce();

    await dispatch(
      second,
      new Event("touchstart", { bubbles: true, cancelable: true }),
    );
    expect(scheduledLongPress).toBeTypeOf("function");
    await act(async () => scheduledLongPress?.());
    expect(onOpenPeriodic).not.toHaveBeenCalled();
    await dispatch(
      second,
      new Event("touchend", { bubbles: true, cancelable: true }),
    );
    expect(scheduledLongPress).toBeTypeOf("function");
    await act(async () => scheduledLongPress?.());
    expect(onOpenPeriodic).toHaveBeenCalledWith(
      AUGUST_2,
      "daily",
      "default",
    );

    await dispatch(second, clickEvent());
    expect(onSelect).toHaveBeenCalledOnce();

    await dispatch(second, clickEvent());
    expect(onSelect).toHaveBeenCalledOnce();

    await dispatch(second, clickEvent());
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenLastCalledWith("day", AUGUST_2);
  });

  it("lets Android contextmenu win over long press without changing desktop actions", async () => {
    const onSelect = vi.fn<MonthViewProps["onSelect"]>();
    const onOpenPeriodic = vi.fn<MonthViewProps["onOpenPeriodic"]>(
      async () => undefined,
    );
    const onOpenDateContextMenu =
      vi.fn<MonthViewProps["onOpenDateContextMenu"]>();
    await renderView(
      monthQuery(2026, 8, [monthDay(AUGUST_1, true)]),
      AUGUST_1,
      { onSelect, onOpenPeriodic, onOpenDateContextMenu },
    );
    const day = getDayButton("1");

    await dispatch(
      day,
      new Event("touchstart", { bubbles: true, cancelable: true }),
    );
    await act(async () => scheduledLongPress?.());
    expect(onOpenPeriodic).not.toHaveBeenCalled();

    await dispatch(day, new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    }));
    await dispatch(
      day,
      new Event("touchend", { bubbles: true, cancelable: true }),
    );
    await dispatch(day, clickEvent());

    expect(onOpenDateContextMenu).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith("day", AUGUST_1);
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
    expect(onOpenPeriodic).toHaveBeenCalledWith(
      AUGUST_1,
      "daily",
      "default",
    );
    expect(onOpenDateContextMenu).toHaveBeenCalledTimes(2);
  });

  it("submits a range once when the cell mouseup also reaches window", async () => {
    const onSelect = vi.fn<MonthViewProps["onSelect"]>();
    const onCreateRange = vi.fn<MonthViewProps["onCreateRange"]>();
    const dismissPreview = vi.fn();
    await renderView(
      monthQuery(2026, 8, [
        monthDay(AUGUST_1, true),
        monthDay(AUGUST_2, true),
      ]),
      AUGUST_1,
      {
        onSelect,
        onCreateRange,
        preview: previewController({ dismiss: dismissPreview }),
      },
    );

    await startAndCompleteRange(getDayButton("1"), getDayButton("2"));

    expect(onCreateRange).toHaveBeenCalledOnce();
    expect(onCreateRange).toHaveBeenCalledWith(AUGUST_1, AUGUST_2);
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith("day", AUGUST_2);
    expect(dismissPreview).toHaveBeenCalled();
  });

  it("omits interval lanes while preserving heatmap date interaction", async () => {
    const base = monthQuery(2026, 8, [
      monthDay(JULY_31, false),
      monthDay(AUGUST_1, true),
    ]);
    const week = base.weeks[0];
    if (week === undefined) throw new Error("Expected a heatmap fixture week");
    const hiddenInterval = parseNoteInterval({
      start: "2026-08-01",
      end: "2026-08-02",
    }).value;
    if (hiddenInterval === null) throw new Error("Expected a valid hidden interval");
    const query: MonthCalendarQuery = Object.freeze({
      ...base,
      weeks: Object.freeze([
        Object.freeze({
          ...week,
          intervals: Object.freeze({
            items: Object.freeze([]),
            visibleLaneCount: 0,
            hiddenCount: 1,
            hiddenItems: Object.freeze([{
              path: "Ranges/hidden.md",
              title: "Hidden range",
              start: hiddenInterval.start,
              end: hiddenInterval.end,
              dayCount: hiddenInterval.dayCount,
              statistics: noteStatistics(),
            }]),
            totalCount: 1,
          }),
        }),
      ]),
    });

    await renderView(query, AUGUST_1, { heatmapEnabled: true });

    expect(container.querySelector(".chrono-notes-month-interval-strip"))
      .toBeNull();
    expect(container.querySelector(".chrono-notes-month-interval-more"))
      .toBeNull();
    expect(getDayButton("1").classList.contains("is-heatmap")).toBe(true);
    expect(getDayButton("1").getAttribute("aria-selected")).toBe("true");
    const outside = container.querySelector<HTMLButtonElement>(
      ".chrono-notes-day.is-outside",
    );
    expect(outside?.disabled).toBe(true);
    expect(outside?.getAttribute("aria-hidden")).toBe("true");
  });

  it("clears linked interval interaction across heatmap toggles", async () => {
    const base = monthQuery(2026, 8, [monthDay(AUGUST_1, true)]);
    const week = base.weeks[0];
    const interval = parseNoteInterval({
      start: "2026-08-01",
      end: "2026-08-02",
    }).value;
    if (week === undefined || interval === null) {
      throw new Error("Expected a visible interval fixture");
    }
    const query: MonthCalendarQuery = Object.freeze({
      ...base,
      weeks: Object.freeze([Object.freeze({
        ...week,
        intervals: Object.freeze({
          items: Object.freeze([Object.freeze({
            path: "Ranges/visible.md",
            title: "Visible range",
            start: interval.start,
            end: interval.end,
            dayCount: interval.dayCount,
            statistics: noteStatistics(),
            lane: 0,
            colorIndex: 0,
            startColumn: 0,
            endColumn: 1,
            startsBeforeWeek: false,
            endsAfterWeek: false,
          })]),
          visibleLaneCount: 1,
          hiddenCount: 0,
          hiddenItems: Object.freeze([]),
          totalCount: 1,
        }),
      })]),
    });

    await renderView(query, AUGUST_1);
    const intervalButton = container.querySelector<HTMLButtonElement>(
      ".chrono-notes-month-interval-item",
    );
    if (intervalButton === null) throw new Error("Expected an interval button");
    await dispatch(
      intervalButton,
      new MouseEvent("mouseover", { bubbles: true }),
    );
    await act(async () => intervalButton.focus());
    expect(intervalButton.dataset.relatedActive).toBe("true");

    await renderView(query, AUGUST_1, { heatmapEnabled: true });
    expect(container.querySelector(".chrono-notes-month-interval-strip"))
      .toBeNull();

    await renderView(query, AUGUST_1);
    expect(container.querySelector<HTMLButtonElement>(
      ".chrono-notes-month-interval-item",
    )?.dataset.relatedActive).toBe("false");
  });

  async function renderView(
    query: MonthCalendarQuery,
    selected: LocalDate,
    overrides: Partial<MonthViewProps> = {},
  ): Promise<void> {
    const props: MonthViewProps = {
      query,
      translator: createTranslator("en", "en-US"),
      today: Object.freeze({ year: 2026, month: 7, day: 20 }),
      weekdayLabels: Object.freeze(["M", "T", "W", "T", "F", "S", "S"]),
      selection: Object.freeze({ kind: "day", date: selected }),
      weekStartDay: "monday",
      heatmapEnabled: false,
      showHoverPreview: true,
      showNoteIndicators: true,
      taskAnnotationMode: "hole",
      rangeCreationConfigured: true,
      longPress,
      preview: previewController(),
      onSelect: () => undefined,
      onMoveSelection: () => undefined,
      onOpenPeriodic: async () => undefined,
      onOpenPath: async () => undefined,
      onCreateRange: () => undefined,
      onOpenDateContextMenu: () => undefined,
      ...overrides,
    };
    await act(async () => root.render(createElement(MonthView, props)));
  }

  function getDayButton(label: string): HTMLButtonElement {
    const button = [...container.querySelectorAll<HTMLButtonElement>(
      ".chrono-notes-day",
    )].find(
      (candidate) =>
        candidate.querySelector(".chrono-notes-day-number")?.textContent ===
        label,
    );
    if (button === undefined) throw new Error(`Day ${label} was not rendered`);
    return button;
  }

  function getDateTabStops(): HTMLButtonElement[] {
    return [...container.querySelectorAll<HTMLButtonElement>(
      '.chrono-notes-day:not(:disabled)[tabindex="0"]',
    )];
  }

  async function startAndCompleteRange(
    first: HTMLButtonElement,
    second: HTMLButtonElement,
  ): Promise<void> {
    await dispatch(first, mouseEvent("mousedown", { button: 0, buttons: 1 }));
    await dispatch(second, mouseEvent("mouseover", { button: 0, buttons: 1 }));
    await dispatch(second, mouseEvent("mouseup", { button: 0, buttons: 0 }));
  }
});

function monthQuery(
  year: number,
  month: number,
  days: readonly MonthCalendarDay[],
): MonthCalendarQuery {
  const weekStart = days[0]?.date;
  if (weekStart === undefined) throw new Error("Month fixture needs one day");
  return Object.freeze({
    year,
    month,
    noteSnapshotVersion: 1,
    icsSnapshotVersion: 1,
    weeks: Object.freeze([
      Object.freeze({
        weekStart,
        weekNumber: 31,
        weekYear: year,
        weeklyNote: Object.freeze({
          date: weekStart,
          notePath: null,
          noteState: "not-configured",
          preview: null,
          statistics: noteStatistics(),
        }),
        days: Object.freeze(days),
        intervals: Object.freeze({
          items: Object.freeze([]),
          visibleLaneCount: 0,
          hiddenCount: 0,
          hiddenItems: Object.freeze([]),
          totalCount: 0,
        }),
      }),
    ]),
  });
}

function monthDay(date: LocalDate, inCurrentMonth: boolean): MonthCalendarDay {
  return Object.freeze({
    date,
    notePath: null,
    noteState: "missing",
    preview: null,
    statistics: noteStatistics(),
    calendarOverlays: Object.freeze([]),
    holidays: Object.freeze([]),
    workday: null,
    regionalMarker: null,
    icsEvents: Object.freeze([]),
    heatmap: null,
    inCurrentMonth,
  });
}

function previewController(
  overrides: Partial<MonthViewProps["preview"]> = {},
): MonthViewProps["preview"] {
  return Object.freeze({
    activeKey: null,
    id: "month-preview",
    schedule: () => undefined,
    dismiss: () => undefined,
    suppressFor: () => undefined,
    ...overrides,
  });
}

function mouseEvent(
  type: string,
  init: Pick<MouseEventInit, "button" | "buttons">,
): MouseEvent {
  return new MouseEvent(type, {
    ...init,
    bubbles: true,
    cancelable: true,
  });
}

function clickEvent(): MouseEvent {
  return mouseEvent("click", { button: 0, buttons: 0 });
}

async function dispatch(target: EventTarget, event: Event): Promise<void> {
  await act(async () => {
    target.dispatchEvent(event);
  });
}

function setReactActEnvironment(enabled: boolean): void {
  (globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT: boolean;
  }).IS_REACT_ACT_ENVIRONMENT = enabled;
}
