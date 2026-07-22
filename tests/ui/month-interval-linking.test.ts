// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const monthQuery = vi.hoisted(() => {
  const statistics = Object.freeze({
    wordCount: 0,
    linkCount: 0,
    tagCount: 0,
    taskTotal: 0,
    taskCompleted: 0,
    taskCompletionRate: 0,
  });
  const start = Object.freeze({
    value: "2026-07-13",
    date: Object.freeze({ year: 2026, month: 7, day: 13 }),
    dateKey: "2026-07-13",
    hasTime: false,
    epochMillis: Date.UTC(2026, 6, 13),
  });
  const end = Object.freeze({
    value: "2026-07-26",
    date: Object.freeze({ year: 2026, month: 7, day: 26 }),
    dateKey: "2026-07-26",
    hasTime: false,
    epochMillis: Date.UTC(2026, 6, 26),
  });
  const planning = Object.freeze({
    path: "Ranges/Planning.md",
    title: "Planning",
    start,
    end,
    dayCount: 14,
    statistics,
    lane: 0,
    colorIndex: 2,
  });
  const review = Object.freeze({
    ...planning,
    path: "Ranges/Review.md",
    title: "Review",
    lane: 1,
    colorIndex: 2,
  });
  const weeklyNote = (date: Readonly<{
    year: number;
    month: number;
    day: number;
  }>) => Object.freeze({
    date,
    notePath: null,
    noteState: "not-configured" as const,
    preview: null,
    statistics,
  });

  return Object.freeze({
    year: 2026,
    month: 7,
    noteSnapshotVersion: 1,
    icsSnapshotVersion: 1,
    weeks: Object.freeze([
      Object.freeze({
        weekStart: Object.freeze({ year: 2026, month: 7, day: 13 }),
        weekNumber: 29,
        weekYear: 2026,
        weeklyNote: weeklyNote(
          Object.freeze({ year: 2026, month: 7, day: 13 }),
        ),
        days: Object.freeze([]),
        intervals: Object.freeze({
          items: Object.freeze([
            Object.freeze({
              ...planning,
              startColumn: 0,
              endColumn: 6,
              startsBeforeWeek: false,
              endsAfterWeek: true,
            }),
          ]),
          visibleLaneCount: 1,
          hiddenCount: 0,
          hiddenItems: Object.freeze([]),
          totalCount: 1,
        }),
      }),
      Object.freeze({
        weekStart: Object.freeze({ year: 2026, month: 7, day: 20 }),
        weekNumber: 30,
        weekYear: 2026,
        weeklyNote: weeklyNote(
          Object.freeze({ year: 2026, month: 7, day: 20 }),
        ),
        days: Object.freeze([]),
        intervals: Object.freeze({
          items: Object.freeze([
            Object.freeze({
              ...planning,
              startColumn: 0,
              endColumn: 6,
              startsBeforeWeek: true,
              endsAfterWeek: false,
            }),
            Object.freeze({
              ...review,
              startColumn: 1,
              endColumn: 3,
              startsBeforeWeek: false,
              endsAfterWeek: false,
            }),
          ]),
          visibleLaneCount: 2,
          hiddenCount: 0,
          hiddenItems: Object.freeze([]),
          totalCount: 2,
        }),
      }),
    ]),
  });
});

vi.mock("../../src/features/calendar/month-calendar-query", () => ({
  selectMonthCalendar: vi.fn(() => monthQuery),
}));
vi.mock("../../src/ui/use-local-today", () => ({
  useLocalToday: () => Object.freeze({ year: 2026, month: 7, day: 19 }),
}));

import type { IcsEventIndex } from "../../src/features/calendar/ics-event-index";
import type { NoteIndex } from "../../src/features/notes/note-index";
import { createDefaultSettings } from "../../src/shared/settings";
import {
  CalendarApp,
  type CalendarAppProps,
} from "../../src/ui/calendar/calendar-app";
import { IntervalGantt } from "../../src/ui/calendar/interval-gantt";
import { createNoteIndexSnapshot } from "../support/note-index-snapshot";

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

describe("month interval linking", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("links every visible segment by canonical path across week strips", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(CalendarApp, createProps()));
    });

    const planning = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        '.chrono-notes-month-interval-item[aria-label^="Planning,"]',
      ),
    );
    const review = container.querySelector<HTMLButtonElement>(
      '.chrono-notes-month-interval-item[aria-label^="Review,"]',
    );
    expect(planning).toHaveLength(2);
    expect(review).not.toBeNull();
    expectRelated(planning, false);
    expectRelated([review!], false);
    const planningGeometry = planning.map((element) =>
      element.getAttribute("style"),
    );

    await act(async () => {
      planning[0]?.dispatchEvent(new MouseEvent("mouseover", {
        bubbles: true,
      }));
    });
    expectRelated(planning, true);
    expectRelated([review!], false);
    expect(planning.map((element) => element.getAttribute("style"))).toEqual(
      planningGeometry,
    );

    await act(async () => {
      planning[0]?.dispatchEvent(new MouseEvent("mouseout", {
        bubbles: true,
        relatedTarget: document.body,
      }));
    });
    expectRelated(planning, false);

    await act(async () => {
      planning[0]?.dispatchEvent(new MouseEvent("mouseover", {
        bubbles: true,
      }));
      planning[0]?.focus();
      planning[0]?.dispatchEvent(new MouseEvent("mouseout", {
        bubbles: true,
        relatedTarget: document.body,
      }));
    });
    expectRelated(planning, true);

    await act(async () => {
      review?.focus();
    });
    expectRelated(planning, false);
    expectRelated([review!], true);

    await act(async () => {
      review?.blur();
      root.unmount();
    });
  });

  it("does not add linked state or event behavior to the week variant", () => {
    const firstWeek = monthQuery.weeks[0];
    expect(firstWeek).toBeDefined();
    const markup = renderToStaticMarkup(createElement(IntervalGantt, {
      data: firstWeek!.intervals,
      variant: "week",
      ariaLabel: "Range notes",
      formatDuration: (count: number) => `${count} days`,
      formatMore: (count: number) => `${count} more`,
      formatTaskProgress: () => "No tasks",
      onOpenPath: async () => undefined,
    }));

    expect(markup).not.toContain("data-related-active");
  });
});

function expectRelated(
  elements: readonly HTMLButtonElement[],
  expected: boolean,
): void {
  for (const element of elements) {
    expect(element.dataset.relatedActive).toBe(String(expected));
  }
}

function createProps(): CalendarAppProps {
  const settings = createDefaultSettings();
  return {
    noteIndex: {
      subscribe: () => () => undefined,
      getSnapshot: () => noteSnapshot,
    } as unknown as NoteIndex,
    icsEventIndex: {
      subscribe: () => () => undefined,
      getSnapshot: () => icsSnapshot,
    } as unknown as IcsEventIndex,
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
