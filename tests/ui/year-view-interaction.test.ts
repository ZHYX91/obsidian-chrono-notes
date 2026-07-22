// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  selectYearCalendar,
  type YearCalendarQuery,
} from "../../src/features/calendar/year-calendar-query";
import { createTranslator } from "../../src/shared/i18n";
import { LongPressGesture } from "../../src/ui/calendar/long-press";
import {
  YearView,
  type YearViewProps,
} from "../../src/ui/calendar/year-view";
import { createNoteIndexSnapshot } from "../support/note-index-snapshot";

const JANUARY_1 = Object.freeze({ year: 2026, month: 1, day: 1 });

describe("YearView interactions", () => {
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
    vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    longPress.dispose();
    container.remove();
    document.querySelectorAll(".chrono-notes-calendar-preview").forEach(
      (element) => element.remove(),
    );
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    setReactActEnvironment(false);
  });

  it("keeps one day tab stop and exposes grid cells through semantic rows", async () => {
    await renderYear(getQuery(2026), {
      selection: { kind: "month", date: JANUARY_1 },
    });

    expect(container.querySelectorAll(
      '.chrono-notes-year-heatmap-day[tabindex="0"]',
    )).toHaveLength(1);
    const januaryGrid = container.querySelector('[role="grid"]');
    expect(januaryGrid?.querySelectorAll(':scope > [role="row"]')).toHaveLength(7);
    const gridCells = januaryGrid?.querySelectorAll('[role="gridcell"]') ?? [];
    expect(gridCells.length).toBeGreaterThan(27);
    for (const cell of gridCells) {
      expect(cell.parentElement?.getAttribute("role")).toBe("row");
      expect((cell as HTMLElement).style.gridRow).not.toBe("");
      expect((cell as HTMLElement).style.gridColumn).not.toBe("");
    }

    await renderYear(getQuery(2026), {
      selection: {
        kind: "day",
        date: { year: 2027, month: 1, day: 1 },
      },
    });
    expect(container.querySelectorAll(
      '.chrono-notes-year-heatmap-day[tabindex="0"]',
    )).toHaveLength(1);
  });

  it("maps arrow keys to the column-flow heatmap axes", async () => {
    const onSelect = vi.fn<YearViewProps["onSelect"]>();
    await renderYear(getQuery(2026), {
      selection: { kind: "day", date: JANUARY_1 },
      onSelect,
    });
    const january1 = getDay("2026-01-01");

    await dispatchKey(january1, "ArrowDown");
    expect(onSelect).toHaveBeenLastCalledWith(
      "day",
      { year: 2026, month: 1, day: 2 },
    );
    expect(document.activeElement).toBe(getDay("2026-01-02"));

    await dispatchKey(january1, "ArrowRight");
    expect(onSelect).toHaveBeenLastCalledWith(
      "day",
      { year: 2026, month: 1, day: 8 },
    );
    expect(document.activeElement).toBe(getDay("2026-01-08"));
  });

  it("cancels pending and active previews when disabled, hidden, or changing year", async () => {
    await renderYear(getQuery(2026));
    await hoverAndWait(getDay("2026-01-01"), 249);
    await renderYear(getQuery(2026), { heatmap: false });
    await act(async () => vi.advanceTimersByTime(1));
    expect(document.querySelector(".chrono-notes-calendar-preview")).toBeNull();

    await renderYear(getQuery(2026));
    await hoverAndWait(getDay("2026-01-01"), 250);
    expect(document.querySelector(".chrono-notes-calendar-preview")).not.toBeNull();
    await renderYear(getQuery(2026), { showHoverPreview: false });
    expect(document.querySelector(".chrono-notes-calendar-preview")).toBeNull();

    await renderYear(getQuery(2026));
    await hoverAndWait(getDay("2026-01-01"), 250);
    await renderYear(getQuery(2027));
    expect(document.querySelector(".chrono-notes-calendar-preview")).toBeNull();
  });

  it("lets Android contextmenu claim a heatmap long press exactly once", async () => {
    const onSelect = vi.fn<YearViewProps["onSelect"]>();
    const onOpenPeriodic = vi.fn<YearViewProps["onOpenPeriodic"]>(
      async () => undefined,
    );
    const onOpenDateContextMenu =
      vi.fn<YearViewProps["onOpenDateContextMenu"]>();
    await renderYear(getQuery(2026), {
      selection: { kind: "day", date: JANUARY_1 },
      onSelect,
      onOpenPeriodic,
      onOpenDateContextMenu,
    });
    const day = getDay("2026-01-01");

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
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith("day", JANUARY_1);
    expect(onOpenPeriodic).not.toHaveBeenCalled();
  });

  async function renderYear(
    query: YearCalendarQuery,
    overrides: Partial<YearViewProps> = {},
  ): Promise<void> {
    await act(async () => root.render(createElement(YearView, {
      query,
      translator: createTranslator("en", "en-US"),
      today: { year: 2026, month: 7, day: 20 },
      heatmap: true,
      showHoverPreview: true,
      showNoteIndicators: true,
      taskAnnotationMode: "hole",
      quarterNameMode: "number",
      selection: { kind: "month", date: JANUARY_1 },
      monthSelectionRequest: 0,
      onSelect: () => undefined,
      onOpenPeriodic: async () => undefined,
      onOpenDateContextMenu: () => undefined,
      longPress,
      ...overrides,
      weekStartDay: overrides.weekStartDay ?? "monday",
    })));
  }

  function getDay(dateKey: string): HTMLButtonElement {
    const button = container.querySelector<HTMLButtonElement>(
      `.chrono-notes-year-heatmap-day[aria-label^="${dateKey}"]`,
    );
    if (button === null) throw new Error(`Expected heatmap day ${dateKey}`);
    return button;
  }

  async function dispatchKey(target: HTMLElement, key: string): Promise<void> {
    await act(async () => target.dispatchEvent(new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
    })));
  }

  async function dispatch(target: EventTarget, event: Event): Promise<void> {
    await act(async () => target.dispatchEvent(event));
  }

  async function hoverAndWait(
    target: HTMLElement,
    durationMs: number,
  ): Promise<void> {
    await act(async () => {
      target.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      vi.advanceTimersByTime(durationMs);
    });
  }
});

function getQuery(year: number): YearCalendarQuery {
  return selectYearCalendar(
    year,
    createNoteIndexSnapshot({}, year),
    {
      locale: "en-US",
      weekStartDay: "monday",
      statisticDisplayDimension: "word-count",
      statisticValueStep: 2,
      daily: { enabled: false, pattern: "" },
      monthly: { enabled: false, pattern: "" },
      quarterly: { enabled: false, pattern: "" },
    },
  );
}

class TestIntersectionObserver {
  disconnect(): void {}
  observe(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  unobserve(): void {}
}

function setReactActEnvironment(enabled: boolean): void {
  (globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT: boolean;
  }).IS_REACT_ACT_ENVIRONMENT = enabled;
}
