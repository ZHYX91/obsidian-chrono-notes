import { Window } from "happy-dom";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createTranslator } from "../../src/shared/i18n";
import {
  buildMonthPickerRows,
  getYearPickerWindow,
  resolvePeriodPickerKeyboardAction,
  resolvePeriodPickerAction,
  shiftYearPickerWindow,
} from "../../src/ui/calendar/calendar-period-picker";
import { CalendarPeriodPickerPopover } from "../../src/ui/calendar/calendar-period-picker-popover";
import { readPluginStyles } from "../support/plugin-styles";

const styles = readPluginStyles();

describe("calendar period picker", () => {
  it.each([
    [2001, 2001, 2020],
    [2020, 2001, 2020],
    [2021, 2021, 2040],
    [2040, 2021, 2040],
    [2041, 2041, 2060],
  ])("aligns year %i to a stable 20-year window", (year, start, end) => {
    const result = getYearPickerWindow(year);

    expect(result.start).toBe(start);
    expect(result.end).toBe(end);
    expect(result.years).toHaveLength(20);
    expect(result.years[0]).toBe(start);
    expect(result.years.at(-1)).toBe(end);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.years)).toBe(true);
  });

  it("moves an existing year window by complete 20-year pages", () => {
    expect(shiftYearPickerWindow(getYearPickerWindow(2026), -1)).toEqual(
      getYearPickerWindow(2001),
    );
    expect(shiftYearPickerWindow(getYearPickerWindow(2026), 1)).toEqual(
      getYearPickerWindow(2041),
    );
  });

  it("builds four frozen quarter rows with their canonical month anchors", () => {
    const rows = buildMonthPickerRows(
      (quarter) => `Q${quarter}`,
      (month) => `M${month}`,
    );

    expect(rows).toEqual([
      { quarter: 1, quarterLabel: "Q1", months: [{ month: 1, label: "M1" }, { month: 2, label: "M2" }, { month: 3, label: "M3" }] },
      { quarter: 2, quarterLabel: "Q2", months: [{ month: 4, label: "M4" }, { month: 5, label: "M5" }, { month: 6, label: "M6" }] },
      { quarter: 3, quarterLabel: "Q3", months: [{ month: 7, label: "M7" }, { month: 8, label: "M8" }, { month: 9, label: "M9" }] },
      { quarter: 4, quarterLabel: "Q4", months: [{ month: 10, label: "M10" }, { month: 11, label: "M11" }, { month: 12, label: "M12" }] },
    ]);
    expect(Object.isFrozen(rows)).toBe(true);
    expect(rows.every((row) => Object.isFrozen(row) && Object.isFrozen(row.months))).toBe(true);
  });

  it("uses the configured Chinese quarter labels in the month picker", () => {
    const markup = renderToStaticMarkup(createElement(CalendarPeriodPickerPopover, {
      kind: "month",
      year: 2026,
      month: 7,
      today: { year: 2026, month: 7, day: 20 },
      selectedQuarter: null,
      quarterNameMode: "chinese",
      anchorRef: { current: null },
      translator: createTranslator("en", "en"),
      onSelectYear: () => undefined,
      onSelectMonth: () => undefined,
      onSelectQuarter: () => undefined,
      onOpenPeriodic: async () => undefined,
      onClose: () => undefined,
    }));

    for (const label of ["春", "夏", "秋", "冬"]) {
      expect(markup).toContain(`>${label}</button>`);
    }
    expect(markup).not.toContain(">Q1</button>");
  });

  it("marks current and selected periods with independent semantics", () => {
    const yearDocument = renderPicker({
      kind: "year",
      year: 2025,
      month: 8,
      today: { year: 2026, month: 7, day: 20 },
    });
    expectCurrentAndSelected(yearDocument, "2026", "2025");

    const monthDocument = renderPicker({
      kind: "month",
      year: 2026,
      month: 8,
      today: { year: 2026, month: 7, day: 20 },
    });
    expectCurrentAndSelected(monthDocument, "Jul", "Aug");

    const otherYearDocument = renderPicker({
      kind: "month",
      year: 2025,
      month: 7,
      today: { year: 2026, month: 7, day: 20 },
    });
    expect(otherYearDocument.querySelector('[aria-current="true"]')).toBeNull();
  });

  it("allows current and selected to coexist without merging their semantics", () => {
    const document = renderPicker({
      kind: "year",
      year: 2026,
      month: 7,
      today: { year: 2026, month: 7, day: 20 },
    });
    const target = document.querySelector('[aria-current="true"]');

    expect(target?.classList.contains("is-current")).toBe(true);
    expect(target?.classList.contains("is-selected")).toBe(true);
    expect(target?.getAttribute("aria-pressed")).toBe("true");
    expect(target?.getAttribute("aria-label")).toBe(
      "Select 2026 (current)",
    );
  });

  it("uses accent text only for current and an outline only for selection", () => {
    const baseRule = styles.match(
      /\.chrono-notes-period-picker button\s*\{([^}]*)\}/s,
    )?.[1] ?? "";
    const currentRule = styles.match(
      /\.chrono-notes-period-picker button\.is-current\s*\{([^}]*)\}/s,
    )?.[1] ?? "";
    const selectedRule = styles.match(
      /\.chrono-notes-period-picker button\.is-selected\s*\{([^}]*)\}/s,
    )?.[1] ?? "";
    expect(baseRule).toContain("color: var(--text-normal);");
    expect(currentRule.trim()).toBe("color: var(--text-accent);");
    expect(selectedRule).toContain(
      "box-shadow: inset 0 0 0 2px var(--interactive-accent) !important;",
    );
    expect(selectedRule).not.toContain("color:");
    expect(selectedRule).not.toContain("background:");
    expect(styles).not.toMatch(/week-picker-grid[^}]*is-current::after/);
  });

  it.each([
    [{ button: 0, ctrlKey: false, metaKey: false, detail: 1 }, "select"],
    [{ button: 0, ctrlKey: false, metaKey: false, detail: 2 }, "open-default"],
    [{ button: 0, ctrlKey: true, metaKey: false, detail: 1 }, "open-tab"],
    [{ button: 0, ctrlKey: false, metaKey: true, detail: 1 }, "open-tab"],
    [{ button: 1, ctrlKey: false, metaKey: false, detail: 1 }, "open-tab"],
    [{ button: 2, ctrlKey: false, metaKey: false, detail: 1 }, "ignore"],
  ] as const)("maps pointer input %# to %s", (input, expected) => {
    expect(resolvePeriodPickerAction(input)).toBe(expected);
  });

  it.each([
    [{ key: "Enter", shiftKey: true, ctrlKey: false, metaKey: false }, "open-default"],
    [{ key: "Enter", shiftKey: false, ctrlKey: true, metaKey: false }, "open-tab"],
    [{ key: "Enter", shiftKey: false, ctrlKey: false, metaKey: true }, "open-tab"],
    [{ key: "Enter", shiftKey: false, ctrlKey: false, metaKey: false }, null],
    [{ key: "Space", shiftKey: true, ctrlKey: false, metaKey: false }, null],
  ] as const)("maps keyboard input %# to %s", (input, expected) => {
    expect(resolvePeriodPickerKeyboardAction(input)).toBe(expected);
  });
});

