// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { clearSettingsGuideState, createSettingsGuide } from "../../src/ui/settings/settings-guide";

beforeEach(() => {
  Object.assign(HTMLElement.prototype, {
    createDiv(this: HTMLElement, options?: { cls?: string }) {
      const child = this.ownerDocument.createElement("div");
      if (options?.cls) child.className = options.cls;
      this.appendChild(child);
      return child;
    },
    createEl(this: HTMLElement, tag: string, options?: { cls?: string; text?: string }) {
      const child = this.ownerDocument.createElement(tag);
      if (options?.cls) child.className = options.cls;
      if (options?.text) child.textContent = options.text;
      this.appendChild(child);
      return child;
    },
    empty(this: HTMLElement) { this.replaceChildren(); },
  });
});

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
    details.dispatchEvent(new Event("toggle"));
    panel.empty();
    createSettingsGuide(panel, "Date format", "periodic-date");
    expect(panel.querySelector("details")?.open).toBe(true);
    clearSettingsGuideState(root);
    panel.empty();
    createSettingsGuide(panel, "Date format", "periodic-date");
    expect(panel.querySelector("details")?.open).toBe(false);
  });
});
