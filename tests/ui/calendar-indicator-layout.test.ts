import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { readPluginStyles } from "../support/plugin-styles";

const styles = readPluginStyles();
const calendarApp = readFileSync(
  new URL("../../src/ui/calendar/calendar-app.tsx", import.meta.url),
  "utf8",
);
const monthView = readFileSync(
  new URL("../../src/ui/calendar/month-view.tsx", import.meta.url),
  "utf8",
);
const calendarDayContent = readFileSync(
  new URL("../../src/ui/calendar/calendar-day-content.tsx", import.meta.url),
  "utf8",
);
const monthDayCell = readFileSync(
  new URL("../../src/ui/calendar/month-day-cell.tsx", import.meta.url),
  "utf8",
);
const monthWeekNumber = readFileSync(
  new URL("../../src/ui/calendar/month-week-number.tsx", import.meta.url),
  "utf8",
);
const yearView = readFileSync(
  new URL("../../src/ui/calendar/year-view.tsx", import.meta.url),
  "utf8",
);
const calendarViewSources = [
  calendarApp,
  calendarDayContent,
  monthDayCell,
  monthView,
  monthWeekNumber,
  yearView,
].join("\n");

function declarationsForSelector(selector: string): string {
  const normalizedSelector = normalizeCss(selector);
  return Array.from(styles.matchAll(/([^{}]+)\{([^{}]*)\}/g))
    .filter((match) => splitSelectors(match[1] ?? "").some(
      (candidate) => normalizeCss(candidate) === normalizedSelector,
    ))
    .map((match) => (match[2] ?? "").trim())
    .join("\n");
}

function normalizeCss(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function splitSelectors(selectorList: string): string[] {
  const selectors: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < selectorList.length; index += 1) {
    const character = selectorList[index];
    if (character === "(" || character === "[") {
      depth += 1;
    } else if (character === ")" || character === "]") {
      depth -= 1;
    } else if (character === "," && depth === 0) {
      selectors.push(selectorList.slice(start, index));
      start = index + 1;
    }
  }
  selectors.push(selectorList.slice(start));
  return selectors;
}

