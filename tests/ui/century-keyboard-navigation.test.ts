// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { selectCenturyCalendar } from "../../src/features/calendar/century-calendar-query";
import { createTranslator } from "../../src/shared/i18n";
import { CenturyView } from "../../src/ui/calendar/century-view";
import { LongPressGesture } from "../../src/ui/calendar/long-press";
import { createNoteIndexSnapshot } from "../support/note-index-snapshot";

describe("century keyboard navigation", () => {
  let root: Root;
  let container: HTMLDivElement;
  let longPress: LongPressGesture;
  const onOpen = vi.fn(async () => undefined);
  const onSelect = vi.fn();
  const options = {
    locale: "en", weekStartDay: "monday",
    yearly: { enabled: true, pattern: "[Years]/YYYY" },
    decadal: { enabled: true, pattern: "[Decades]/DEC[s]" },
    century: { enabled: true, pattern: "[Centuries]/[C]CEN" },
  } as const;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    longPress = new LongPressGesture({
      setTimeout: (callback, delay) => window.setTimeout(callback, delay),
      clearTimeout: (handle) => window.clearTimeout(handle),
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    longPress.dispose();
    container.remove();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  });

  const render = async (year = 2026, locale: "en" | "ar" = "en") => {
    await act(async () => root.render(createElement(CenturyView, {
      query: selectCenturyCalendar(year, createNoteIndexSnapshot({}, 1), options),
      revealRequest: { year, revision: 0 },
      translator: createTranslator(locale, "en"),
      today: { year: 2026, month: 9, day: 14 },
      selection: { kind: "year", date: { year: 2026, month: 1, day: 1 } },
      onOpenPeriodic: onOpen, onSelect,
      showNoteIndicators: true, showTaskProgress: true,
      weekStartDay: "monday", longPress, activePreviewKey: null, previewId: "keyboard-preview",
      onSchedulePreview: vi.fn(), onDismissPreview: vi.fn(),
    })));
  };

  const cell = (kind: string, year: number) => {
    const result = container.querySelector<HTMLButtonElement>(
      `[data-period-kind="${kind}"][data-period-year="${year}"]`,
    );
    if (result === null) throw new Error(`Missing ${kind} ${year}`);
    return result;
  };

  const press = async (key: string) => {
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
    await act(async () => document.activeElement?.dispatchEvent(event));
    return event;
  };

  it("exposes one tab stop and navigates years without opening or selecting notes", async () => {
    await render();
    expect(container.querySelectorAll('button[tabindex="0"]')).toHaveLength(1);
    expect(cell("year", 2026).tabIndex).toBe(0);
    await act(async () => cell("year", 2026).focus());
    await press("ArrowRight");
    expect(document.activeElement).toBe(cell("year", 2027));
    await press("ArrowDown");
    expect(document.activeElement).toBe(cell("year", 2032));
    expect(container.querySelectorAll('button[tabindex="0"]')).toHaveLength(1);
    expect(onOpen).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
    expect((await press("Tab")).defaultPrevented).toBe(false);
  });

  it("makes century and decade targets reachable and preserves Enter activation", async () => {
    await render();
    await act(async () => cell("year", 2026).focus());
    await press("Home");
    expect(document.activeElement).toBe(cell("century", 2001));
    await press("ArrowDown");
    expect(document.activeElement).toBe(cell("decade", 2000));
    await press("Enter");
    expect(onOpen).toHaveBeenCalledWith({ year: 2000, month: 1, day: 1 }, "decadal", "default");
    await press("End");
    expect(document.activeElement).toBe(cell("year", 2100));
  });

  it("mirrors horizontal arrows for RTL without changing chronological vertical navigation", async () => {
    await render(2026, "ar");
    await act(async () => cell("year", 2026).focus());
    await press("ArrowLeft");
    expect(document.activeElement).toBe(cell("year", 2027));
    await press("ArrowUp");
    expect(document.activeElement).toBe(cell("year", 2022));
  });

  it("retains keyboard focus on refresh and provides a fallback on another century", async () => {
    await render();
    await act(async () => cell("year", 2026).focus());
    await press("ArrowRight");
    await render();
    expect(cell("year", 2027).tabIndex).toBe(0);
    await render(2126);
    expect(container.querySelectorAll('button[tabindex="0"]')).toHaveLength(1);
    expect(cell("century", 2101).tabIndex).toBe(0);
  });
});