function renderPicker(input: Readonly<{
  kind: "year" | "month";
  year: number;
  month: number;
  today: Readonly<{ year: number; month: number; day: number }>;
}>) {
  const markup = renderToStaticMarkup(createElement(CalendarPeriodPickerPopover, {
    ...input,
    selectedQuarter: null,
    quarterNameMode: "number",
    anchorRef: { current: null },
    translator: createTranslator("en", "en"),
    onSelectYear: () => undefined,
    onSelectMonth: () => undefined,
    onSelectQuarter: () => undefined,
    onOpenPeriodic: async () => undefined,
    onClose: () => undefined,
  }));
  const window = new Window();
  window.document.body.innerHTML = markup;
  return window.document;
}

function expectCurrentAndSelected(
  document: ReturnType<typeof renderPicker>,
  currentText: string,
  selectedText: string,
) {
  const current = document.querySelector('[aria-current="true"]');
  const selected = document.querySelector('[aria-pressed="true"]');
  expect(current?.textContent).toBe(currentText);
  expect(current?.getAttribute("aria-label")).toContain("(current)");
  expect(current?.classList.contains("is-current")).toBe(true);
  expect(current?.classList.contains("is-selected")).toBe(false);
  expect(selected?.textContent).toBe(selectedText);
  expect(selected?.classList.contains("is-selected")).toBe(true);
  expect(selected?.classList.contains("is-current")).toBe(false);
}
