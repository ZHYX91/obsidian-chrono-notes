// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import type { IcsEventIndex } from "../../src/features/calendar/ics-event-index";
import type { NoteIndex } from "../../src/features/notes/note-index";
import { createTranslator } from "../../src/shared/i18n";
import { createDefaultSettings } from "../../src/shared/settings";
import {
  CalendarApp,
  type CalendarAppProps,
} from "../../src/ui/calendar/calendar-app";
import { createNoteIndexSnapshot } from "../support/note-index-snapshot";

vi.mock("../../src/ui/use-local-today", () => {
  const today = Object.freeze({ year: 1, month: 1, day: 1 });
  return { useLocalToday: () => today };
});

describe("CalendarApp boundary week selection", () => {
  it("selects the first Sunday week using a UI date while opening its original year-zero anchor", async () => {
    const settings = createDefaultSettings();
    settings.locale = "en";
    settings.weekStartDay = "sunday";
    Object.assign(settings.periodicNotes.weekly, {
      enabled: true,
      pattern: "[Weeks]/GGGG-[W]WW",
    });
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
      sourceStatuses: [],
      errors: [],
      eventsByDate: {},
    });
    const open = vi.fn(async () => undefined);
    const noop = async () => undefined;
    const props: CalendarAppProps = {
      noteIndex: { getSnapshot: () => noteSnapshot, subscribe: () => () => undefined } as unknown as NoteIndex,
      icsEventIndex: { getSnapshot: () => icsSnapshot, subscribe: () => () => undefined } as unknown as IcsEventIndex,
      getSettings: () => settings,
      getTranslator: () => createTranslator("en", "en"),
      onOpenPeriodic: open,
      onSetYearHeatmap: noop,
      onSetStatisticDimension: noop,
      onOpenPath: noop,
      onCreateRange: () => undefined,
      onToggleTask: noop,
      onRescheduleTask: noop,
      onOpenTaskSource: noop,
      onOpenDateContextMenu: () => undefined,
      navigationRequest: null,
    };
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    setReactActEnvironment(true);
    try {
      await act(async () => root.render(createElement(CalendarApp, props)));
      const weeks = () => container.querySelectorAll<HTMLButtonElement>(".chrono-notes-week-number-button");
      expect(weeks()[0]?.textContent).toBe("W1");
      expect(weeks()[0]?.getAttribute("aria-pressed")).toBe("false");
      await act(async () => weeks()[0]!.click());
      expect(weeks()[0]?.getAttribute("aria-pressed")).toBe("true");
      expect(open).not.toHaveBeenCalled();
      expect(container.querySelector(".chrono-notes-calendar-picker-trigger")?.textContent).toBe("1");

      await act(async () => weeks()[1]!.click());
      expect(weeks()[0]?.getAttribute("aria-pressed")).toBe("false");
      expect(weeks()[1]?.getAttribute("aria-pressed")).toBe("true");
      expect(open).not.toHaveBeenCalled();

      await act(async () => weeks()[0]!.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
      })));
      expect(open).toHaveBeenCalledExactlyOnceWith({ year: 0, month: 12, day: 31 }, "weekly", "default");
      expect(weeks()[0]?.getAttribute("aria-pressed")).toBe("true");
      const trigger = container.querySelector<HTMLButtonElement>(".chrono-notes-calendar-picker-trigger")!;
      await act(async () => trigger.click());
      expect(container.querySelectorAll(".chrono-notes-year-picker-grid button")).toHaveLength(20);
    } finally {
      await act(async () => root.unmount());
      container.remove();
      setReactActEnvironment(false);
    }
  });
});

function setReactActEnvironment(enabled: boolean): void {
  (globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT: boolean;
  }).IS_REACT_ACT_ENVIRONMENT = enabled;
}
