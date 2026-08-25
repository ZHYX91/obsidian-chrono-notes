import { setIcon } from "obsidian";

export function createSettingsGuide(containerEl: HTMLElement, title: string): HTMLDivElement {
  const guideEl = containerEl.createDiv({
    cls: "chrono-notes-settings-guide",
    attr: { role: "note" },
  });
  const headingEl = guideEl.createDiv({ cls: "chrono-notes-settings-guide-heading" });
  const iconEl = headingEl.createSpan({
    cls: "chrono-notes-settings-guide-icon",
    attr: { "aria-hidden": "true" },
  });
  setIcon(iconEl, "info");
  headingEl.createEl("strong", { text: title });
  return guideEl.createDiv({ cls: "chrono-notes-settings-guide-body" });
}
