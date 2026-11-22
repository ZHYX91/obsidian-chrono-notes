import { readFileSync } from "node:fs";
import { Window, type CSSGroupingRule } from "happy-dom";
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
      /\.chrono-notes-ics-list\[data-responsive="false"\]\[data-wide-overflow="true"\]\s*\.chrono-notes-ics-event\[data-event-index="2"\]\s*\{[^}]*padding-inline-end:\s*24px;/s,
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
    const dom = new Window();
    const sheet = new dom.CSSStyleSheet();
    sheet.replaceSync(styles);
    const hidesSummaries = (group: CSSGroupingRule) => Array.from(group.cssRules).some(
      (rule) => rule instanceof dom.CSSStyleRule &&
        rule.selectorText === ".chrono-notes-ics-list" && rule.style.display === "none",
    );
    const rules = Array.from(sheet.cssRules);
    expect(rules.some((rule) => rule instanceof dom.CSSContainerRule &&
      rule.conditionText === "(max-width: 360px)" && hidesSummaries(rule))).toBe(true);
    expect(rules.some((rule) => rule instanceof dom.CSSMediaRule &&
      rule.conditionText === "(pointer: coarse)" && hidesSummaries(rule))).toBe(false);
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
