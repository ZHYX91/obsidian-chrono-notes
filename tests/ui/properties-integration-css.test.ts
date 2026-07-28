import { describe, expect, it } from "vitest";

import { readPluginStyles } from "../support/plugin-styles";

const styles = readPluginStyles();

describe("Properties date-format CSS", () => {
  it("scopes all overrides to native Properties date and date-time inputs", () => {
    for (const format of ["ymd", "dmy", "mdy"]) {
      expect(styles).toContain(`html.chrono-notes-property-date-format-${format}`);
    }
    expect(styles).toContain(".metadata-properties");
    expect(styles).toContain('input.metadata-input.mod-date[type="date"]');
    expect(styles).toContain(
      'input.metadata-input.mod-datetime[type="datetime-local"]',
    );
  });

  it("orders year, month, and day explicitly for every supported format", () => {
    const expectedOrders = {
      ymd: { year: 1, month: 2, day: 3 },
      dmy: { day: 1, month: 2, year: 3 },
      mdy: { month: 1, day: 2, year: 3 },
    } as const;
    for (const [format, fields] of Object.entries(expectedOrders)) {
      for (const [field, order] of Object.entries(fields)) {
        expect(styles).toMatch(new RegExp(
          `html\\.chrono-notes-property-date-format-${format}[\\s\\S]*?`
          + `::-webkit-datetime-edit-${field}-field\\s*\\{[^}]*order:\\s*${order};`,
        ));
      }
    }
  });

  it("retains native controls and limits hiding to browser separators", () => {
    expect(styles).toMatch(
      /::-webkit-datetime-edit-text\s*\{[^}]*display:\s*none;/s,
    );
    expect(styles).not.toMatch(
      /::-webkit-calendar-picker-indicator\s*\{[^}]*display:\s*none;/s,
    );
    expect(styles).not.toMatch(
      /input\.metadata-input\.mod-(?:date|datetime)\[type="[^"]+"\]\s*\{[^}]*display:\s*none;/s,
    );
  });

  it("uses a pointer-transparent unfocused overlay without replacing the input", () => {
    expect(styles).toMatch(
      /\.chrono-notes-property-date-display-value\s*\{[^}]*pointer-events:\s*none;/s,
    );
    expect(styles).toContain(
      ".chrono-notes-property-date-display-active",
    );
    expect(styles).toContain(
      "input.chrono-notes-property-date-native-input:not(:focus)::-webkit-datetime-edit",
    );
    expect(styles).not.toMatch(
      /\.chrono-notes-property-date-native-input\s*\{[^}]*position:\s*absolute;/s,
    );
    expect(styles).toContain(
      "--chrono-notes-property-date-display-inline-size",
    );
    expect(styles).toContain(
      "--chrono-notes-property-date-display-inline-start",
    );
    expect(styles).toMatch(
      /\.chrono-notes-property-date-display-value\s*\{[^}]*box-sizing:\s*border-box;/s,
    );
    expect(styles).not.toMatch(
      /\.chrono-notes-property-date-display-value\s*\{[^}]*inset-inline:\s*0;/s,
    );
  });
});
