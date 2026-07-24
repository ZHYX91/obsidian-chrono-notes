import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const monthStyles = readFileSync(
  new URL("../../src/ui/styles/month-and-interval.css", import.meta.url),
  "utf8",
);
const yearAndWeekStyles = readFileSync(
  new URL("../../src/ui/styles/year-and-week.css", import.meta.url),
  "utf8",
);

describe("calendar host tooltip contract", () => {
  it("suppresses Obsidian host tooltips on every previewable date surface", () => {
    expect(monthStyles).toMatch(
      /\.chrono-notes-day\s*\{[^}]*--no-tooltip:\s*true;/s,
    );
    expect(monthStyles).toMatch(
      /\.chrono-notes-week-number-button\s*\{[^}]*--no-tooltip:\s*true;/s,
    );
    expect(yearAndWeekStyles).toMatch(
      /\.chrono-notes-week-day\s*\{[^}]*--no-tooltip:\s*true;/s,
    );
    expect(yearAndWeekStyles).toMatch(
      /\.chrono-notes-year-heatmap-day\s*\{[^}]*--no-tooltip:\s*true;/s,
    );
    expect(yearAndWeekStyles).toMatch(
      /\.chrono-notes-weekly-note\s*\{[^}]*--no-tooltip:\s*true;/s,
    );
    expect(yearAndWeekStyles).toMatch(
      /\.chrono-notes-year-period\s*\{[^}]*--no-tooltip:\s*true;/s,
    );
  });

  it("keeps the shared preview read-only and visually bounds its body", () => {
    expect(yearAndWeekStyles).toMatch(
      /\.chrono-notes-calendar-preview\s*\{[^}]*box-sizing:\s*border-box;[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*overflow:\s*hidden;[^}]*pointer-events:\s*none;/s,
    );
    expect(yearAndWeekStyles).toMatch(
      /\.chrono-notes-calendar-preview\s*>\s*:not\(\.chrono-notes-calendar-preview-body\)\s*\{[^}]*flex:\s*0 0 auto;/s,
    );
    expect(yearAndWeekStyles).toMatch(
      /\.chrono-notes-calendar-preview-body\s*\{[^}]*flex:\s*0 1 auto;[^}]*-webkit-line-clamp:\s*6;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/s,
    );
    expect(yearAndWeekStyles).toMatch(
      /\.chrono-notes-calendar-preview-embeds\s*\{[^}]*color:\s*var\(--text-muted\);[^}]*font-size:\s*var\(--font-ui-smaller\);/s,
    );
  });
});
