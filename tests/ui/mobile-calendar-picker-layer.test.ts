import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { readPluginStyles } from "../support/plugin-styles";

const calendarApp = readFileSync(
  new URL("../../src/ui/calendar/calendar-app.tsx", import.meta.url),
  "utf8",
);
const calendarView = readFileSync(
  new URL("../../src/ui/calendar/chrono-notes-view.tsx", import.meta.url),
  "utf8",
);
const modalHost = readFileSync(
  new URL(
    "../../src/ui/modals/calendar-picker-modal-host.ts",
    import.meta.url,
  ),
  "utf8",
);
const pickerLayer = readFileSync(
  new URL("../../src/ui/calendar/calendar-picker-layer.tsx", import.meta.url),
  "utf8",
);

describe("mobile calendar picker layer", () => {
  it("uses an Obsidian modal as the Android Back stack layer", () => {
    expect(calendarView).toContain(
      "this.pickerModalHost = createCalendarPickerModalHost(this.app)",
    );
    expect(calendarView).toContain("pickerModalHost={this.pickerModalHost}");
    expect(calendarApp.match(/<CalendarPickerLayer/g)).toHaveLength(2);
    expect(pickerLayer).not.toContain('from "obsidian"');
    expect(modalHost).toContain("class CalendarPickerModal extends Modal");
    expect(pickerLayer).toContain('document.body.hasClass("is-mobile")');
    expect(modalHost).toContain("modal.open();");
    expect(modalHost).toContain("this.onRequestClose();");
  });

  it("keeps desktop pickers anchored and makes mobile modal pickers static", () => {
    const styles = readPluginStyles();

    expect(pickerLayer).toContain("if (!useModal) return children;");
    expect(styles).toMatch(
      /\.chrono-notes-calendar-picker-modal \.chrono-notes-period-picker\s*\{[^}]*position:\s*relative;[^}]*top:\s*auto;[^}]*transform:\s*none;/s,
    );
  });
});
