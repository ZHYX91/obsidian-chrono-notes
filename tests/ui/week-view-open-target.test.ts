import { Window } from "happy-dom";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseLocalDateKey, type LocalDate, type WeekStartDay } from "../../src/core/periodic/periodic-date";
import type { IcsEventIndexSnapshot } from "../../src/features/calendar/ics-event-index";
import { selectWeekCalendar } from "../../src/features/calendar/week-calendar-query";
import { createTranslator } from "../../src/shared/i18n";
import { createDefaultSettings } from "../../src/shared/settings";
import { LongPressGesture } from "../../src/ui/calendar/long-press";
import { WeekView, type WeekViewProps } from "../../src/ui/calendar/week-view";
import { CreateIntervalNoteModal } from "../../src/ui/modals/create-interval-note-modal";
import { installObsidianDomFactories } from "../setup/obsidian-dom";
import { createParsedNoteIndexSnapshot } from "../support/note-index-snapshot";

vi.mock("obsidian", () => ({
  Modal: class {
    readonly titleEl = { setText: vi.fn() };
    readonly contentEl = Object.assign(document.createElement("div"), { empty: () => this.contentEl.replaceChildren() });
    onClose(): void {}
    close(): void { this.onClose(); }
  },
  Setting: class {
    constructor(private readonly container: HTMLElement) {}
    setName(): this { return this; }
    addText(configure: (text: unknown) => void): this {
      const input = this.container.createEl("input");
      configure({
        setPlaceholder: vi.fn().mockReturnThis(),
        setValue(value: string) { input.value = value; return this; },
        onChange(callback: (value: string) => void) { input.oninput = () => callback(input.value); },
      });
      return this;
    }
    addButton(configure: (button: unknown) => void): this {
      const button = this.container.createEl("button");
      configure({
        setButtonText(value: string) { button.textContent = value; return this; },
        setCta: vi.fn().mockReturnThis(),
        onClick(callback: () => void) { button.onclick = callback; },
      });
      return this;
    }
  },
}));

