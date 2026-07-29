import { describe, expect, it } from "vitest";

import { readPluginStyles } from "../support/plugin-styles";

const styles = readPluginStyles();

describe("Properties date-format CSS", () => {
  it("scopes presentation to managed native Properties date inputs", () => {
    expect(styles).toContain(".metadata-properties");
    expect(styles).toContain(".chrono-notes-property-date-display-host");
    expect(styles).toContain(".chrono-notes-property-date-native-input");
    expect(styles).toContain('.mod-date[type="date"]');
    expect(styles).toContain('.mod-datetime[type="datetime-local"]');
  });

  it("does not reorder browser fields or synthesize native separators", () => {
    expect(styles).not.toContain("chrono-notes-property-date-format-ymd");
    expect(styles).not.toContain("chrono-notes-property-date-format-dmy");
    expect(styles).not.toContain("chrono-notes-property-date-format-mdy");
    expect(styles).not.toContain("::-webkit-datetime-edit-year-field");
    expect(styles).not.toContain("::-webkit-datetime-edit-month-field");
    expect(styles).not.toContain("::-webkit-datetime-edit-day-field");
    expect(styles).not.toMatch(
      /::-webkit-datetime-edit-text\s*\{[^}]*display:\s*none;/s,
    );
    expect(styles).not.toMatch(
      /::-webkit-datetime-edit(?:-[^{\s]+)?[^\{]*\{[^}]*direction:\s*ltr;/s,
    );
  });

  it("hides the complete native edit surface while keeping the real picker", () => {
    expect(styles).toMatch(
      /@media \(forced-colors: none\)\s*\{[\s\S]*?\.chrono-notes-property-date-display-active[\s\S]*?display:\s*flex;/,
    );
    expect(styles).toMatch(
      /@media \(forced-colors: none\)\s*\{[\s\S]*?input\.chrono-notes-property-date-native-input:not\(:focus\):not\(:active\)::-webkit-datetime-edit\s*\{[^}]*opacity:\s*0\s*!important;/,
    );
    expect(styles).not.toMatch(
      /::-webkit-datetime-edit\s*\{[^}]*color:\s*transparent;/s,
    );
    expect(styles).toMatch(
      /input\.chrono-notes-property-date-native-input:is\(:focus,\s*:active\)[\s\S]*?~\s*\.chrono-notes-property-date-display-value\s*\{[^}]*display:\s*none;/s,
    );
    expect(styles).not.toMatch(
      /::-webkit-calendar-picker-indicator\s*\{[^}]*(?:display:\s*none|visibility:\s*hidden|opacity:\s*0)/s,
    );
    expect(styles).not.toMatch(
      /input\.chrono-notes-property-date-native-input(?![^\{]*::)[^\{]*\{[^}]*opacity:\s*0/s,
    );
    expect(styles).not.toContain("forced-color-adjust: none");
  });

  it("uses a pointer-transparent overlay measured to the native input rectangle", () => {
    expect(styles).toMatch(
      /\.chrono-notes-property-date-display-value\s*\{[^}]*pointer-events:\s*none;/s,
    );
    expect(styles).toContain("--chrono-notes-property-date-display-inline-size");
    expect(styles).toContain("--chrono-notes-property-date-display-inline-start");
    expect(styles).toContain("--chrono-notes-property-date-display-block-size");
    expect(styles).toContain("--chrono-notes-property-date-display-block-start");
    expect(styles).not.toContain("padding-inline: 2.15em");
    expect(styles).not.toMatch(
      /\.chrono-notes-property-date-display-value\s*\{[^}]*inset-block:\s*0;/s,
    );
  });

  it("applies measured width to both Date and Date & time while managed", () => {
    expect(styles).toMatch(
      /input\.chrono-notes-property-date-native-input:is\([\s\S]*?\.mod-date\[type="date"\][\s\S]*?\.mod-datetime\[type="datetime-local"\][\s\S]*?\)\s*\{[^}]*inline-size:\s*var\(--chrono-notes-property-date-display-inline-size,/s,
    );
    expect(styles).not.toMatch(
      /\.chrono-notes-property-date-native-input\s*\{[^}]*position:\s*absolute;/s,
    );
  });
});
