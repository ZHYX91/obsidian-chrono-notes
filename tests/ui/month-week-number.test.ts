import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MonthWeekNumber } from "../../src/ui/calendar/month-week-number";
import { LongPressGesture } from "../../src/ui/calendar/long-press";
import { noteStatistics } from "../support/note-statistics";

function longPress(): LongPressGesture {
  return new LongPressGesture({
    setTimeout: () => 1,
    clearTimeout: () => undefined,
  });
}

describe("MonthWeekNumber", () => {
  it("keeps current and selected as independent visual and ARIA states", () => {
    const states = [
      { current: false, selected: false, classes: "" },
      { current: true, selected: false, classes: " is-current-period" },
      { current: false, selected: true, classes: " is-selected" },
      { current: true, selected: true, classes: " is-current-period is-selected" },
    ] as const;

    for (const state of states) {
      const markup = renderWeekNumber(state.current, state.selected);
      expect(markup).toContain(
        `class="chrono-notes-week-number-button${state.classes}"`,
      );
      expect(markup).toContain(`aria-pressed="${state.selected}"`);
      expect(markup).toContain(`tabindex="${state.selected ? 0 : -1}"`);
      if (state.current) {
        expect(markup).toContain('aria-current="true"');
      } else {
        expect(markup).not.toContain("aria-current");
      }
    }
  });

  it("renders a selected weekly-note control with one centered top indicator slot", () => {
    const markup = renderToStaticMarkup(MonthWeekNumber({
      week: {
        weekNumber: 1,
        weekYear: 2026,
        weekStart: { year: 2025, month: 12, day: 29 },
        weeklyNote: {
          date: { year: 2025, month: 12, day: 29 },
          notePath: "Weekly/2026-01.md",
          noteState: "has-body",
          preview: "Week body",
          statistics: noteStatistics({
            taskTotal: 4,
            taskCompleted: 1,
            taskCompletionRate: 25,
          }),
        },
        days: [],
        intervals: emptyIntervals(),
      },
      current: true,
      selected: true,
      showNoteIndicators: true,
      taskAnnotationMode: "hole",
      ariaLabel: "Week 1, note with body, 1 of 4 tasks complete",
      longPress: longPress(),
      onSelect: () => undefined,
      onOpen: () => undefined,
      onMoveToDay: () => undefined,
    }));

    expect(markup).toContain('role="rowheader"');
    expect(markup).toContain(
      'class="chrono-notes-week-number-button is-current-period is-selected"',
    );
    expect(markup).toContain('data-note-state="has-body"');
    expect(markup).toContain('data-show-note-indicators="true"');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('aria-current="true"');
    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain('class="chrono-notes-week-number-label">W1</span>');
    expect(markup).toContain("chrono-notes-week-number-status");
    expect(markup).toContain("is-top is-progress is-horizontal");
    expect(markup.match(/chrono-notes-calendar-indicator/g)).toHaveLength(2);
  });

  it("keeps weekly-note metadata while hiding indicators in heatmap mode", () => {
    const markup = renderToStaticMarkup(MonthWeekNumber({
      week: {
        weekNumber: 2,
        weekYear: 2026,
        weekStart: { year: 2026, month: 1, day: 5 },
        weeklyNote: {
          date: { year: 2026, month: 1, day: 5 },
          notePath: "Weekly/2026-02.md",
          noteState: "empty",
          preview: null,
          statistics: noteStatistics(),
        },
        days: [],
        intervals: emptyIntervals(),
      },
      current: false,
      selected: false,
      showNoteIndicators: false,
      taskAnnotationMode: "none",
      ariaLabel: "Week 2, empty note",
      longPress: longPress(),
      onSelect: () => undefined,
      onOpen: () => undefined,
      onMoveToDay: () => undefined,
    }));

    expect(markup).toContain('data-note-state="empty"');
    expect(markup).toContain('data-show-note-indicators="false"');
    expect(markup).toContain('aria-pressed="false"');
    expect(markup).toContain('tabindex="-1"');
    expect(markup).toContain('class="chrono-notes-week-number-label">W2</span>');
    expect(markup).not.toContain("chrono-notes-week-number-status");
    expect(markup).not.toContain("chrono-notes-calendar-indicator");
  });

  it("does not mount an empty status overlay when weekly notes are not configured", () => {
    const markup = renderToStaticMarkup(MonthWeekNumber({
      week: {
        weekNumber: 2,
        weekYear: 2026,
        weekStart: { year: 2026, month: 1, day: 5 },
        weeklyNote: {
          date: { year: 2026, month: 1, day: 5 },
          notePath: null,
          noteState: "not-configured",
          preview: null,
          statistics: noteStatistics(),
        },
        days: [],
        intervals: emptyIntervals(),
      },
      current: false,
      selected: false,
      showNoteIndicators: true,
      taskAnnotationMode: "hole",
      ariaLabel: "Week 2, note not configured",
      longPress: longPress(),
      onSelect: () => undefined,
      onOpen: () => undefined,
      onMoveToDay: () => undefined,
    }));

    expect(markup).toContain('data-show-note-indicators="true"');
    expect(markup).toContain('class="chrono-notes-week-number-label">W2</span>');
    expect(markup).not.toContain("chrono-notes-week-number-status");
  });

  it("selects on click and routes every open gesture to the intended target", () => {
    const selected: string[] = [];
    const opened: string[] = [];
    let scheduled: (() => void) | undefined;
    const gesture = new LongPressGesture({
      setTimeout: (callback) => {
        scheduled = callback;
        return 1;
      },
      clearTimeout: () => undefined,
    });
    const wrapper = MonthWeekNumber({
      week: {
        weekNumber: 2,
        weekYear: 2026,
        weekStart: { year: 2026, month: 1, day: 5 },
        weeklyNote: {
          date: { year: 2026, month: 1, day: 5 },
          notePath: null,
          noteState: "missing",
          preview: null,
          statistics: noteStatistics(),
        },
        days: [],
        intervals: emptyIntervals(),
      },
      current: false,
      selected: false,
      showNoteIndicators: true,
      taskAnnotationMode: "hole",
      ariaLabel: "Week 2, note missing",
      longPress: gesture,
      onSelect: () => selected.push("week"),
      onOpen: (target) => opened.push(target),
      onMoveToDay: () => undefined,
    }) as ReactElement<{
      children: ReactElement<{
        onClick: (event: ClickEvent) => void;
        onDoubleClick: () => void;
        onAuxClick: (event: { button: number }) => void;
        onKeyDown: (event: KeyEvent) => void;
        onTouchStart: () => void;
      }>;
    }>;
    const button = wrapper.props.children;

    button.props.onClick(clickEvent());
    button.props.onClick(clickEvent({ ctrlKey: true }));
    button.props.onDoubleClick();
    button.props.onAuxClick({ button: 1 });
    const enter = keyEvent("Enter");
    button.props.onKeyDown(enter);
    expect(enter.prevented).toBe(true);

    button.props.onTouchStart();
    scheduled?.();
    const syntheticClick = clickEvent();
    button.props.onClick(syntheticClick);

    expect(selected).toEqual(["week", "week"]);
    expect(opened).toEqual(["tab", "default", "tab", "default", "default"]);
    expect(syntheticClick.prevented).toBe(true);
    expect(syntheticClick.stopped).toBe(true);
  });
});

