import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { readPluginStyles } from "../support/plugin-styles";

describe("plugin focus visibility", () => {
  it("replaces cleared host shadows across calendar, interval, and navbar buttons", () => {
    const styles = readPluginStyles();

    expect(styles).toMatch(
      /:is\(\s*\.chrono-notes-calendar,\s*\.chrono-notes-interval-list,\s*\.chrono-notes-navbar\s*\)\s*:is\(button, select\):focus-visible\s*\{[^}]*outline:\s*2px solid var\(--interactive-accent\);[^}]*outline-offset:\s*1px;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-calendar button\.chrono-notes-day:focus-visible\s*\{[^}]*outline:\s*none;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-day:focus-visible::before\s*\{[^}]*outline:\s*2px solid var\(--interactive-accent\);/s,
    );
  });

  it("keeps the task due-date selector compact and touch sized", () => {
    const styles = readPluginStyles();

    expect(styles).toMatch(
      /@container \(max-width: 360px\)[\s\S]*?\.chrono-notes-week-task-due\s*\{[^}]*max-width:\s*82px;/s,
    );
    expect(styles).toMatch(
      /@media \(pointer: coarse\)[\s\S]*?\.chrono-notes-week-task-due\s*\{[^}]*min-height:\s*44px;[^}]*max-width:\s*min\(140px, 32cqw\);/s,
    );
  });

  it("gives compact mobile controls full touch targets", () => {
    const styles = readPluginStyles();
    const weekView = readFileSync(
      new URL("../../src/ui/calendar/week-view.tsx", import.meta.url),
      "utf8",
    );

    expect(weekView).toContain(
      '<label className="chrono-notes-week-task-toggle">',
    );
    expect(styles).toMatch(
      /@media \(pointer: coarse\)[\s\S]*?\.chrono-notes-week-task-toggle,[\s\S]*?min-height:\s*44px;[\s\S]*?width:\s*44px;/s,
    );
    expect(styles).toMatch(
      /@media \(pointer: coarse\)[\s\S]*?\.chrono-notes-heatmap-dimension select\s*\{[^}]*height:\s*44px;[^}]*min-height:\s*44px;/s,
    );
  });
});
