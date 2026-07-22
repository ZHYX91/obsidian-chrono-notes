import {
  getSettingsTabScrollLeft,
  moveSettingsTab,
  type SettingsTabId,
} from "./settings-tab-navigation";

export interface SettingsTabDefinition {
  readonly id: SettingsTabId;
  readonly label: string;
}

export interface SettingsTabLayout {
  readonly activeTabEl: HTMLButtonElement;
  readonly panelEl: HTMLElement;
}

export function createSettingsTabLayout(
  containerEl: HTMLElement,
  tabs: readonly SettingsTabDefinition[],
  activeTab: SettingsTabId,
  ariaLabel: string,
  onSelect: (tabId: SettingsTabId) => void,
): SettingsTabLayout {
  const document = containerEl.ownerDocument;
  const tabListEl = document.createElement("div");
  tabListEl.className = "chrono-notes-settings-tabs";
  tabListEl.setAttribute("role", "tablist");
  tabListEl.setAttribute("aria-label", ariaLabel);
  tabListEl.setAttribute("aria-orientation", "horizontal");
  containerEl.appendChild(tabListEl);

  const buttons = tabs.map((tab) => {
    const buttonEl = document.createElement("button");
    const active = tab.id === activeTab;
    buttonEl.className = active
      ? "chrono-notes-settings-tab is-active"
      : "chrono-notes-settings-tab";
    buttonEl.type = "button";
    buttonEl.textContent = tab.label;
    buttonEl.id = getTabElementId(tab.id);
    buttonEl.dataset.tabId = tab.id;
    buttonEl.setAttribute("role", "tab");
    buttonEl.setAttribute("aria-selected", String(active));
    buttonEl.setAttribute("aria-controls", getPanelElementId(tab.id));
    buttonEl.tabIndex = active ? 0 : -1;
    buttonEl.addEventListener("click", () => {
      if (tab.id === activeTab) {
        buttonEl.focus();
        return;
      }
      onSelect(tab.id);
    });
    buttonEl.addEventListener("keydown", (event) => {
      const next = moveSettingsTab(tab.id, event.key);
      if (next === tab.id) return;
      event.preventDefault();
      onSelect(next);
    });
    tabListEl.appendChild(buttonEl);
    return buttonEl;
  });

  const activeTabEl = buttons.find((button) => button.tabIndex === 0) ?? buttons[0];
  if (activeTabEl === undefined) {
    throw new Error("Settings tab layout requires at least one tab.");
  }

  const panelEl = document.createElement("div");
  panelEl.className = "chrono-notes-settings-panel";
  panelEl.id = getPanelElementId(activeTab);
  panelEl.setAttribute("role", "tabpanel");
  panelEl.setAttribute("aria-labelledby", getTabElementId(activeTab));
  panelEl.tabIndex = 0;
  containerEl.appendChild(panelEl);

  const tabListRect = tabListEl.getBoundingClientRect();
  const activeTabRect = activeTabEl.getBoundingClientRect();
  tabListEl.scrollLeft = getSettingsTabScrollLeft({
    clientWidth: tabListEl.clientWidth,
    scrollWidth: tabListEl.scrollWidth,
    scrollLeft: tabListEl.scrollLeft,
    tabOffsetLeft: activeTabRect.left - tabListRect.left + tabListEl.scrollLeft,
    tabOffsetWidth: activeTabRect.width,
  });

  return Object.freeze({ activeTabEl, panelEl });
}

function getTabElementId(tabId: SettingsTabId): string {
  return `chrono-notes-settings-tab-${tabId}`;
}

function getPanelElementId(tabId: SettingsTabId): string {
  return `chrono-notes-settings-panel-${tabId}`;
}
