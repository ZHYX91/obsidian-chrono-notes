import { describe, expect, it } from "vitest";

import {
  SETTINGS_TAB_IDS,
  getSettingsTabScrollLeft,
  moveSettingsTab,
} from "../../src/ui/settings/settings-tab-navigation";

describe("moveSettingsTab", () => {
  it("moves and wraps with horizontal arrow keys", () => {
    expect(moveSettingsTab("general", "ArrowRight")).toBe("appearance");
    expect(moveSettingsTab("integrations", "ArrowRight")).toBe("general");
    expect(moveSettingsTab("general", "ArrowLeft")).toBe("integrations");
  });

  it("jumps to the first or last tab", () => {
    expect(moveSettingsTab("periodic", "Home")).toBe("general");
    expect(moveSettingsTab("periodic", "End")).toBe("integrations");
  });

  it("preserves the current tab for unrelated keys", () => {
    expect(moveSettingsTab("ranges", "Enter")).toBe("ranges");
    expect(SETTINGS_TAB_IDS).toEqual([
      "general",
      "appearance",
      "periodic",
      "ranges",
      "integrations",
    ]);
  });
});

describe("getSettingsTabScrollLeft", () => {
  it("keeps a fully visible active tab at the current scroll position", () => {
    expect(getSettingsTabScrollLeft({
      clientWidth: 320,
      scrollWidth: 360,
      scrollLeft: 20,
      tabOffsetLeft: 100,
      tabOffsetWidth: 80,
    })).toBe(20);
  });

  it("reveals active tabs clipped on either horizontal edge", () => {
    expect(getSettingsTabScrollLeft({
      clientWidth: 320,
      scrollWidth: 500,
      scrollLeft: 100,
      tabOffsetLeft: 40,
      tabOffsetWidth: 80,
    })).toBe(40);
    expect(getSettingsTabScrollLeft({
      clientWidth: 322,
      scrollWidth: 359,
      scrollLeft: 0,
      tabOffsetLeft: 307,
      tabOffsetWidth: 52,
    })).toBe(37);
  });

  it("clamps malformed layout values to the available scroll range", () => {
    expect(getSettingsTabScrollLeft({
      clientWidth: 300,
      scrollWidth: 500,
      scrollLeft: 400,
      tabOffsetLeft: 490,
      tabOffsetWidth: 80,
    })).toBe(200);
    expect(getSettingsTabScrollLeft({
      clientWidth: 400,
      scrollWidth: 300,
      scrollLeft: 20,
      tabOffsetLeft: -10,
      tabOffsetWidth: 40,
    })).toBe(0);
  });
});
