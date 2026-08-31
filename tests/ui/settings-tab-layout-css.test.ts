import { describe, expect, it } from "vitest";

import { readPluginStyles } from "../support/plugin-styles";

const styles = readPluginStyles();

describe("settings tab layout CSS", () => {
  it("keeps the tab list on one horizontally scrollable row", () => {
    expect(styles).toMatch(
      /\.chrono-notes-settings-tabs\s*\{[^}]*flex-wrap:\s*nowrap;[^}]*overflow-x:\s*auto;[^}]*overflow-y:\s*hidden;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-settings-tabs\s*\{[^}]*border-block-end:\s*1px solid var\(--background-modifier-border\);[^}]*gap:\s*var\(--size-2-1\);/s,
    );
  });

  it("resets theme button chrome without erasing the active indicator", () => {
    expect(styles).toMatch(
      /\.chrono-notes-settings-tabs > button\.chrono-notes-settings-tab\s*\{[^}]*appearance:\s*none !important;[^}]*background:\s*transparent !important;[^}]*border:\s*0 !important;[^}]*border-block-end:\s*2px solid transparent !important;[^}]*border-radius:\s*0 !important;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-settings-tabs > button\.chrono-notes-settings-tab\.is-active,[\s\S]*?\{[^}]*border-block-end-color:\s*var\(--interactive-accent\) !important;[^}]*color:\s*var\(--text-normal\) !important;[^}]*font-weight:\s*var\(--font-semibold\) !important;/s,
    );
    expect(styles).not.toContain("border-bottom-color");
  });

  it("grows with interface text while preserving coarse-pointer targets", () => {
    expect(styles).toMatch(
      /\.chrono-notes-settings-tabs > button\.chrono-notes-settings-tab\s*\{[^}]*font-size:\s*var\(--font-ui-small\) !important;[^}]*block-size:\s*auto;[^}]*min-block-size:\s*34px;[^}]*white-space:\s*nowrap;/s,
    );
    expect(styles).toMatch(
      /@media \(pointer:\s*coarse\)[\s\S]*?\.chrono-notes-settings-tab\s*\{[^}]*min-block-size:\s*44px;/s,
    );
  });

  it("provides a visible keyboard focus treatment", () => {
    expect(styles).toMatch(
      /\.chrono-notes-settings-tabs > button\.chrono-notes-settings-tab:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--interactive-accent\);[^}]*outline-offset:\s*-2px;/s,
    );
  });

  it("keeps a stable gap between navigation and panel content", () => {
    expect(styles).toMatch(
      /\.chrono-notes-settings-panel\s*\{[^}]*margin-block-start:\s*var\(--size-4-5\);/s,
    );
  });

  it("keeps save failures visible without showing an idle status row", () => {
    expect(styles).toMatch(
      /\.chrono-notes-settings-save-status\s*\{[^}]*border:\s*1px solid var\(--background-modifier-border\);[^}]*display:\s*flex;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-settings-save-status\[hidden\]\s*\{[^}]*display:\s*none;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-settings-save-status\.is-error\s*\{[^}]*border-color:\s*var\(--background-modifier-error\);[^}]*color:\s*var\(--text-error\);/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-settings-save-message\s*\{[^}]*overflow-wrap:\s*anywhere;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-settings-read-only-status\s*\{[^}]*border:\s*1px solid var\(--text-warning\);[^}]*color:\s*var\(--text-warning\);[^}]*overflow-wrap:\s*anywhere;/s,
    );
  });

  it("separates periodic path guidance and validation errors visually", () => {
    expect(styles).toMatch(
      /\.chrono-notes-settings-guide\s*\{[^}]*border-inline-start:\s*3px solid var\(--interactive-accent\);[^}]*box-shadow:\s*none;[^}]*padding:\s*12px 14px;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-settings-guide-heading\s*\{[^}]*align-items:\s*center;[^}]*display:\s*flex;[^}]*gap:\s*8px;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-settings-guide-body\s*\{[^}]*max-inline-size:\s*68ch;/s,
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
      /:is\(\s*\.chrono-notes-periodic-path-setting,\s*\.chrono-notes-template-path-setting\s*\)\s*\{[^}]*flex-direction:\s*column;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-template-path-setting\s*\) \.setting-item-control\s*\{[^}]*flex:\s*none;[^}]*flex-direction:\s*column;[^}]*width:\s*100%;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-template-path-setting\s*\) \.setting-item-control input\s*\{[^}]*width:\s*100%;/s,
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

  it("stacks both property format dropdowns before their controls can squeeze copy", () => {
    expect(styles).toMatch(
      /\.setting-item\.chrono-notes-property-format-settings,\s*\.chrono-notes-property-format-settings \.setting-item\s*\{[^}]*align-items:\s*stretch;[^}]*flex-direction:\s*column;[^}]*gap:\s*var\(--size-2-2\);/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-property-format-settings \.setting-item-control select,\s*\.setting-item\.chrono-notes-property-format-settings \.setting-item-control select\s*\{[^}]*box-sizing:\s*border-box;[^}]*inline-size:\s*100%;[^}]*max-inline-size:\s*100%;/s,
    );
    expect(styles).not.toContain("inline-size: 22rem");
  });

  it("stacks custom property formats before their controls can squeeze help text", () => {
    expect(styles).toMatch(
      /\.chrono-notes-property-custom-format-setting\s*\{[^}]*align-items:\s*stretch;[^}]*flex-direction:\s*column;[^}]*gap:\s*var\(--size-2-2\);/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-property-custom-format-setting \.setting-item-control\s*\{[^}]*align-items:\s*stretch;[^}]*flex:\s*none;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-property-custom-format-setting \.setting-item-control input\s*\{[^}]*max-width:\s*100%;[^}]*width:\s*100%;/s,
    );
  });

  it("does not add custom dividers or nesting to native periodic headings", () => {
    expect(styles).not.toContain(".chrono-notes-periodic-note-group");
    expect(styles).not.toContain(".chrono-notes-periodic-note-fields");
    expect(styles).not.toContain(".chrono-notes-periodic-section-heading");
  });

  it("restores native spacing between periodic note headings", () => {
    expect(styles).toMatch(
      /\.chrono-notes-periodic-note-section\s*\+\s*\.chrono-notes-periodic-note-section\s*>\s*h3\s*\{[^}]*margin-top:\s*var\(--size-4-6\);/s,
    );
  });
});
