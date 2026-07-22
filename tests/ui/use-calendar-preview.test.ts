// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { NoteStatistics } from "../../src/core/note/note-statistics";
import type { CalendarPreviewCell } from "../../src/ui/calendar/calendar-preview-tooltip";
import {
  useCalendarPreview,
  type CalendarPreviewController,
} from "../../src/ui/calendar/use-calendar-preview";

interface TestPreviewCell extends CalendarPreviewCell {
  readonly previewable: boolean;
}

const EMPTY_STATISTICS: NoteStatistics = Object.freeze({
  wordCount: 0,
  linkCount: 0,
  tagCount: 0,
  taskTotal: 0,
  taskCompleted: 0,
  taskCompletionRate: 0,
});

const PREVIEWABLE_CELL: TestPreviewCell = Object.freeze({
  noteState: "existing",
  preview: "Preview",
  statistics: EMPTY_STATISTICS,
  previewable: true,
});

const BLOCKED_CELL: TestPreviewCell = Object.freeze({
  ...PREVIEWABLE_CELL,
  previewable: false,
});

describe("useCalendarPreview", () => {
  let container: HTMLDivElement;
  let root: Root;
  let controller: CalendarPreviewController<TestPreviewCell> | null;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 20, 12));
    controller = null;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("shows eligible previews after exactly 250 ms", async () => {
    await renderProbe(true, true);

    await act(async () => {
      getController().schedulePreview(
        "2026-07-20",
        PREVIEWABLE_CELL,
        document.createElement("button"),
      );
      vi.advanceTimersByTime(249);
    });
    expect(container.textContent).toBe("none");

    await act(async () => vi.advanceTimersByTime(1));
    expect(container.textContent).toBe("2026-07-20");

    await act(async () => getController().dismissPreview());
    await act(async () => {
      getController().schedulePreview(
        "blocked",
        BLOCKED_CELL,
        document.createElement("button"),
      );
      vi.advanceTimersByTime(250);
    });
    expect(container.textContent).toBe("none");
  });

  it("suppresses touch-triggered hover scheduling for the requested window", async () => {
    await renderProbe(true, true);

    await act(async () => {
      getController().suppressPreviewFor(750);
      getController().schedulePreview(
        "suppressed",
        PREVIEWABLE_CELL,
        document.createElement("button"),
      );
      vi.advanceTimersByTime(750);
    });
    expect(container.textContent).toBe("none");

    await act(async () => {
      getController().schedulePreview(
        "allowed",
        PREVIEWABLE_CELL,
        document.createElement("button"),
      );
      vi.advanceTimersByTime(250);
    });
    expect(container.textContent).toBe("allowed");
  });

  it("preserves each view's existing disable behavior", async () => {
    await renderProbe(true, true);
    await showPreview("dismissed");
    await renderProbe(false, true);
    expect(container.textContent).toBe("none");

    await renderProbe(true, false);
    await showPreview("retained");
    await renderProbe(false, false);
    expect(container.textContent).toBe("retained");
  });

  it("can hide the active preview without cancelling pending work", async () => {
    await renderProbe(true, false);
    await act(async () => {
      getController().schedulePreview(
        "pending",
        PREVIEWABLE_CELL,
        document.createElement("button"),
      );
      getController().hidePreviewWithoutCancelling();
      vi.advanceTimersByTime(250);
    });
    expect(container.textContent).toBe("pending");
  });

  async function renderProbe(
    enabled: boolean,
    dismissOnDisable: boolean,
  ): Promise<void> {
    await act(async () => {
      root.render(createElement(PreviewProbe, { enabled, dismissOnDisable }));
    });
  }

  async function showPreview(key: string): Promise<void> {
    await act(async () => {
      getController().schedulePreview(
        key,
        PREVIEWABLE_CELL,
        document.createElement("button"),
      );
      vi.advanceTimersByTime(250);
    });
  }

  function getController(): CalendarPreviewController<TestPreviewCell> {
    if (controller === null) throw new Error("Preview probe is not rendered");
    return controller;
  }

  function PreviewProbe({
    enabled,
    dismissOnDisable,
  }: Readonly<{
    enabled: boolean;
    dismissOnDisable: boolean;
  }>) {
    controller = useCalendarPreview<TestPreviewCell>({
      enabled,
      dismissOnDisable,
      isPreviewable: (cell) => cell.previewable,
    });
    return createElement("span", null, controller.activePreviewKey ?? "none");
  }
});
