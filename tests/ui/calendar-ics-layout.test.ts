import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { readPluginStyles } from "../support/plugin-styles";

const styles = readPluginStyles();
const monthDayCell = readFileSync(
  new URL("../../src/ui/calendar/month-day-cell.tsx", import.meta.url),
  "utf8",
);

describe("calendar ICS layout", () => {
  it("grows only for visible summaries and shares the final row with overflow", () => {
    expect(styles).toMatch(
      /\.chrono-notes-ics-list\s*\{[^}]*gap:\s*1px;[^}]*grid-auto-rows:\s*12px;[^}]*min-height:\s*0;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-ics-list\[data-has-overflow="true"\] \.chrono-notes-ics-event:last-of-type\s*\{[^}]*padding-inline-end:\s*24px;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-ics-more\s*\{[^}]*bottom:\s*0;[^}]*position:\s*absolute;[^}]*inset-inline-end:\s*0;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-ics-list\s*\{[^}]*position:\s*relative;[^}]*width:\s*100%;/s,
    );
    expect(styles).not.toMatch(/\.chrono-notes-ics-list\s*\{[^}]*top:/s);
    expect(styles).not.toMatch(/\.chrono-notes-ics-list\s*\{[^}]*height:\s*40px;/s);
  });

  it("folds visible summaries by available width rather than input modality", () => {
    expect(styles).toMatch(
      /@container \(max-width: 360px\)[\s\S]*?\.chrono-notes-ics-list\s*\{[^}]*display:\s*none;/s,
    );
    expect(styles).not.toMatch(
      /@media \(pointer: coarse\)[\s\S]*?\.chrono-notes-ics-list\s*\{[^}]*display:\s*none;/s,
    );
  });

  it("does not reserve a category-specific height for absent ICS events", () => {
    expect(monthDayCell).not.toContain("data-has-ics");
    expect(monthDayCell).not.toContain("data-show-note-indicators");
    expect(styles).not.toMatch(
      /\.chrono-notes-day\[data-has-ics=[^\]]+\][^{]*\{[^}]*min-height:/s,
    );
    expect(styles).not.toContain("--chrono-notes-ics-height");
  });
});
