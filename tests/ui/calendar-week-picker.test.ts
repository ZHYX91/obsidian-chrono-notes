import { Window } from "happy-dom";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createTranslator } from "../../src/shared/i18n";
import {
  getWeekPickerContentBoxWidth,
  getWeekPickerColumnCount,
  resolveWeekPickerNavigation,
  resolveWeekPickerTypeahead,
} from "../../src/ui/calendar/calendar-week-picker";
import { CalendarWeekPickerPopover } from "../../src/ui/calendar/calendar-week-picker-popover";
import { readPluginStyles } from "../support/plugin-styles";

const styles = readPluginStyles();

describe("calendar week picker", () => {
  it("uses three columns from 360 pixels and two columns below it", () => {
    expect(getWeekPickerColumnCount(359)).toBe(2);
    expect(getWeekPickerColumnCount(360)).toBe(3);
    expect(styles).toMatch(
      /\.chrono-notes-week-picker-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,/s,
    );
    expect(styles).toMatch(
      /@container \(max-width:\s*359px\)\s*\{\s*\.chrono-notes-week-picker-grid\s*\{[^}]*repeat\(2,/s,
    );
  });

  it("uses the same content-box width as the CSS container query", () => {
    const belowThreshold = getWeekPickerContentBoxWidth(377, 8, 8, 1, 1);
    const atThreshold = getWeekPickerContentBoxWidth(378, 8, 8, 1, 1);
    expect(belowThreshold).toBe(359);
    expect(getWeekPickerColumnCount(belowThreshold)).toBe(2);
    expect(atThreshold).toBe(360);
    expect(getWeekPickerColumnCount(atThreshold)).toBe(3);
  });

  it.each([
    ["ArrowLeft", 20, 3, 19],
    ["ArrowRight", 20, 3, 21],
    ["ArrowUp", 20, 3, 17],
    ["ArrowDown", 20, 3, 23],
    ["Home", 20, 3, 0],
    ["End", 20, 3, 52],
    ["PageUp", 20, 3, 5],
    ["PageDown", 20, 3, 35],
    ["ArrowDown", 51, 2, 52],
  ] as const)(
    "maps %s from item %i in %i columns to item %i",
    (key, currentIndex, columns, expected) => {
      expect(resolveWeekPickerNavigation({
        key,
        currentIndex,
        itemCount: 53,
        columns,
      })).toBe(expected);
    },
  );

  it("locates one- and two-digit week numbers without allowing W54", () => {
    expect(resolveWeekPickerTypeahead("", "3", 53)).toEqual({
      buffer: "3",
      targetIndex: 2,
    });
    expect(resolveWeekPickerTypeahead("3", "0", 53)).toEqual({
      buffer: "30",
      targetIndex: 29,
    });
    expect(resolveWeekPickerTypeahead("5", "4", 53)).toEqual({
      buffer: "4",
      targetIndex: 3,
    });
    expect(resolveWeekPickerTypeahead("", "x", 53)).toBeNull();
  });

  it("renders all 53 weeks as single focus targets with independent current and selected states", () => {
    const markup = renderToStaticMarkup(createElement(CalendarWeekPickerPopover, {
      kind: "week",
      weekYear: 2026,
      weekNumber: 53,
      weekStartDay: "monday",
      today: { year: 2026, month: 7, day: 20 },
      anchorRef: { current: null },
      translator: createTranslator("en", "en"),
      onSelectWeekYear: () => undefined,
      onSelectWeek: () => undefined,
      onClose: () => undefined,
    }));

    expect(markup.match(/data-week-index=/g)).toHaveLength(53);
    expect(markup).toContain("W01");
    expect(markup).toContain("12/29–1/4");
    expect(markup).toContain("W53");
    expect(markup).toContain("Select week 1, 2026, December 29, 2025–January 4, 2026");
    expect(markup.match(/aria-current="true"/g)).toHaveLength(1);
    expect(markup).toMatch(/class="is-selected"[^>]*data-week-index="52"/);
    expect(markup).toMatch(/class=" is-current"|class="is-current"/);
  });

  it("derives the current ISO week-year from the configured week start", () => {
    const sundayDocument = renderWeekPicker({
      kind: "year",
      weekYear: 2024,
      weekNumber: 1,
      weekStartDay: "sunday",
      today: { year: 2024, month: 12, day: 29 },
    });
    expectCurrentAndSelectedWeekTarget(sundayDocument, "2025", "2024");

    const mondayDocument = renderWeekPicker({
      kind: "year",
      weekYear: 2025,
      weekNumber: 1,
      weekStartDay: "monday",
      today: { year: 2024, month: 12, day: 29 },
    });
    expectCurrentAndSelectedWeekTarget(mondayDocument, "2024", "2025");
  });

  it("keeps current and selected week states orthogonal and contextual", () => {
    const currentDocument = renderWeekPicker({
      kind: "week",
      weekYear: 2026,
      weekNumber: 30,
      weekStartDay: "monday",
      today: { year: 2026, month: 7, day: 20 },
    });
    const target = currentDocument.querySelector('[aria-current="true"]');
    expect(target?.classList.contains("is-current")).toBe(true);
    expect(target?.classList.contains("is-selected")).toBe(true);
    expect(target?.getAttribute("aria-pressed")).toBe("true");
    expect(target?.getAttribute("aria-label")).toContain("(current)");

    const otherWeekYearDocument = renderWeekPicker({
      kind: "week",
      weekYear: 2025,
      weekNumber: 30,
      weekStartDay: "monday",
      today: { year: 2026, month: 7, day: 20 },
    });
    expect(
      otherWeekYearDocument.querySelector('[aria-current="true"]'),
    ).toBeNull();
  });

  it("keeps week rows scrollable and every week target at least 44 pixels high", () => {
    expect(styles).toMatch(
      /\.chrono-notes-week-picker-grid\s*\{[^}]*max-height:[^;]+;[^}]*overflow-y:\s*auto;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-period-picker \.chrono-notes-week-picker-grid > button\s*\{[^}]*min-height:\s*44px;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-period-picker button:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--interactive-accent\);[^}]*outline-offset:\s*1px;/s,
    );
  });
});

function renderWeekPicker(input: Readonly<{
  kind: "year" | "week";
  weekYear: number;
  weekNumber: number;
  weekStartDay: "monday" | "sunday";
  today: Readonly<{ year: number; month: number; day: number }>;
}>) {
  const markup = renderToStaticMarkup(createElement(CalendarWeekPickerPopover, {
    ...input,
    anchorRef: { current: null },
    translator: createTranslator("en", "en"),
    onSelectWeekYear: () => undefined,
    onSelectWeek: () => undefined,
    onClose: () => undefined,
  }));
  const window = new Window();
  window.document.body.innerHTML = markup;
  return window.document;
}

function expectCurrentAndSelectedWeekTarget(
  document: ReturnType<typeof renderWeekPicker>,
  currentText: string,
  selectedText: string,
) {
  const current = document.querySelector('[aria-current="true"]');
  const selected = document.querySelector('[aria-pressed="true"]');
  expect(current?.textContent).toBe(currentText);
  expect(current?.classList.contains("is-current")).toBe(true);
  expect(current?.classList.contains("is-selected")).toBe(false);
  expect(current?.getAttribute("aria-label")).toContain("(current)");
  expect(selected?.textContent).toBe(selectedText);
  expect(selected?.classList.contains("is-selected")).toBe(true);
  expect(selected?.classList.contains("is-current")).toBe(false);
}
