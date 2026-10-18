// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatPeriodicNotePath } from "../../src/core/periodic/periodic-note-path";
import { IcsEventIndex } from "../../src/features/calendar/ics-event-index";
import { createTranslator } from "../../src/shared/i18n";
import { createDefaultSettings, type ChronoNotesSettings } from "../../src/shared/settings";
import { CalendarApp, type CalendarAppProps } from "../../src/ui/calendar/calendar-app";
import { CalendarWeekPickerPopover } from "../../src/ui/calendar/calendar-week-picker-popover";
import { createParsedNoteIndexSnapshot } from "../support/note-index-snapshot";

vi.mock("../../src/ui/use-local-today", () => ({
  useLocalToday: () => TODAY,
}));
const TODAY = Object.freeze({ year: 2026, month: 10, day: 17 });

describe("calendar settings refresh", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    ["month", "daily", "[Daily]/YYYY-MMMM-DD", ".chrono-notes-day[aria-labelledby$='-2026-10-17-label']"],
    ["week", "daily", "[Daily]/YYYY-MMMM-DD", ".chrono-notes-week-day[aria-labelledby$='-2026-10-17-label']"],
    ["year", "monthly", "[Monthly]/YYYY-MMMM", '[data-period-kind="month"][data-period-month="10"]'],
    ["century", "yearly", "[Yearly]/YYYY-MMMM", '[data-period-kind="year"][data-period-year="2026"]'],
  ] as const)("refreshes %s note state when only %s path language changes", async (
    mode, noteType, pattern, selector,
  ) => {
    const settings = createDefaultSettings();
    settings.locale = "en";
    settings.yearViewHeatmap = false;
    settings.periodicNotes[noteType] = {
      enabled: true, pattern, templatePath: "", pathLocale: "en",
    };
    const rule = { noteType, ...settings.periodicNotes[noteType] };
    const options = { locale: "en", weekStartDay: settings.weekStartDay };
    const englishPath = formatPeriodicNotePath(TODAY, rule, options);
    const chinesePath = formatPeriodicNotePath(TODAY, { ...rule, pathLocale: "zh-CN" }, options);
    expect(englishPath).not.toBeNull();
    expect(chinesePath).not.toBeNull();
    expect(chinesePath).not.toBe(englishPath);
    const props = getProps(settings, { [englishPath!]: "# Existing note\nBody" });
    await render(props);
    if (mode !== "month") {
      const button = [...container.querySelectorAll<HTMLButtonElement>(".chrono-notes-view-mode button")]
        .find((item) => item.textContent === props.getTranslator().t(`calendar.view.${mode}`));
      expect(button).toBeDefined();
      await act(async () => button!.click());
    }
    const getState = () => container.querySelector(selector)?.getAttribute("data-note-state");
    expect(getState()).toBe("has-body");

    settings.periodicNotes[noteType].pathLocale = "zh-CN";
    await render({ ...props, getSettings: () => settings });
    expect(getState()).toBe("missing");

    settings.periodicNotes[noteType].pathLocale = "en";
    await render({ ...props, getSettings: () => settings });
    expect(getState()).toBe("has-body");
  });

  it.each(["ar", "fa", "he"] as const)("moves to the visual right neighbor in %s", async (locale) => {
    const settings = createDefaultSettings();
    settings.locale = locale;
    await render(getProps(settings, {}));
    const day = container.querySelector<HTMLButtonElement>(
      '.chrono-notes-day[aria-labelledby$="-2026-10-15-label"]',
    )!;
    expect(container.querySelector(".chrono-notes-calendar")?.getAttribute("dir")).toBe("rtl");
    await act(async () => day.click());
    await act(async () => {
      day.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    expect(container.querySelector('.chrono-notes-day[aria-selected="true"]')
      ?.getAttribute("aria-labelledby")).toContain("2026-10-14");
  });

  it.each(["ar", "fa", "he"] as const)("moves week picker focus visually in %s", async (locale) => {
    await act(async () => root.render(createElement(CalendarWeekPickerPopover, {
      kind: "week", weekYear: 2026, weekNumber: 21, weekStartDay: "monday", today: TODAY,
      anchorRef: { current: null }, translator: createTranslator(locale, "en"),
      onSelectWeekYear: () => undefined, onSelectWeek: () => undefined, onClose: () => undefined,
    })));
    const current = container.querySelector<HTMLButtonElement>('[data-week-index="20"]')!;
    expect(container.querySelector('[role="dialog"]')?.getAttribute("dir")).toBe("rtl");
    expect(document.activeElement).toBe(current);
    await act(async () => {
      current.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    expect(document.activeElement?.getAttribute("data-week-index")).toBe("19");
    await act(async () => {
      document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", {
        key: "ArrowLeft", bubbles: true,
      }));
    });
    expect(document.activeElement).toBe(current);
  });

  async function render(props: CalendarAppProps): Promise<void> {
    await act(async () => root.render(createElement(CalendarApp, props)));
  }
});

function getProps(settings: ChronoNotesSettings, contents: Record<string, string>): CalendarAppProps {
  const snapshot = createParsedNoteIndexSnapshot(contents, 1);
  return {
    noteIndex: {
      getSnapshot: () => snapshot,
      subscribe: () => () => undefined,
    } as unknown as CalendarAppProps["noteIndex"],
    icsEventIndex: new IcsEventIndex({ read: async () => "" }),
    getSettings: () => settings,
    getTranslator: () => createTranslator(settings.locale, "en"),
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
