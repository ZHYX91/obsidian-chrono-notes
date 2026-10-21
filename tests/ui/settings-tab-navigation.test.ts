import { describe, expect, it } from "vitest";

import {
  SETTINGS_TAB_IDS,
  moveSettingsTab,
} from "../../src/ui/settings/settings-tab-navigation";

describe("moveSettingsTab", () => {
  it("moves and wraps with horizontal arrow keys", () => {
    expect(moveSettingsTab("general", "ArrowRight")).toBe("appearance");
    expect(moveSettingsTab("extensions-and-integrations", "ArrowRight")).toBe("general");
    expect(moveSettingsTab("general", "ArrowLeft")).toBe("extensions-and-integrations");
  });

  it("reverses horizontal arrows for right-to-left settings", () => {
    expect(moveSettingsTab("general", "ArrowRight", "rtl")).toBe(
      "extensions-and-integrations",
    );
    expect(moveSettingsTab("general", "ArrowLeft", "rtl")).toBe("appearance");
  });

  it("jumps to the first or last tab", () => {
    expect(moveSettingsTab("periodic", "Home")).toBe("general");
    expect(moveSettingsTab("periodic", "End")).toBe("extensions-and-integrations");
  });

  it("preserves the current tab for unrelated keys", () => {
    expect(moveSettingsTab("ranges", "Enter")).toBe("ranges");
    expect(SETTINGS_TAB_IDS).toEqual([
      "general",
      "appearance",
      "periodic",
      "ranges",
      "extensions-and-integrations",
    ]);
  });
});
