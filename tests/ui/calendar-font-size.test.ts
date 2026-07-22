import { describe, expect, it } from "vitest";

import { getCalendarFontVariables } from "../../src/ui/calendar/calendar-font-size";
import { readPluginStyles } from "../support/plugin-styles";

describe("calendar font sizing", () => {
  it("maps the fixed 0-20 factor to stable four-level font variables", () => {
    expect(getCalendarFontVariables("immutable", 0)).toEqual({
      "--chrono-notes-font-header": "12px",
      "--chrono-notes-font-normal": "10.4px",
      "--chrono-notes-font-small": "8px",
      "--chrono-notes-font-micro": "7px",
    });
    expect(getCalendarFontVariables("immutable", 10)).toEqual({
      "--chrono-notes-font-header": "15px",
      "--chrono-notes-font-normal": "13px",
      "--chrono-notes-font-small": "10px",
      "--chrono-notes-font-micro": "8.5px",
    });
    expect(getCalendarFontVariables("immutable", 20)).toEqual({
      "--chrono-notes-font-header": "18px",
      "--chrono-notes-font-normal": "15.6px",
      "--chrono-notes-font-small": "12px",
      "--chrono-notes-font-micro": "10px",
    });
    expect(getCalendarFontVariables("follow-obsidian", 10)).toEqual({});
    expect(getCalendarFontVariables("follow-widget", 10)).toEqual({});
  });

  it("uses discrete sidebar buckets and caps collision-prone narrow labels", () => {
    const styles = readPluginStyles();

    expect(styles).toMatch(
      /\.chrono-notes-calendar\[data-font-size-mode="follow-obsidian"\]\s*\{[^}]*--chrono-notes-font-normal:\s*var\(--font-ui-small\);/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-calendar\[data-font-size-mode="follow-widget"\]\s*\{[^}]*--chrono-notes-font-normal:\s*13px;/s,
    );
    expect(styles).toMatch(
      /@container \(max-width: 360px\)[\s\S]*?\.chrono-notes-calendar\[data-font-size-mode="follow-widget"\]\s*\{[^}]*--chrono-notes-font-normal:\s*12px;/s,
    );
    expect(styles).toMatch(
      /@container \(min-width: 720px\)[\s\S]*?\.chrono-notes-calendar\[data-font-size-mode="follow-widget"\]\s*\{[^}]*--chrono-notes-font-normal:\s*14px;/s,
    );
    expect(styles).toMatch(
      /@container \(max-width: 360px\)[\s\S]*?\.chrono-notes-calendar\[data-font-size-mode\]\s+\.chrono-notes-day\s+\.chrono-notes-day-number\s*\{[^}]*font-size:\s*min\(var\(--chrono-notes-font-normal\),\s*12px\);/s,
    );
  });
});
