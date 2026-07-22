import { describe, expect, it } from "vitest";

import { buildDateContextMenuActions } from "../../src/features/calendar/date-context-menu";

describe("buildDateContextMenuActions", () => {
  it("offers create, new-tab, and copy actions for a configured missing note", () => {
    const actions = buildDateContextMenuActions({
      configured: true,
      noteExists: false,
      rangeConfigured: true,
    });

    expect(actions).toEqual([
      { id: "open-default", group: "note", icon: "square-pen" },
      { id: "open-tab", group: "note", icon: "files" },
      { id: "create-range", group: "range", icon: "calendar-range" },
      { id: "copy-date", group: "clipboard", icon: "copy" },
    ]);
    expect(Object.isFrozen(actions)).toBe(true);
    expect(actions.every(Object.isFrozen)).toBe(true);
  });

  it("labels the primary action as open when an indexed file exists", () => {
    expect(buildDateContextMenuActions({
      configured: true,
      noteExists: true,
      rangeConfigured: false,
    })[0]).toEqual({
      id: "open-default",
      group: "note",
      icon: "file-text",
    });
  });

  it("does not offer fake note commands when daily notes are not configured", () => {
    expect(buildDateContextMenuActions({
      configured: false,
      noteExists: false,
      rangeConfigured: false,
    })).toEqual([
      { id: "copy-date", group: "clipboard", icon: "copy" },
    ]);
  });

  it("offers range creation independently from daily-note configuration", () => {
    expect(buildDateContextMenuActions({
      configured: false,
      noteExists: false,
      rangeConfigured: true,
    })).toEqual([
      { id: "create-range", group: "range", icon: "calendar-range" },
      { id: "copy-date", group: "clipboard", icon: "copy" },
    ]);
  });
});
