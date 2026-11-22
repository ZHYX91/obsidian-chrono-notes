import {
  moveSettingsTab,
  type SettingsTabId,
} from "./settings-tab-navigation";
import { attachSettingsTabOverflow } from "./settings-tab-overflow";

export interface SettingsTabDefinition {
  readonly id: SettingsTabId;
  readonly label: string;
}

export interface SettingsTabLayout {
  readonly activeTabEl: HTMLButtonElement;
  readonly panelEl: HTMLElement;
  readonly dispose: () => void;
}

let nextLayoutId = 0;

export function createSettingsTabLayout(
  containerEl: HTMLElement,
  tabs: readonly SettingsTabDefinition[],
  activeTab: SettingsTabId,
  labels: { categories: string; earlier: string; later: string },
  onSelect: (tabId: SettingsTabId) => void,
): SettingsTabLayout {
  const layoutId = `chrono-notes-settings-${++nextLayoutId}`;
  const panelId = `${layoutId}-panel`;
  const row = containerEl.createDiv({ cls: "chrono-notes-settings-tab-row" });
  const tabListEl = row.createDiv();
  tabListEl.id = `${layoutId}-tabs`;
  tabListEl.className = "chrono-notes-settings-tabs";
  tabListEl.setAttribute("role", "tablist");
  tabListEl.setAttribute("aria-label", labels.categories);
  tabListEl.setAttribute("aria-orientation", "horizontal");

  const buttons = tabs.map((tab) => {
    const buttonEl = tabListEl.createEl("button");
    const active = tab.id === activeTab;
    buttonEl.className = active
      ? "chrono-notes-settings-tab is-active"
      : "chrono-notes-settings-tab";
    buttonEl.type = "button";
    buttonEl.textContent = tab.label;
    buttonEl.id = `${layoutId}-tab-${tab.id}`;
    buttonEl.dataset.tabId = tab.id;
    buttonEl.setAttribute("role", "tab");
    buttonEl.setAttribute("aria-selected", String(active));
    buttonEl.setAttribute("aria-controls", panelId);
    buttonEl.tabIndex = active ? 0 : -1;
    buttonEl.addEventListener("click", () => {
      if (tab.id === activeTab) {
        buttonEl.focus();
        return;
      }
      onSelect(tab.id);
    });
    buttonEl.addEventListener("keydown", (event) => {
      const next = moveSettingsTab(
        tab.id,
        event.key,
        getComputedStyle(tabListEl).direction === "rtl" ? "rtl" : "ltr",
      );
      if (next === tab.id) return;
      event.preventDefault();
      onSelect(next);
    });
    return buttonEl;
  });

  const activeTabEl = buttons.find((button) => button.tabIndex === 0) ?? buttons[0];
  if (activeTabEl === undefined) {
    throw new Error("Settings tab layout requires at least one tab.");
  }

  const panelEl = containerEl.createDiv();
  panelEl.className = "chrono-notes-settings-panel";
  panelEl.id = panelId;
  panelEl.setAttribute("role", "tabpanel");
  panelEl.setAttribute("aria-labelledby", activeTabEl.id);
  panelEl.tabIndex = 0;

  const dispose = attachSettingsTabOverflow(row, tabListEl, buttons, activeTabEl, labels);
  return { activeTabEl, panelEl, dispose };
}
