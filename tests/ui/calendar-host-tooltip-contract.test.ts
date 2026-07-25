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
const calendarAppSource = readFileSync(
  new URL("../../src/ui/calendar/calendar-app.tsx", import.meta.url),
  "utf8",
);

describe("calendar host tooltip contract", () => {
  it("does not expose a direct label on the calendar ancestor", () => {
    expect(calendarAppSource).toContain(
      "aria-labelledby={calendarLabelId}",
    );
    expect(calendarAppSource).not.toContain(
      'aria-label={t("calendar.ariaLabel")}',
    );
  });

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
      /\.chrono-notes-calendar-preview-date,\s*\.chrono-notes-calendar-preview-embeds\s*\{[^}]*flex:\s*0 0 auto;/s,
    );
    expect(yearAndWeekStyles).toMatch(
      /\.chrono-notes-calendar-preview-main\s*\{[^}]*display:\s*flex;[^}]*flex:\s*1 1 auto;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/s,
    );
    expect(yearAndWeekStyles).toMatch(
      /\.chrono-notes-calendar-preview-details\s*\{[^}]*flex:\s*0 1 auto;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/s,
    );
    expect(yearAndWeekStyles).toMatch(
      /\.chrono-notes-calendar-preview-body\s*\{[^}]*flex:\s*1 100 auto;[^}]*-webkit-line-clamp:\s*6;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/s,
    );
    expect(yearAndWeekStyles).toMatch(
      /\.chrono-notes-calendar-preview-embeds\s*\{[^}]*color:\s*var\(--text-muted\);[^}]*font-size:\s*var\(--font-ui-smaller\);/s,
    );
  });
});
