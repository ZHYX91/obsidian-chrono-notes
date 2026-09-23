import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
  new URL("../../src/ui/styles/calendar-ux.css", import.meta.url),
  "utf8",
);
const indexStyles = readFileSync(
  new URL("../../src/ui/styles/index.css", import.meta.url),
  "utf8",
);
const longPeriodStyles = readFileSync(
  new URL("../../src/ui/styles/long-period.css", import.meta.url),
  "utf8",
);
describe("mobile calendar discoverability", () => {
  it("keeps the Today action textual instead of replacing it with an ambiguous bullet", () => {
    expect(styles).toMatch(/@container \(max-width: 360px\)[\s\S]*?\.chrono-notes-today\s*\{[^}]*font-size:/s);
    expect(styles).toMatch(/\.chrono-notes-today::after\s*\{\s*content:\s*none;/s);
    expect(styles).not.toContain('content: "•"');
  });

  it("raises narrow auxiliary text floors instead of shrinking below readable micro text", () => {
    expect(styles).toContain("--chrono-notes-font-micro: 9px");
    expect(styles).toMatch(/\.chrono-notes-regional-marker,[\s\S]*?font-size:\s*max\(8px,/s);
  });

  it("keeps selected cells free of persistent opening glyphs", () => {
    expect(styles).not.toContain('content: "↵"');
    expect(styles).not.toContain('[data-note-state]:not([data-note-state="not-configured"])::after');
  });

  it("keeps the century selection and focus ring clear of its scrollbar", () => {
    expect(longPeriodStyles).toMatch(/\.chrono-notes-long-period\s*\{[\s\S]*?padding-inline-end:\s*6px;[\s\S]*?scrollbar-gutter:\s*stable;/s);
  });

  it("loads the interaction overrides after structural calendar styles", () => {
    expect(indexStyles.indexOf('@import "./calendar-ux.css";'))
      .toBeGreaterThan(indexStyles.indexOf('@import "./long-period.css";'));
  });
});