const DISABLED_ICS: IcsEventIndexSnapshot = Object.freeze({
  version: 0,
  contentVersion: 0,
  state: "disabled",
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

describe("WeekView note actions", () => {
  let container: HTMLDivElement;
  let root: Root;
  let longPress: LongPressGesture;

  beforeEach(() => {
    const testWindow = new Window();
    installObsidianDomFactories(testWindow.document as unknown as Document);
    vi.stubGlobal("window", testWindow);
    vi.stubGlobal("document", testWindow.document);
    vi.stubGlobal("Event", testWindow.Event);
    vi.stubGlobal("MouseEvent", testWindow.MouseEvent);
    setReactActEnvironment(true);
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    longPress = new LongPressGesture({
      setTimeout: (callback, delay) => Number(setTimeout(callback, delay)),
      clearTimeout: (handle) => clearTimeout(handle),
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    longPress.dispose();
    container.remove();
    vi.useRealTimers();
    setReactActEnvironment(false);
    vi.unstubAllGlobals();
  });

  it.each([
    { name: "ordinary click", type: "click", options: {}, target: "default" },
    { name: "Ctrl click", type: "click", options: { ctrlKey: true }, target: "tab" },
    { name: "Cmd click", type: "click", options: { metaKey: true }, target: "tab" },
    { name: "middle click", type: "auxclick", options: { button: 1 }, target: "tab" },
  ] as const)("uses the requested target for $name", async ({ type, options, target }) => {
    const { button, query, onOpenPeriodic } = await renderWeeklyNote();

    await dispatch(button, new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      ...options,
    }));

    expect(onOpenPeriodic).toHaveBeenCalledExactlyOnceWith(query.weekStart, "weekly", target);
  });

  it("opens once on long press and consumes only the following synthetic click", async () => {
    const { button, query, onOpenPeriodic } = await renderWeeklyNote();

    await dispatch(button, new Event("touchstart", { bubbles: true }));
    await act(async () => vi.advanceTimersByTime(500));
    await dispatch(button, new Event("touchend", { bubbles: true }));
    await dispatch(button, new MouseEvent("click", { bubbles: true, cancelable: true }));

    expect(onOpenPeriodic).toHaveBeenCalledExactlyOnceWith(query.weekStart, "weekly", "default");

    await dispatch(button, new MouseEvent("click", { bubbles: true, ctrlKey: true }));

    expect(onOpenPeriodic).toHaveBeenCalledTimes(2);
    expect(onOpenPeriodic).toHaveBeenLastCalledWith(query.weekStart, "weekly", "tab");
  });

  it.each([
    { selected: { year: 2026, month: 11, day: 20 }, weekStartDay: "monday", start: "2026-11-16", end: "2026-11-22" },
    { selected: { year: 2026, month: 12, day: 1 }, weekStartDay: "monday", start: "2026-11-30", end: "2026-12-06" },
    { selected: { year: 2027, month: 1, day: 1 }, weekStartDay: "sunday", start: "2026-12-27", end: "2027-01-02" },
  ] as const)("prefills the range dialog with the displayed week $start through $end", async ({ selected, weekStartDay, start, end }) => {
    const { inputs, submit, click } = await openWeekRange(selected, weekStartDay);
    expect(inputs.map((input) => input.value)).toEqual([start, end]);
    click("Continue");
    expect(submit).toHaveBeenCalledExactlyOnceWith(parseLocalDateKey(start), parseLocalDateKey(end));
  });

  it("lets the user change the week's endpoints or cancel without submitting", async () => {
    const selected = { year: 2026, month: 11, day: 20 };
    const dialog = await openWeekRange(selected, "monday");
    for (const [index, value] of ["2026-11-18", "2026-11-24"].entries()) {
      dialog.inputs[index]!.value = value;
      dialog.inputs[index]!.dispatchEvent(new Event("input"));
    }
    dialog.click("Continue");
    expect(dialog.submit).toHaveBeenCalledExactlyOnceWith(
      { year: 2026, month: 11, day: 18 }, { year: 2026, month: 11, day: 24 },
    );
    const cancelled = await openWeekRange(selected, "monday");
    cancelled.click("Cancel");
    expect(cancelled.cancel).toHaveBeenCalledOnce();
    expect(cancelled.submit).not.toHaveBeenCalled();
  });

  async function openWeekRange(selected: LocalDate, weekStartDay: WeekStartDay) {
    const submit = vi.fn();
    const cancel = vi.fn();
    const dialog = document.createElement("div");
    await renderWeeklyNote(selected, weekStartDay, (start: LocalDate, end?: LocalDate) => {
      const modal = new CreateIntervalNoteModal({} as never, start, createTranslator("en", "en-US"), submit, cancel, end);
      dialog.append(modal.contentEl);
      modal.onOpen();
    });
    await act(async () => container.querySelector<HTMLButtonElement>(".chrono-notes-week-create-range")!.click());
    return {
      submit, cancel, inputs: Array.from(dialog.querySelectorAll("input")),
      click: (label: string) => Array.from(dialog.querySelectorAll("button")).find((button) => button.textContent === label)!.click(),
    };
  }

  async function renderWeeklyNote(
    selected = { year: 2026, month: 10, day: 23 },
    weekStartDay: WeekStartDay = "monday",
    onCreateRange: WeekViewProps["onCreateRange"] = () => undefined,
  ) {
    const settings = createDefaultSettings();
    const query = selectWeekCalendar(
      selected,
      createParsedNoteIndexSnapshot({}, 1),
      DISABLED_ICS,
      {
        locale: "en-US",
        weekStartDay,
        today: selected,
        calendarExtensions: [],
        holidayRegions: [],
        daily: { enabled: true, pattern: "[Daily]/YYYY-MM-DD" },
        weekly: { enabled: true, pattern: "[Weekly]/GGGG-[W]WW" },
        rangeNotes: settings.rangeNotes,
      },
    );
    const onOpenPeriodic = vi.fn<WeekViewProps["onOpenPeriodic"]>(async () => undefined);
    await act(async () => root.render(createElement(WeekView, {
      query,
      translator: createTranslator("en", "en-US"),
      selectionKind: "day",
      selectedDate: selected,
      today: selected,
      weekStartDay,
      showNoteIndicators: true,
      showTaskProgress: true,
      activePreviewKey: null,
      previewId: "preview",
      longPress,
      onSelectDate: () => undefined,
      onOpenPeriodic,
      onOpenPath: async () => undefined,
      onCreateRange,
      onToggleTask: async () => undefined,
      onRescheduleTask: async () => undefined,
      onOpenTaskSource: async () => undefined,
      onSchedulePreview: () => undefined,
      onDismissPreview: () => undefined,
      onOpenDateContextMenu: () => undefined,
    })));
    const button = container.querySelector<HTMLButtonElement>(".chrono-notes-weekly-note");
    if (button === null) throw new Error("Expected weekly-note entry");
    return { button, query, onOpenPeriodic };
  }
});

async function dispatch(target: EventTarget, event: Event): Promise<void> {
  await act(async () => target.dispatchEvent(event));
}

function setReactActEnvironment(enabled: boolean): void {
  (globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT: boolean;
  }).IS_REACT_ACT_ENVIRONMENT = enabled;
}
