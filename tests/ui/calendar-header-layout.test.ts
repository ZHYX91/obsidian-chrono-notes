import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { readPluginStyles } from "../support/plugin-styles";

const styles = readPluginStyles();
const calendarApp = readFileSync(
  new URL("../../src/ui/calendar/calendar-app.tsx", import.meta.url),
  "utf8",
);
const miniCalendar = readFileSync(
  new URL("../../src/ui/modals/mini-calendar-modal.tsx", import.meta.url),
  "utf8",
);

describe("calendar header layout", () => {
  it("groups previous, period, and next controls with stable compact spacing", () => {
    expect(calendarApp).toContain(
      'className="chrono-notes-calendar-navigation"',
    );
    expect(miniCalendar).toContain(
      'className="chrono-notes-mini-calendar-navigation"',
    );
    expect(styles).toMatch(
      /\.chrono-notes-calendar-navigation,\s*\.chrono-notes-mini-calendar-navigation\s*\{[^}]*display:\s*flex;[^}]*flex:\s*0 1 auto;[^}]*gap:\s*6px;[^}]*min-width:\s*0;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-calendar-period-anchor\s*\{[^}]*display:\s*flex;[^}]*gap:\s*2px;/s,
    );
    expect(calendarApp).toContain('kind={openPeriodPicker === "week-year" ? "year" : "week"}');
  });

  it("puts flexible row space before Today with a twelve-pixel minimum gap", () => {
    expect(styles).toMatch(
      /\.chrono-notes-calendar-header,\s*\.chrono-notes-mini-calendar-header\s*\{[^}]*display:\s*flex;[^}]*gap:\s*12px;[^}]*min-width:\s*0;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-calendar-header \.chrono-notes-today,\s*\.chrono-notes-mini-calendar-header \.chrono-notes-mini-calendar-today\s*\{[^}]*flex:\s*none;[^}]*margin-left:\s*auto;/s,
    );
    expect(calendarApp).toMatch(
      /<\/div>\s*<button\s*type="button"\s*className="chrono-notes-today"/s,
    );
    expect(miniCalendar).toMatch(
      /<\/div>\s*<button\s*type="button"\s*className="chrono-notes-mini-calendar-today"/s,
    );
  });

  it("retains coarse-pointer targets for controls inside the new main navigation group", () => {
    expect(styles).toMatch(
      /@media \(pointer:\s*coarse\)[\s\S]*?\.chrono-notes-calendar-header > button,\s*\.chrono-notes-calendar-navigation > button,\s*\.chrono-notes-calendar-toolbar button\s*\{[^}]*min-height:\s*44px;[^}]*min-width:\s*44px;/s,
    );
  });
});
