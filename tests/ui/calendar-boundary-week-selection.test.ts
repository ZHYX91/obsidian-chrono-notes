// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IcsEventIndex } from "../../src/features/calendar/ics-event-index";
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
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  async function mount(
    weekStartDay: "monday" | "sunday",
    navigationRequest: CalendarAppProps["navigationRequest"] = null,
  ) {
    const settings = createDefaultSettings();
    settings.locale = "en";
    settings.weekStartDay = weekStartDay;
    Object.assign(settings.periodicNotes.weekly, {
      enabled: true,
      pattern: "[Weeks]/GGGG-[W]WW",
    });
    const noteSnapshot = createNoteIndexSnapshot({}, 1);
    const open = vi.fn(async () => undefined);
    const noop = async () => undefined;
    const props: CalendarAppProps = {
      noteIndex: { getSnapshot: () => noteSnapshot, subscribe: () => () => undefined } as unknown as NoteIndex,
      icsEventIndex: new IcsEventIndex({ read: async () => "" }),
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
      navigationRequest,
    };
    await act(async () => root.render(createElement(CalendarApp, props)));
    return open;
  }

  it("selects the first Sunday week using a UI date while opening its original year-zero anchor", async () => {
    const open = await mount("sunday");
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
  });

  it.each([
    ["sunday", { year: 1, month: 1, day: 7 }, "previous", "0001-01-01"],
    ["sunday", { year: 1, month: 1, day: 7 }, "week", "0001-01-01"],
    ["sunday", { year: 1, month: 12, day: 30 }, "year", "0001-01-01"],
    ["monday", { year: 9999, month: 12, day: 25 }, "next", "9999-12-31"],
    ["monday", { year: 9999, month: 12, day: 25 }, "week", "9999-12-31"],
    ["monday", { year: 9998, month: 12, day: 26 }, "year", "9999-12-31"],
  ] as const)("keeps the target week reachable with %s / %o / %s", async (start, date, action, expected) => {
    const open = await mount(start, { date, noteType: "daily", revision: 1, mode: "jump" });
    const button = (selector: string) => container.querySelector<HTMLButtonElement>(selector)!;
    await act(async () => button(".chrono-notes-view-mode button").click());
    if (action === "next" || action === "previous") {
      const label = action === "next" ? "Next week" : "Previous week";
      await act(async () => button(`[aria-label="${label}"]`).click());
    } else {
      const triggers = container.querySelectorAll<HTMLButtonElement>(".chrono-notes-calendar-picker-trigger");
      await act(async () => triggers[action === "year" ? 0 : 1]!.click());
      if (action === "year") {
        const year = expected.slice(0, 4) === "0001" ? "1" : "9999";
        const target = [...container.querySelectorAll<HTMLButtonElement>(".chrono-notes-year-picker-grid button")]
          .find(item => item.textContent === year)!;
        await act(async () => target.click());
      } else {
        const index = start === "sunday" ? 0 : 51;
        await act(async () => button(`[data-week-index="${index}"]`).click());
      }
    }
    expect(button('.chrono-notes-week-day[aria-pressed="true"]').getAttribute("aria-labelledby"))
      .toContain(expected);
    expect(open).not.toHaveBeenCalled();
  });
});
