// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LocalDate } from "../../src/core/periodic/periodic-date";
import {
  selectYearCalendarOverview,
  type YearCalendarQuery,
} from "../../src/features/calendar/year-calendar-query";
import { createTranslator } from "../../src/shared/i18n";
import { LongPressGesture } from "../../src/ui/calendar/long-press";
import { YearView } from "../../src/ui/calendar/year-view";
import { createNoteIndexSnapshot } from "../support/note-index-snapshot";

const translator = createTranslator("en", "en");
const today = Object.freeze({ year: 2026, month: 7, day: 20 });
const queries = new Map<number, YearCalendarQuery>();

describe("year view month reveal", () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalScrollIntoView: PropertyDescriptor | undefined;
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    originalScrollIntoView = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "scrollIntoView",
    );
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    vi.stubGlobal("IntersectionObserver", vi.fn(() => ({
      disconnect: vi.fn(),
      observe: vi.fn(),
      takeRecords: vi.fn(() => []),
      unobserve: vi.fn(),
    })));
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    if (originalScrollIntoView === undefined) {
      Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
    } else {
      Object.defineProperty(
        HTMLElement.prototype,
        "scrollIntoView",
        originalScrollIntoView,
      );
    }
    document.body.replaceChildren();
    scrollIntoView.mockClear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reveals after a year change and repeats an explicit This month request", async () => {
    await renderYear(2025, 1);
    expect(getJulyButton()).not.toBeNull();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    await renderYear(2026, 2);
    expect(getJulyButton()).not.toBeNull();
    expect(scrollIntoView).toHaveBeenCalledTimes(2);

    await renderYear(2026, 3);
    expect(getJulyButton()).not.toBeNull();
    expect(scrollIntoView).toHaveBeenCalledTimes(3);
  });

  async function renderYear(year: number, monthSelectionRequest: number) {
    const selected: LocalDate = Object.freeze({ year, month: 7, day: 1 });
    await act(async () => root.render(createElement(YearView, {
      query: getQuery(year),
      translator,
      today,
      heatmap: false,
      showHoverPreview: false,
      showNoteIndicators: true,
      taskAnnotationMode: "hole",
      quarterNameMode: "number",
      selection: { kind: "month", date: selected },
      monthSelectionRequest,
      onSelect: () => undefined,
      onOpenPeriodic: async () => undefined,
      onOpenDateContextMenu: () => undefined,
      longPress: new LongPressGesture({
        setTimeout: () => 1,
        clearTimeout: () => undefined,
      }),
    })));
  }

  function getJulyButton(): HTMLButtonElement | null {
    return container.querySelector(
      '[data-period-kind="month"][data-period-month="7"]',
    );
  }
});

function getQuery(year: number): YearCalendarQuery {
  const cached = queries.get(year);
  if (cached !== undefined) return cached;
  const query = selectYearCalendarOverview(
    year,
    createNoteIndexSnapshot({}, year),
    {
      locale: "en",
      weekStartDay: "monday",
      monthly: { enabled: false, pattern: "" },
      quarterly: { enabled: false, pattern: "" },
    },
  );
  queries.set(year, query);
  return query;
}
