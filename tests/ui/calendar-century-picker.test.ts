// @vitest-environment happy-dom

import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTranslator } from "../../src/shared/i18n";
import { CalendarCenturyPickerPopover } from "../../src/ui/calendar/calendar-century-picker-popover";
import { CalendarPeriodPickerPopover } from "../../src/ui/calendar/calendar-period-picker-popover";
import { CalendarPickerLayer } from "../../src/ui/calendar/calendar-picker-layer";

describe("century picker interaction", () => {
  let root: Root;
  let container: HTMLDivElement;
  let anchor: HTMLButtonElement;
  const onSelect = vi.fn();
  const onClose = vi.fn();
  const onOpen = vi.fn(async () => undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    anchor = document.createElement("button");
    container = document.createElement("div");
    document.body.append(anchor, container);
    anchor.focus();
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    anchor.remove();
    container.remove();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  });

  const render = async (year = 2026, rtl = false) => {
    await act(async () => root.render(createElement(CalendarCenturyPickerPopover, {
      year, currentYear: 2026, anchorRef: { current: anchor },
      translator: createTranslator(rtl ? "ar" : "en", "en"), onSelect, onClose,
    })));
  };
  const cells = () => [...container.querySelectorAll<HTMLButtonElement>(".chrono-notes-long-period-picker-grid button")];
  const key = async (value: string, options = {}) => {
    await act(async () => document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", {
      key: value, bubbles: true, cancelable: true, ...options,
    })));
  };

  it("highlights the selected century and current century independently", async () => {
    await render(2137);
    expect(cells()).toHaveLength(10);
    expect(container.querySelector('[aria-pressed="true"]')?.textContent).toBe("C222101–2200");
    expect(container.querySelector('[aria-current="true"]')?.textContent).toBe("C212001–2100");
    expect(document.activeElement?.textContent).toBe("C222101–2200");
    expect(cells().filter((cell) => cell.tabIndex === 0)).toHaveLength(1);
    await act(async () => cells()[4]?.click());
    expect(onSelect).toHaveBeenCalledWith(2401);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("pages complete centuries and selects C20 with Enter", async () => {
    await render();
    expect(container.querySelector('[role="dialog"]')?.getAttribute("aria-label")).toBe("Choose a century");
    expect(document.activeElement?.textContent).toBe("C212001–2100");
    await key("PageUp");
    expect(container.querySelector("strong")?.textContent).toBe("C11–C20");
    expect(document.activeElement?.textContent).toBe("C111001–1100");
    await key("End");
    expect(document.activeElement?.textContent).toBe("C201901–2000");
    await key("Enter");
    expect(onSelect).toHaveBeenLastCalledWith(1901);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps keyboard paging bounded and restores the trigger focus on dismissal", async () => {
    await render(1);
    expect(container.querySelector<HTMLButtonElement>(".chrono-notes-period-picker-nav button")?.disabled).toBe(true);
    await key("PageUp");
    expect(document.activeElement?.textContent).toBe("C11–100");
    await key("Escape");
    expect(onClose).toHaveBeenCalledOnce();
    await act(async () => root.render(null));
    expect(document.activeElement).toBe(anchor);
  });

  it("uses the displayed columns and RTL direction for arrow navigation", async () => {
    await render(2226, true);
    expect(container.querySelector('[role="dialog"]')?.getAttribute("dir")).toBe("rtl");
    await key("ArrowRight");
    expect(document.activeElement?.textContent).toBe("C222101–2200");
    await key("ArrowLeft");
    expect(document.activeElement?.textContent).toBe("C232201–2300");
    const grid = container.querySelector<HTMLElement>(".chrono-notes-long-period-picker-grid");
    if (grid === null) throw new Error("Expected period grid");
    grid.style.gridTemplateColumns = "120px 120px 120px";
    await key("ArrowDown");
    expect(document.activeElement?.textContent).toBe("C262501–2600");
  });

  it("preserves direction, selection and focus through the mobile portal lifecycle", async () => {
    const mount = document.createElement("div");
    const close = vi.fn(() => mount.remove());
    const modalHost = { open: vi.fn(() => {
      document.body.append(mount);
      return { mount, close };
    }) };
    Object.defineProperty(document.body, "hasClass", { configurable: true, value: () => true });
    function MobilePicker() {
      const [open, setOpen] = useState(true);
      const dismiss = () => setOpen(false);
      return open ? createElement(CalendarPickerLayer, {
        modalHost, title: "Choose a century", onClose: dismiss,
        children: createElement(CalendarCenturyPickerPopover, {
          year: 2026, currentYear: 2026, anchorRef: { current: anchor },
          translator: createTranslator("ar", "en"), onSelect, onClose: dismiss,
        }),
      }) : null;
    }
    try {
      await act(async () => root.render(createElement(MobilePicker)));
      expect(modalHost.open).toHaveBeenCalledOnce();
      expect(container.querySelector('[role="dialog"]')).toBeNull();
      expect(mount.querySelector('[role="dialog"]')?.getAttribute("dir")).toBe("rtl");
      expect(document.activeElement?.textContent).toBe("C212001–2100");
      await key("ArrowLeft");
      expect(document.activeElement?.textContent).toBe("C222101–2200");
      await key("Enter");
      expect(onSelect).toHaveBeenCalledWith(2101);
      expect(close).toHaveBeenCalledOnce();
      expect(document.body.contains(mount)).toBe(false);
      expect(document.activeElement).toBe(anchor);
    } finally {
      Reflect.deleteProperty(document.body, "hasClass");
      mount.remove();
    }
  });

  it("keeps modified clicks as period selection while retaining legacy year-note shortcuts", async () => {
    await render();
    await act(async () => cells()[1]?.dispatchEvent(new MouseEvent("click", {
      bubbles: true, ctrlKey: true, detail: 2,
    })));
    expect(onSelect).toHaveBeenCalledWith(2101);
    await act(async () => root.render(createElement(CalendarPeriodPickerPopover, {
      kind: "year", year: 2026, month: 9, today: { year: 2026, month: 9, day: 7 },
      selectedQuarter: null, quarterNameMode: "number", anchorRef: { current: anchor },
      translator: createTranslator("en", "en"), onSelectYear: onSelect,
      onSelectMonth: vi.fn(), onSelectQuarter: vi.fn(), onOpenPeriodic: onOpen, onClose,
    })));
    const year = container.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    await act(async () => year?.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true })));
    expect(onOpen).toHaveBeenCalledWith({ year: 2026, month: 1, day: 1 }, "yearly", "tab");
  });
});
