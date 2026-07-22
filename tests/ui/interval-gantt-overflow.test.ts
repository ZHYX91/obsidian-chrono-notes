// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseNoteInterval } from "../../src/core/note/note-interval";
import type { IntervalWeekData } from "../../src/features/intervals/interval-note-query";
import { IntervalGantt } from "../../src/ui/calendar/interval-gantt";
import { noteStatistics } from "../support/note-statistics";

describe("IntervalGantt overflow", () => {
  beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("opens the hidden items for the current week and preserves tab opening", async () => {
    const interval = parseNoteInterval({
      start: "2026-07-13",
      end: "2026-07-19",
    }).value;
    if (interval === null) throw new Error("Expected a valid interval");
    const data: IntervalWeekData = {
      items: [],
      visibleLaneCount: 0,
      hiddenCount: 1,
      hiddenItems: [{
        path: "Ranges/hidden.md",
        title: "Hidden range",
        start: interval.start,
        end: interval.end,
        dayCount: interval.dayCount,
        statistics: noteStatistics(),
      }],
      totalCount: 1,
    };
    const openPath = vi.fn(async () => undefined);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(IntervalGantt, {
        data,
        variant: "week",
        ariaLabel: "Range notes",
        formatDuration: (count: number) => `${count} days`,
        formatMore: (count: number) => `${count} more`,
        formatTaskProgress: () => "No tasks",
        onOpenPath: openPath,
      }));
    });

    const more = container.querySelector<HTMLButtonElement>(
      ".chrono-notes-week-interval-more",
    );
    expect(more?.getAttribute("aria-haspopup")).toBe("dialog");
    await act(async () => more?.click());
    expect(more?.getAttribute("aria-expanded")).toBe("true");
    const hidden = container.querySelector<HTMLButtonElement>(
      ".chrono-notes-interval-overflow-item",
    );
    expect(hidden?.textContent).toContain("Hidden range");

    await act(async () => hidden?.click());
    expect(openPath).toHaveBeenCalledWith("Ranges/hidden.md", "tab");
    expect(container.querySelector(".chrono-notes-interval-overflow")).toBeNull();
    await act(async () => root.unmount());
  });
});
