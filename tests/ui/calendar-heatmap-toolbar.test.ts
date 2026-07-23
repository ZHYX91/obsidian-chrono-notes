import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { readPluginStyles } from "../support/plugin-styles";

const styles = readPluginStyles();
const calendarApp = readFileSync(
  new URL("../../src/ui/calendar/calendar-app.tsx", import.meta.url),
  "utf8",
);

describe("calendar heatmap toolbar", () => {
  it("gives week and year content more breathing room than the month header", () => {
    expect(calendarApp).toMatch(
      /className="chrono-notes-calendar-toolbar"\s+data-view-mode=\{viewMode\}/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-calendar-toolbar\s*\{[^}]*margin:\s*-4px 0 4px;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-calendar-toolbar\[data-view-mode="week"\],\s*\.chrono-notes-calendar-toolbar\[data-view-mode="year"\]\s*\{[^}]*margin-bottom:\s*8px;/s,
    );
  });

  it("shows shared statistics only for enabled month and year heatmaps", () => {
    expect(calendarApp).toContain('data-view-mode={viewMode}');
    expect(calendarApp).toMatch(
      /\{viewMode === "week" \? null : \(\s*<div[\s\S]*?\{heatmapEnabled \? \(/,
    );
    expect(calendarApp).not.toContain(
      'viewMode === "year" && heatmapEnabled',
    );
  });

  it("hides the legend first and wraps the intact tool group to the right", () => {
    expect(styles).toMatch(
      /\.chrono-notes-calendar-toolbar\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-heatmap-tools\s*\{[^}]*display:\s*flex;[^}]*flex:\s*none;[^}]*margin-inline-start:\s*auto;/s,
    );
    expect(styles).toMatch(
      /@container \(max-width:\s*360px\)[\s\S]*?\.chrono-notes-heatmap-legend\s*\{\s*display:\s*none;/s,
    );
  });

  it("uses the month cell palette for the month legend and the year palette for year", () => {
    for (const [level, percent] of [[1, 12], [2, 30], [3, 52], [4, 78]]) {
      expect(styles).toMatch(new RegExp(
        `heatmap-tools\\[data-view-mode="month"\\][\\s\\S]*?` +
        `heatmap-legend span\\[data-heatmap-level="${level}"\\],[\\s\\S]*?` +
        `chrono-notes-day\\.is-heatmap\\[data-heatmap-level="${level}"\\]` +
        `[\\s\\S]*?interactive-accent\\) ${percent}%`,
      ));
    }
    expect(styles).toMatch(
      /heatmap-tools\[data-view-mode="year"\][\s\S]*?color-green\) 20%/,
    );
  });
});
