// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { createTranslator } from "../../src/shared/i18n";
import { CalendarPeriodPickerPopover } from "../../src/ui/calendar/calendar-period-picker-popover";

it("keeps a Persian month button's label, selection and opened note on the same Gregorian month", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement("div");
  const anchor = document.createElement("button");
  document.body.append(anchor, container);
  const root = createRoot(container);
  const onSelectMonth = vi.fn();
  const onOpenPeriodic = vi.fn(async () => undefined);
  try {
    await act(async () => root.render(createElement(CalendarPeriodPickerPopover, {
      kind: "month", year: 2026, month: 7,
      today: { year: 2026, month: 7, day: 20 },
      selectedQuarter: null, quarterNameMode: "number",
      anchorRef: { current: anchor }, translator: createTranslator("fa", "en"),
      onSelectYear: vi.fn(), onSelectMonth, onSelectQuarter: vi.fn(),
      onOpenPeriodic, onClose: vi.fn(),
    })));
    const buttons = [...container.querySelectorAll<HTMLButtonElement>(".chrono-notes-month-picker-row button")];
    const january = buttons.find((button) => button.textContent === "ژانویه");
    const july = buttons.find((button) => button.textContent === "ژوئیه");
    expect(january).toBeDefined();
    expect(july?.getAttribute("aria-pressed")).toBe("true");
    expect(january?.getAttribute("aria-label")).toContain("ژانویه");
    await act(async () => january?.click());
    expect(onSelectMonth).toHaveBeenCalledExactlyOnceWith(1);
    await act(async () => january?.dispatchEvent(new MouseEvent("click", {
      bubbles: true, ctrlKey: true,
    })));
    expect(onOpenPeriodic).toHaveBeenCalledExactlyOnceWith(
      { year: 2026, month: 1, day: 1 }, "monthly", "tab",
    );
  } finally {
    await act(async () => root.unmount());
    container.remove();
    anchor.remove();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});
