import { describe, expect, it, vi } from "vitest";

import { openObsidianPluginSettings } from "../../../src/adapters/obsidian/obsidian-plugin-settings";

describe("openObsidianPluginSettings", () => {
  it("opens the settings window and selects the plugin tab", () => {
    const open = vi.fn();
    const openTabById = vi.fn();

    expect(openObsidianPluginSettings({ setting: { open, openTabById } }, "chrono-notes"))
      .toBe(true);
    expect(open).toHaveBeenCalledOnce();
    expect(openTabById).toHaveBeenCalledWith("chrono-notes");
  });

  it("does nothing when the internal settings surface is unavailable", () => {
    expect(openObsidianPluginSettings({}, "chrono-notes")).toBe(false);
    expect(openObsidianPluginSettings({ setting: { open: () => undefined } }, "chrono-notes"))
      .toBe(false);
  });
});
