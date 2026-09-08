// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { selectCenturyCalendar } from "../../src/features/calendar/century-calendar-query";
import { createTranslator } from "../../src/shared/i18n";
import { CenturyView } from "../../src/ui/calendar/century-view";
import { LongPressGesture } from "../../src/ui/calendar/long-press";
import { createNoteIndexSnapshot, createParsedNoteIndexSnapshot } from "../support/note-index-snapshot";

describe("century calendar cells", () => {
  let root: Root;
  let container: HTMLDivElement;
  let longPress: LongPressGesture;
  const onOpen = vi.fn(async () => undefined);
  const onSelect = vi.fn();
  const onPreview = vi.fn();
  const options = {
    locale: "en", weekStartDay: "monday",
    yearly: { enabled: true, pattern: "[diary]/YYYY" },
    decadal: { enabled: true, pattern: "[diary]/DEC[s]" },
    century: { enabled: true, pattern: "[diary]/[C]CEN" },
  } as const;
  const snapshot = createParsedNoteIndexSnapshot({
    "diary/2000s.md": "existing", "diary/2020s.md": "- [x] Done\n- [ ] Pending\n- [ ] Later",
    "diary/2026.md": "- [x] Done\n- [ ] Pending", "diary/C21.md": "- [x] Done",
  }, 1);
  const revealRequest = { year: 2026, revision: 0 };
  const props = () => ({
    revealRequest,
    translator: createTranslator("en", "en"), today: { year: 2026, month: 9, day: 7 },
    selection: { kind: "year" as const, date: { year: 2026, month: 1, day: 1 } },
    onOpenPeriodic: onOpen, onSelect, showNoteIndicators: true, showTaskProgress: true,
    weekStartDay: "monday" as const, longPress, activePreviewKey: null, previewId: "preview",
    onSchedulePreview: onPreview, onDismissPreview: vi.fn(),
  });

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
    vi.useRealTimers();
    container.remove();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  });
  const cell = (kind: string, year: number) => {
    const element = container.querySelector<HTMLButtonElement>(`[data-period-kind="${kind}"][data-period-year="${year}"]`);
    if (element === null) throw new Error(`Missing ${kind} ${year}`);
    return element;
  };
  const render = async (query = selectCenturyCalendar(2026, snapshot, options), overrides = {}) => {
    await act(async () => root.render(createElement(CenturyView, { query, ...props(), ...overrides })));
  };
  const enter = async (element: HTMLButtonElement) => {
    await act(async () => element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
  };

  it("uses one shared target per year, decade and century and preserves century boundaries", async () => {
    await render();
    expect(container.querySelectorAll('[data-period-kind="year"]')).toHaveLength(100);
    expect(container.querySelectorAll('[data-period-kind="decade"]')).toHaveLength(11);
    expect(container.querySelectorAll('[data-period-kind="century"]')).toHaveLength(1);
    expect(container.querySelectorAll("button")).toHaveLength(112);
    expect(container.querySelectorAll("button button, button svg, button + button[title]")).toHaveLength(0);
    expect(container.querySelector('[data-period-kind="year"][data-period-year="2000"]')).toBeNull();
    expect(cell("year", 2100)).toBeDefined();
    expect(cell("decade", 2000).getAttribute("aria-label")).toContain("Years within this century only");
    expect(cell("decade", 2100).getAttribute("aria-label")).toContain("Years within this century only");
    await act(async () => cell("decade", 2000).click());
    expect(onSelect).toHaveBeenLastCalledWith("decade", { year: 2000, month: 1, day: 1 });
    expect(onOpen).not.toHaveBeenCalled();
    await act(async () => cell("decade", 2000).dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
    expect(onOpen).toHaveBeenLastCalledWith({ year: 2000, month: 1, day: 1 }, "decadal", "default");
    await enter(cell("century", 2001));
    expect(onOpen).toHaveBeenLastCalledWith({ year: 2001, month: 1, day: 1 }, "century", "default");
  });

  it("keeps decade positions stable and leaves out-of-century slots empty", async () => {
    await render();
    const groups = container.querySelectorAll(".chrono-notes-long-period-years");
    expect(groups).toHaveLength(11);
    for (const group of groups) expect(group.children).toHaveLength(10);
    expect(groups[0]?.children[0]?.getAttribute("aria-hidden")).toBe("true");
    expect(groups[0]?.children[1]).toBe(cell("year", 2001));
    expect(groups[0]?.children[5]).toBe(cell("year", 2005));
    expect(groups[10]?.children[0]).toBe(cell("year", 2100));
    expect(groups[10]?.querySelectorAll(":scope > [aria-hidden=true]")).toHaveLength(9);
    expect(container.querySelectorAll(".chrono-notes-long-period-decade button")).toHaveLength(11);

  });

  it("shows note dots and actual task progress for each enabled note type", async () => {
    await render();
    expect(cell("decade", 2000).querySelector('.is-state[data-note-state="has-body"]')).not.toBeNull();
    expect(cell("decade", 2020).querySelector('.is-progress.is-unfinished[data-progress-text="1/3"]')).not.toBeNull();
    expect(cell("year", 2025).querySelector('.is-state[data-note-state="missing"]')).not.toBeNull();
    expect(cell("year", 2026).querySelector('.is-progress.is-unfinished[data-progress-text="1/2"]')).not.toBeNull();
    expect(cell("year", 2026).querySelector<HTMLElement>(".chrono-notes-calendar-indicator-fill")?.style.width).toBe("50%");
    expect(cell("century", 2001).querySelector('.is-progress.is-complete[data-progress-text="1/1"]')).not.toBeNull();
    expect(cell("year", 2026).getAttribute("aria-pressed")).toBe("true");
    expect(cell("year", 2026).getAttribute("aria-current")).toBe("true");
    expect(cell("century", 2001).getAttribute("aria-pressed")).toBe("false");
    expect(cell("century", 2001).getAttribute("aria-current")).toBe("true");
  });

  it("reveals boundary decades and preserves scrolling across note-index refreshes", async () => {
    const scroll = vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => undefined);
    const frame = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    try {
      const request = { year: 2000, revision: 1 };
      await render(undefined, { revealRequest: request });
      expect((scroll.mock.contexts.at(-1) as HTMLElement).dataset.decadeYear).toBe("2000");
      expect(scroll).toHaveBeenCalledWith({ block: "center" });
      await render(selectCenturyCalendar(2026, createNoteIndexSnapshot({}, 2), options), { revealRequest: request });
      expect(scroll).toHaveBeenCalledOnce();
      await render(undefined, { revealRequest: { year: 2100, revision: 2 } });
      expect((scroll.mock.contexts.at(-1) as HTMLElement).dataset.decadeYear).toBe("2100");
      await render(selectCenturyCalendar(9999, snapshot, options), { revealRequest: { year: 9999, revision: 3 } });
      expect((scroll.mock.contexts.at(-1) as HTMLElement).dataset.decadeYear).toBe("9990");
    } finally {
      scroll.mockRestore();
      frame.mockRestore();
    }
  });

  it("honors the shared note-indicator and task-progress settings", async () => {
    const query = selectCenturyCalendar(2026, snapshot, options);
    await render(query, { showTaskProgress: false });
    expect(container.querySelector(".is-progress")).toBeNull();
    expect(cell("year", 2026).querySelector(".is-state")).not.toBeNull();
    await render(query, { showNoteIndicators: false });
    expect(container.querySelector(".chrono-notes-calendar-indicator")).toBeNull();
    expect(container.querySelector(".chrono-notes-period-cell-status")).toBeNull();
    expect(cell("year", 2026).getAttribute("aria-label")).toContain("1/2");
  });

  it("omits unconfigured parent entries without hiding configured year states or adding settings actions", async () => {
    await render(selectCenturyCalendar(2026, snapshot, {
      ...options, decadal: { ...options.decadal, enabled: false }, century: { ...options.century, enabled: false },
    }));
    expect(container.querySelector('[data-period-kind="century"]')).toBeNull();
    expect(container.textContent).not.toMatch(/Configure|Create|Open/);
    expect(cell("decade", 2020).querySelector(".chrono-notes-calendar-indicator")).toBeNull();
    await enter(cell("decade", 2020));
    expect(onOpen).not.toHaveBeenCalled();
    expect(cell("year", 2026).querySelector(".is-progress")).not.toBeNull();
    await enter(cell("year", 2026));
    expect(onOpen).toHaveBeenCalledWith({ year: 2026, month: 1, day: 1 }, "yearly", "default");
  });

  it("keeps opening available while indexing and uses the note command for creation", async () => {
    await render(selectCenturyCalendar(2026, createNoteIndexSnapshot({}, 2, "indexing"), options));
    expect(cell("decade", 2020).dataset.noteState).toBe("indexing");
    await enter(cell("decade", 2020));
    expect(onOpen).toHaveBeenCalledWith({ year: 2020, month: 1, day: 1 }, "decadal", "default");
  });

  it("retains Ctrl/Cmd and middle-click note shortcuts", async () => {
    await render();
    for (const key of ["ctrlKey", "metaKey"]) {
      await act(async () => cell("year", 2026).dispatchEvent(new MouseEvent("click", { bubbles: true, [key]: true })));
      expect(onOpen).toHaveBeenLastCalledWith({ year: 2026, month: 1, day: 1 }, "yearly", "tab");
    }
    await act(async () => cell("decade", 2020).dispatchEvent(new MouseEvent("auxclick", { bubbles: true, button: 1 })));
    expect(onOpen).toHaveBeenLastCalledWith({ year: 2020, month: 1, day: 1 }, "decadal", "tab");
  });

  it("uses the shared note preview with full period identity and statistics", async () => {
    await render();
    await act(async () => cell("year", 2026).dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    expect(onPreview).toHaveBeenCalledWith("2026", expect.objectContaining({
      periodicNoteType: "yearly", previewTitle: "2026", statistics: expect.objectContaining({ taskTotal: 2 }),
    }), cell("year", 2026));
    expect(cell("year", 2026).hasAttribute("title")).toBe(false);
  });

  it("opens on touch long press without a subsequent synthetic click changing selection", async () => {
    vi.useFakeTimers();
    await render();
    const target = cell("year", 2026);
    await act(async () => target.dispatchEvent(new Event("touchstart", { bubbles: true })));
    await act(async () => vi.advanceTimersByTime(500));
    expect(onOpen).toHaveBeenCalledOnce();
    await act(async () => target.click());
    expect(onSelect).not.toHaveBeenCalled();
  });
});