function renderWeekNumber(current: boolean, selected: boolean): string {
  return renderToStaticMarkup(MonthWeekNumber({
    week: {
      weekNumber: 29,
      weekYear: 2026,
      weekStart: { year: 2026, month: 7, day: 13 },
      weeklyNote: {
        date: { year: 2026, month: 7, day: 13 },
        notePath: null,
        noteState: "not-configured",
        preview: null,
        statistics: noteStatistics(),
      },
      days: [],
      intervals: emptyIntervals(),
    },
    current,
    selected,
    showNoteIndicators: false,
    taskAnnotationMode: "none",
    ariaLabel: "Week 29",
    longPress: longPress(),
    onSelect: () => undefined,
    onOpen: () => undefined,
    onMoveToDay: () => undefined,
  }));
}

interface ClickEvent {
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  prevented: boolean;
  stopped: boolean;
  preventDefault(): void;
  stopPropagation(): void;
}

interface KeyEvent {
  readonly key: string;
  prevented: boolean;
  preventDefault(): void;
}

function clickEvent(modifiers: Partial<Pick<ClickEvent, "ctrlKey" | "metaKey">> = {}): ClickEvent {
  return {
    ctrlKey: modifiers.ctrlKey ?? false,
    metaKey: modifiers.metaKey ?? false,
    prevented: false,
    stopped: false,
    preventDefault() {
      this.prevented = true;
    },
    stopPropagation() {
      this.stopped = true;
    },
  };
}

function keyEvent(key: string): KeyEvent {
  return {
    key,
    prevented: false,
    preventDefault() {
      this.prevented = true;
    },
  };
}

function emptyIntervals() {
  return Object.freeze({
    items: Object.freeze([]),
    visibleLaneCount: 0,
    hiddenCount: 0,
    hiddenItems: Object.freeze([]),
    totalCount: 0,
  });
}
