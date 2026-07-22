import { describe, expect, it } from "vitest";

import { readPluginStyles } from "../support/plugin-styles";

const styles = readPluginStyles();

describe("settings tab layout CSS", () => {
  it("keeps the tab list on one horizontally scrollable row", () => {
    expect(styles).toMatch(
      /\.chrono-notes-settings-tabs\s*\{[^}]*flex-wrap:\s*nowrap;[^}]*overflow-x:\s*auto;[^}]*overflow-y:\s*hidden;/s,
    );
  });

  it("uses stable fine- and coarse-pointer target heights", () => {
    expect(styles).toMatch(
      /\.chrono-notes-settings-tab\s*\{[^}]*box-sizing:\s*border-box;[^}]*height:\s*34px;[^}]*min-height:\s*34px;[^}]*white-space:\s*nowrap;/s,
    );
    expect(styles).toMatch(
      /@media \(pointer:\s*coarse\)[\s\S]*?\.chrono-notes-settings-tab\s*\{[^}]*height:\s*44px;[^}]*min-height:\s*44px;/s,
    );
  });

  it("provides a visible keyboard focus treatment", () => {
    expect(styles).toMatch(
      /\.chrono-notes-settings-tab:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--interactive-accent\);[^}]*outline-offset:\s*-2px;/s,
    );
  });

  it("separates periodic path guidance and validation errors visually", () => {
    expect(styles).toMatch(
      /\.chrono-notes-settings-guide\s*\{[^}]*border-inline-start:\s*3px solid var\(--interactive-accent\);/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-periodic-path-feedback\.is-error\s*\{[^}]*color:\s*var\(--text-error\);/s,
    );
  });

  it("keeps long path previews readable from their leading character", () => {
    expect(styles).toMatch(
      /\.chrono-notes-periodic-path-feedback\s*\{[^}]*display:\s*block;[^}]*overflow:\s*visible;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-periodic-path-example,\s*\.chrono-notes-periodic-path-feedback\s*\{[^}]*max-width:\s*100%;[^}]*min-width:\s*0;[^}]*overflow-wrap:\s*anywhere;[^}]*text-align:\s*start;[^}]*width:\s*100%;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-periodic-path-feedback\s*\) code\s*\{[^}]*max-width:\s*100%;[^}]*overflow-wrap:\s*anywhere;[^}]*white-space:\s*normal;/s,
    );
  });

  it("always stacks periodic path and template inputs at full width", () => {
    expect(styles).toMatch(
      /:is\(\s*\.chrono-notes-periodic-path-setting,\s*\.chrono-notes-periodic-template-setting\s*\)\s*\{[^}]*flex-direction:\s*column;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-periodic-template-setting\s*\) \.setting-item-control\s*\{[^}]*flex:\s*none;[^}]*flex-direction:\s*column;[^}]*width:\s*100%;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-periodic-template-setting\s*\) \.setting-item-control input\s*\{[^}]*width:\s*100%;/s,
    );
    expect(styles).not.toContain("flex: 0 1 420px");
    expect(styles).not.toContain("@container (max-width: 520px)");
  });

  it("stacks range folders and ICS sources at full width", () => {
    expect(styles).toMatch(
      /\.chrono-notes-wide-input-setting\s*\{[^}]*align-items:\s*stretch;[^}]*flex-direction:\s*column;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-wide-input-setting :is\(input, textarea\)\s*\{[^}]*max-width:\s*100%;[^}]*width:\s*100%;/s,
    );
    expect(styles).not.toContain("width: min(320px, 48vw)");
  });

  it("styles periodic type labels as toggle headings without another title row", () => {
    expect(styles).toMatch(
      /\.chrono-notes-periodic-section-heading\s*\{[^}]*border-top:[^}]*margin-top:[^}]*padding-top:/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-periodic-section-heading \.setting-item-name\s*\{[^}]*font-size:[^}]*font-weight:/s,
    );
  });
});
