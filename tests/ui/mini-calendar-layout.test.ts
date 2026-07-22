import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { readPluginStyles } from "../support/plugin-styles";

const styles = readPluginStyles();
const miniCalendar = readFileSync(
  new URL("../../src/ui/modals/mini-calendar-modal.tsx", import.meta.url),
  "utf8",
);
const calendarApp = readFileSync(
  new URL("../../src/ui/calendar/calendar-app.tsx", import.meta.url),
  "utf8",
);

describe("mini calendar layout", () => {
  it("keeps the primary header compact while retaining year and month reachability", () => {
    expect(styles).toMatch(
      /\.chrono-notes-mini-calendar-modal-container\s*\{[^}]*max-width:\s*min\(340px,/s,
    );
    expect(miniCalendar).toContain(
      'className="chrono-notes-mini-calendar-navigation"',
    );
    expect(miniCalendar).toContain('className="chrono-notes-mini-calendar-today"');
    expect(miniCalendar).not.toContain('className="chrono-notes-mini-calendar-footer"');
    expect(styles).toMatch(
      /\.chrono-notes-mini-calendar-period-trigger\s*\{[^}]*flex:\s*0 1 132px;/s,
    );
    expect(miniCalendar).not.toContain("ChevronsLeft");
    expect(miniCalendar).not.toContain("ChevronsRight");
    expect(miniCalendar).toContain("chrono-notes-mini-calendar-period-trigger");
    expect(miniCalendar).toContain("aria-controls={periodPickerId}");
    expect(miniCalendar).toContain("chrono-notes-mini-calendar-year-navigation");
    expect(miniCalendar).toContain("chrono-notes-mini-calendar-month-grid");
    expect(miniCalendar.match(/aria-live="polite"/g)).toHaveLength(2);
    expect(miniCalendar).toContain(
      "monthButtons.current.get(displayMonth.month)?.focus()",
    );
  });

  it("groups column headers and dates into valid ARIA grid rows", () => {
    expect(miniCalendar).toContain('className="chrono-notes-mini-calendar-row" role="row"');
    expect(miniCalendar).toContain('role="columnheader"');
    expect(miniCalendar).toContain('role="gridcell"');
    expect(styles).toMatch(
      /\.chrono-notes-mini-calendar-grid\s*\{[^}]*display:\s*grid;[^}]*grid-template-rows:\s*auto repeat\(6, 34px\);/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-mini-calendar-row\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(7,/s,
    );
  });

  it("renders ordinary days as circular ghost controls with independent states", () => {
    expect(styles).toMatch(
      /\.chrono-notes-mini-calendar-day\s*\{[^}]*background:\s*transparent;[^}]*border:\s*0;[^}]*border-radius:\s*50%;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-mini-calendar-day\.is-today\s*\{[^}]*color:\s*var\(--text-accent\);[^}]*font-weight:\s*var\(--font-semibold\);/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-mini-calendar-day\.is-selected\s*\{[^}]*box-shadow:\s*inset 0 0 0 2px var\(--interactive-accent\) !important;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-mini-calendar-day:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--interactive-accent\);[^}]*outline-offset:\s*2px;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-mini-calendar-day\.is-outside-month:not\(\.is-selected\):not\(\.is-today\)\s*\{[^}]*color:\s*var\(--text-faint\);/s,
    );
  });

  it("keeps the mini calendar separate from week-year and week navigation", () => {
    expect(calendarApp).not.toContain("CalendarDays");
    expect(calendarApp).not.toContain("onPickDate");
    expect(calendarApp).toContain("CalendarWeekPickerPopover");
    expect(calendarApp).toContain('"week-year"');
    expect(calendarApp).toContain('openPeriodPicker === "week"');
  });

  it("lets mobile Back close the month picker before the host modal", () => {
    expect(miniCalendar).toContain("<CalendarPickerLayer");
    expect(miniCalendar).toContain(
      "this.pickerModalHost = createCalendarPickerModalHost(this.app)",
    );
    expect(miniCalendar).toContain("modalHost={pickerModalHost}");
    expect(miniCalendar).toContain("onClose={closePeriodPicker}");
    expect(miniCalendar).not.toContain("override close(): void");
  });

  it("expands compact header controls without changing the six-row day grid", () => {
    expect(styles).toMatch(
      /@media \(pointer: coarse\)[\s\S]*?\.chrono-notes-mini-calendar-header button,[\s\S]*?height:\s*44px;[\s\S]*?min-width:\s*44px;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-mini-calendar-grid\s*\{[^}]*grid-template-rows:\s*auto repeat\(6, 34px\);/s,
    );
  });
});
