// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { clearSettingsGuideState, createSettingsGuide, rememberSettingsGuides } from "../../src/ui/settings/settings-guide";

import { installObsidianDomFactories } from "../setup/obsidian-dom";

beforeEach(() => installObsidianDomFactories(document));

describe("Chrono settings tutorial disclosure", () => {
  it("remembers expansion across category redraws but resets after window close", () => {
    const root = document.createElement("div");
    root.className = "chrono-notes-settings";
    const panel = root.createDiv();
    const body = createSettingsGuide(panel, "Date format", "periodic-date");
    body.createEl("code", { text: "YYYY-MM-DD" });
    const details = panel.querySelector("details")!;
    expect(details.open).toBe(false);
    details.open = true;
    rememberSettingsGuides(root); // Redraw immediately, before native toggle delivery.
    panel.replaceChildren();
    createSettingsGuide(panel, "Date format", "periodic-date");
    expect(panel.querySelector("details")?.open).toBe(true);
    clearSettingsGuideState(root);
    details.dispatchEvent(new Event("toggle"));
    panel.replaceChildren();
    createSettingsGuide(panel, "Date format", "periodic-date");
    expect(panel.querySelector("details")?.open).toBe(false);
  });
});