describe("calendar indicator layout", () => {
  it("reserves the month-cell top-right corner exclusively for regional markers", () => {
    expect(styles).toMatch(
      /\.chrono-notes-regional-marker\s*\{[^}]*grid-column:\s*2;[^}]*justify-self:\s*end;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-regional-marker\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-regional-marker\s*\{[^}]*max-width:\s*100%;[^}]*min-width:\s*0;[^}]*overflow:\s*hidden;/s,
    );
    const indicatorRules = styles.match(
      /\.chrono-notes-calendar-indicator[^{}]*\{[^}]*\}/gs,
    ) ?? [];
    expect(indicatorRules.join("\n")).not.toMatch(/right:\s*[0-9]/);
  });

  it("uses a semantic content track for extensions, indicators, holidays, and ICS", () => {
    expect(styles).toMatch(
      /\.chrono-notes-day-content\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-calendar-extensions\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-calendar-extensions\[data-count="2"\]\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/s,
    );
    expect(styles).toMatch(
      /@container \(max-width: 460px\)[\s\S]*?\.chrono-notes-calendar-extensions\[data-count="2"\]\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-calendar-extension-events\s*\{[^}]*display:\s*flex;[^}]*justify-content:\s*center;[^}]*width:\s*100%;/s,
    );
  });

  it("renders month-cell content in the documented semantic order", () => {
    const extensions = calendarDayContent.indexOf(
      'className="chrono-notes-calendar-extensions"',
    );
    const holidays = calendarDayContent.indexOf(
      'className="chrono-notes-holiday-footer"',
      extensions,
    );
    const calendarEvents = calendarDayContent.indexOf(
      'className="chrono-notes-calendar-extension-events"',
      extensions,
    );
    const ics = calendarDayContent.indexOf(
      'className="chrono-notes-ics-list"',
      extensions,
    );
    const details = monthDayCell.indexOf("<CalendarDayCalendarDetails");
    const events = monthDayCell.indexOf("<CalendarDayEvents", details);

    expect(extensions).toBeGreaterThan(-1);
    expect(calendarEvents).toBeGreaterThan(extensions);
    expect(holidays).toBeGreaterThan(calendarEvents);
    expect(ics).toBeGreaterThan(holidays);
    expect(details).toBeGreaterThan(-1);
    expect(events).toBeGreaterThan(details);
  });

  it("uses a dedicated accessory row above a full-width centered date row", () => {
    const dayRule = styles.match(/\.chrono-notes-day\s*\{[^}]*\}/s)?.[0];
    const accessoryRule = styles.match(
      /\.chrono-notes-day-accessories\s*\{[^}]*\}/s,
    )?.[0];
    const statusRule = styles.match(
      /\.chrono-notes-day-status\s*\{[^}]*\}/s,
    )?.[0];
    const indicatorAccessoryRule = styles.match(
      /\.chrono-notes-day-accessories\[data-has-note-indicator="true"\]\s*\{[^}]*\}/s,
    )?.[0];
    const pairedAccessoryRule = styles.match(
      /\.chrono-notes-day-accessories\[data-has-note-indicator="true"\]\[data-has-regional-marker="true"\]\s*\{[^}]*\}/s,
    )?.[0];

    expect(dayRule).toContain("display: grid;");
    expect(dayRule).toContain("grid-template-columns: minmax(0, 1fr);");
    expect(dayRule).toContain("grid-template-rows: subgrid;");
    expect(accessoryRule).toContain("column-gap: 0;");
    expect(accessoryRule).toContain(
      "grid-template-columns: minmax(0, 1fr) minmax(0, max-content);",
    );
    expect(accessoryRule).toContain("width: 100%;");
    expect(indicatorAccessoryRule).toContain(
      "grid-template-columns: minmax(8px, 1fr) minmax(0, max-content);",
    );
    expect(pairedAccessoryRule).toContain("column-gap: 4px;");
    expect(statusRule).toContain("grid-column: 1;");
    expect(statusRule).toContain("justify-self: stretch;");
    expect(styles).toMatch(
      /\.chrono-notes-day-number\s*\{[^}]*align-self:\s*center;[^}]*width:\s*100%;/s,
    );
    expect(styles).not.toMatch(/\.chrono-notes-day-number\s*\{[^}]*transform:/s);
  });

  it("provides one fixed top slot for month, week, and year cells", () => {
    for (const selector of [
      ".chrono-notes-day-status > .chrono-notes-calendar-indicator.is-top",
      ".chrono-notes-year-period-status > .chrono-notes-calendar-indicator.is-top",
      ".chrono-notes-week-number-status > .chrono-notes-calendar-indicator.is-top",
    ]) {
      expect(styles).toContain(selector);
    }
    expect(styles).not.toContain(".chrono-notes-calendar-indicator.is-vertical");
    expect(calendarViewSources).not.toContain('placement="below"');
    expect(calendarViewSources).not.toContain('placement="left"');
    expect(calendarDayContent).toContain('className="chrono-notes-day-status"');
    expect(calendarDayContent).toContain('dir="ltr"');
    expect(calendarDayContent).toContain("dir={translator.direction}");
  });

  it("overlays week-number and year status without moving their centered labels", () => {
    expect(styles).toMatch(
      /\.chrono-notes-week-number-button\s*\{[^}]*justify-content:\s*center;[^}]*position:\s*relative;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-week-number-status\s*\{[^}]*min-height:\s*0;[^}]*position:\s*absolute;[^}]*top:\s*6px;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-year-period\s*\{[^}]*justify-content:\s*center;[^}]*position:\s*relative;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-year-period-status\s*\{[^}]*min-height:\s*0;[^}]*position:\s*absolute;[^}]*top:\s*4px;/s,
    );
    expect(monthWeekNumber).toContain(
      'showNoteIndicators && note.noteState !== "not-configured"',
    );
    expect(yearView).toContain(
      'showNoteIndicators && summary.noteState !== "not-configured"',
    );
    expect(yearView).toContain("showNoteIndicators={false}");
  });

  it("keeps the week-number control in a separate rail with a dedicated gap", () => {
    expect(styles).toMatch(
      /\.chrono-notes-month-grid\s*\{[^}]*grid-template-columns:\s*minmax\(34px, 0\.6fr\) var\(--chrono-notes-week-date-gap\) repeat\(7, minmax\(28px, 1fr\)\);/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-week-number\s*\{[^}]*min-width:\s*0;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-week-number-button\s*\{[^}]*width:\s*100%;/s,
    );
    expect(monthView).toContain("query.weeks.map");
    expect(monthView).toContain("<MonthWeekNumber");
    expect(monthView.match(/className="chrono-notes-week-date-spacer"/g)).toHaveLength(2);
    expect(calendarApp).toContain("<MonthView");
    expect(styles).toMatch(
      /\.chrono-notes-month-interval-strip\s*\{[^}]*grid-column:\s*3 \/ -1;[^}]*grid-template-columns:\s*subgrid;/s,
    );
  });

  it("presents week numbers as a quiet index rail without a divider", () => {
    const railRule = styles.match(
      /\.chrono-notes-week-heading,\s*\.chrono-notes-week-number\s*\{[^}]*\}/s,
    )?.[0] ?? "";
    expect(railRule).toContain("background: transparent;");
    expect(railRule).not.toContain("border-right");
    expect(styles).toMatch(
      /\.chrono-notes-week-number-button\s*\{[^}]*border-radius:\s*5px;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-week-number-label\s*\{[^}]*font-variant-numeric:\s*tabular-nums;[^}]*font-weight:\s*var\(--font-semibold\);/s,
    );
    expect(declarationsForSelector(
      ".chrono-notes-week-number-button.is-selected",
    )).toContain(
      "box-shadow: 0 0 0 2px var(--interactive-accent) !important;",
    );
    expect(monthView).toContain("current={isSamePeriod(");
    expect(styles).toMatch(
      /\.chrono-notes-month-grid\s*\{[^}]*--chrono-notes-week-date-gap:\s*0px;/s,
    );
  });

  it("fades outside-month details without muting today's date number", () => {
    expect(monthDayCell).toContain('${isToday ? " is-current-period" : ""}');
    expect(styles).toMatch(
      /\.chrono-notes-day\.is-outside:not\(\.is-current-period\):not\(\.is-selected\):not\(\.is-range-preview\):not\(:hover\):not\(:focus-visible\)\s*\{[^}]*background:/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-day\.is-outside:not\(\.is-current-period\):not\(\.is-selected\):not\(\.is-range-preview\):not\(:hover\):not\(:focus-visible\)\s+:is\(\.chrono-notes-day-accessories, \.chrono-notes-day-content\)\s*\{[^}]*opacity:/s,
    );
    expect(styles).not.toMatch(/\.chrono-notes-day\.is-outside\s*\{[^}]*opacity:/s);
  });

  it("uses inverse current-period labels and an external selected frame", () => {
    expect(styles).toContain(
      "--chrono-notes-current-period-fill: var(--text-normal);",
    );
    expect(styles).toContain(
      "--chrono-notes-current-period-foreground: var(--background-secondary);",
    );
    expect(styles).not.toContain("--chrono-notes-current-period-ring");
    for (const selector of [
      ".chrono-notes-day.is-selected",
      ".chrono-notes-day.is-range-start",
      ".chrono-notes-day.is-range-end",
    ]) {
      const dayFrameRule = declarationsForSelector(selector);
      expect(dayFrameRule, selector).toContain(
        "box-shadow: 0 0 0 2px var(--interactive-accent) !important;",
      );
      expect(dayFrameRule, selector).not.toContain("box-shadow: inset");
      expect(dayFrameRule, selector).not.toMatch(
        /(?:^|;)\s*(?:background|color)\s*:/,
      );
    }

    for (const selector of [
      ".chrono-notes-week-day.is-selected",
      ".chrono-notes-week-number-button.is-selected",
      ".chrono-notes-year-period.is-selected",
      ".chrono-notes-year-heatmap-day.is-selected",
    ]) {
      const selectedRule = declarationsForSelector(selector);
      expect(selectedRule, selector).toContain(
        "box-shadow: 0 0 0 2px var(--interactive-accent) !important;",
      );
      expect(selectedRule, selector).not.toContain("box-shadow: inset");
      expect(selectedRule, selector).not.toMatch(
        /(?:^|;)\s*(?:background|color)\s*:/,
      );
    }

    for (const { selector, padding } of [
      {
        selector: ".chrono-notes-day.is-current-period .chrono-notes-day-number",
        padding: "0 4px",
      },
      {
        selector: ".chrono-notes-week-day.is-current-period .chrono-notes-week-day-date",
        padding: "0 4px",
      },
    ]) {
      const labelRule = declarationsForSelector(selector);
      expect(labelRule, selector).toContain(
        "background: var(--chrono-notes-current-period-fill);",
      );
      expect(labelRule, selector).toContain("border-radius: 4px;");
      expect(labelRule, selector).toContain(
        "color: var(--chrono-notes-current-period-foreground);",
      );
      expect(labelRule, selector).toContain(`padding: ${padding};`);
    }
    for (const selector of [
      ".chrono-notes-week-number-button.is-current-period .chrono-notes-week-number-label",
      ".chrono-notes-year-period.is-current-period .chrono-notes-year-period-label",
    ]) {
      const labelRule = declarationsForSelector(selector);
      expect(labelRule, selector).toContain(
        "background: var(--chrono-notes-current-period-fill);",
      );
      expect(labelRule, selector).toContain("border-radius: 4px;");
      expect(labelRule, selector).toContain(
        "box-shadow: 0 0 0 2px var(--chrono-notes-current-period-fill);",
      );
      expect(labelRule, selector).toContain(
        "color: var(--chrono-notes-current-period-foreground);",
      );
      expect(labelRule, selector).not.toContain("padding:");
    }
    const dayLabelRule = declarationsForSelector(
      ".chrono-notes-day.is-current-period .chrono-notes-day-number",
    );
    expect(dayLabelRule).toContain("display: inline-block;");
    expect(dayLabelRule).toContain("width: auto;");

    for (const selector of [
      ".chrono-notes-day.is-current-period",
      ".chrono-notes-week-day.is-current-period",
      ".chrono-notes-week-number-button.is-current-period",
      ".chrono-notes-year-period.is-current-period",
    ]) {
      expect(declarationsForSelector(selector), selector).not.toContain(
        "background:",
      );
    }
    for (const selector of [
      ".chrono-notes-day.is-current-period:not(.is-range-preview):not(.is-range-start):not(.is-range-end)::after",
      ".chrono-notes-week-day.is-current-period:not(.is-drop-target)::after",
      ".chrono-notes-week-number-button.is-current-period::after",
      ".chrono-notes-year-period.is-current-period::after",
    ]) {
      expect(declarationsForSelector(selector), selector).toBe("");
    }

    const heatmapMarkerRule = declarationsForSelector(
      ".chrono-notes-year-heatmap-day.is-current-period::after",
    );
    expect(heatmapMarkerRule).toContain(
      "background: var(--chrono-notes-current-period-fill);",
    );
    expect(heatmapMarkerRule).toContain("border-radius: 50%;");
    expect(heatmapMarkerRule).toContain("height: clamp(3px, 20%, 6px);");
    expect(heatmapMarkerRule).toContain("inset: 50% auto auto 50%;");
    expect(heatmapMarkerRule).toContain("pointer-events: none;");
    expect(heatmapMarkerRule).toContain("position: absolute;");
    expect(heatmapMarkerRule).toContain(
      "transform: translate(-50%, -50%);",
    );
    expect(heatmapMarkerRule).toContain("width: clamp(3px, 20%, 6px);");
    expect(heatmapMarkerRule).toContain("z-index: 1;");

    expect(yearView).toContain("data-period-kind={kind}");
    expect(styles).not.toContain("--chrono-notes-current-period-inset");
    expect(styles).not.toContain("--chrono-notes-current-period-radius");
    for (const level of [1, 2, 3, 4]) {
      expect(styles).toMatch(new RegExp(
        `\\.chrono-notes-day\\.is-heatmap\\[data-heatmap-level="${level}"\\]\\s*\\{[^}]*background:`,
        "s",
      ));
      expect(styles).toMatch(new RegExp(
        `\\.chrono-notes-year-heatmap-day\\[data-heatmap-level="${level}"\\]\\s*\\{[^}]*background:`,
        "s",
      ));
    }
  });

  it("reserves breathing room for inverse labels in compact period cells", () => {
    expect(styles).toMatch(
      /\.chrono-notes-year-summary-row\s*\{[^}]*grid-template-columns:\s*minmax\(64px, 0\.75fr\) repeat\(3, minmax\(0, 1fr\)\);/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-year-period\s*\{[^}]*min-height:\s*48px;[^}]*padding:\s*10px 4px 6px;/s,
    );
    expect(styles).toMatch(
      /@container \(max-width: 360px\)[\s\S]*?\.chrono-notes-month-grid\s*\{[^}]*grid-template-columns:\s*34px var\(--chrono-notes-week-date-gap\)/s,
    );
    expect(styles).not.toContain(".chrono-notes-year-period-selection");
    expect(yearView).not.toContain("chrono-notes-year-period-selection");
  });

  it("keeps focus visible and independent on every selectable calendar cell", () => {
    const dayFocusRule = declarationsForSelector(
      ".chrono-notes-day:focus-visible::before",
    );
    expect(declarationsForSelector(
      ".chrono-notes-day:focus-visible",
    )).toContain("outline: none;");
    expect(dayFocusRule).toContain("outline: 2px solid var(--interactive-accent);");
    expect(dayFocusRule).toContain("outline-offset: 3px;");
    expect(dayFocusRule).toContain("pointer-events: none;");
    expect(dayFocusRule).toContain("z-index: 3;");

    for (const selector of [
      ".chrono-notes-week-day:focus-visible",
      ".chrono-notes-week-number-button:focus-visible",
      ".chrono-notes-year-period:focus-visible",
      ".chrono-notes-year-heatmap-day:focus-visible",
    ]) {
      const focusRule = declarationsForSelector(selector);
      expect(focusRule, selector).toContain(
        "outline: 2px solid var(--interactive-accent);",
      );
      expect(focusRule, selector).toContain("outline-offset: 3px;");
    }
  });

  it("uses stable cell and date-detail spacing while centering heatmap dates", () => {
    expect(styles).toMatch(
      /\.chrono-notes-calendar\s*\{[^}]*--chrono-notes-cell-gap:\s*6px;[^}]*--chrono-notes-heatmap-cell-gap:\s*4px;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-month-grid\s*\{[^}]*gap:\s*var\(--chrono-notes-cell-gap\);/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-week-overview\s*\{[^}]*gap:\s*var\(--chrono-notes-cell-gap\);/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-year-summary-row\s*\{[^}]*gap:\s*var\(--chrono-notes-cell-gap\);/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-week-day\s*\{[^}]*padding:\s*5px;/s,
    );
    expect(styles).toMatch(
      /@container \(max-width: 360px\)[\s\S]*?\.chrono-notes-calendar\s*\{[^}]*--chrono-notes-cell-gap:\s*4px;[^}]*--chrono-notes-heatmap-cell-gap:\s*3px;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-day-main\s*\{[^}]*gap:\s*3px;[^}]*position:\s*relative;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-day-main\s*\{[^}]*z-index:\s*1;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-week-day-content\s*\{[^}]*gap:\s*2px;[^}]*margin-block-start:\s*1px;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-day\.is-heatmap \.chrono-notes-day-main\s*\{[^}]*align-items:\s*center;[^}]*gap:\s*0;[^}]*grid-row:\s*1 \/ -1;[^}]*justify-content:\s*center;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-year-heatmap-grid\s*\{[^}]*gap:\s*var\(--chrono-notes-heatmap-cell-gap\);[^}]*grid-template-rows:\s*repeat\(7, 11px\);/s,
    );
    expect(styles).toMatch(
      /@container \(max-width: 360px\)[\s\S]*?\.chrono-notes-year-heatmap-grid\s*\{[^}]*grid-template-rows:\s*repeat\(7, 10px\);/s,
    );
    expect(styles).toMatch(
      /@container \(max-width: 360px\)[\s\S]*?\.chrono-notes-day-main\s*\{[^}]*padding:\s*4px;/s,
    );
    expect(styles).toMatch(
      /@media \(pointer: coarse\)[\s\S]*?\.chrono-notes-calendar\s*\{[^}]*--chrono-notes-heatmap-cell-gap:\s*4px;/s,
    );
  });

  it("uses a breathable base month height and lets each week stretch as one row", () => {
    expect(styles).toMatch(
      /\.chrono-notes-week-block\s*\{[^}]*align-items:\s*stretch;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-day-main\s*\{[^}]*min-height:\s*56px;/s,
    );
  });

  it("uses one outlined in-slot treatment for unfinished task progress", () => {
    expect(styles).toMatch(
      /\.chrono-notes-calendar-indicator\.is-progress\.is-unfinished\s*\{[^}]*background:\s*transparent;[^}]*border-color:/s,
    );
    expect(styles).not.toContain("is-unfinished-color");
    expect(styles).not.toContain("is-unfinished-hole");
  });
});
