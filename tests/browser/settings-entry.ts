import type { App } from "obsidian";

import { installObsidianDomFactories } from "../setup/obsidian-dom";
import { ChronoNotesSettingTab } from "../../src/ui/settings/settings-tab";
import type { SettingsHost } from "../../src/ui/settings/settings-section-context";
import { createDefaultSettings, type PluginLocale } from "../../src/shared/settings";
import { createTranslator } from "../../src/shared/i18n";

interface SettingsBrowserSnapshot {
  readonly direction: string;
  readonly activeTab: string | undefined;
  readonly activeVisibleWidth: number;
  readonly activeWidth: number;
  readonly scrollLeft: number;
  readonly savedCount: number;
  readonly calendarExtensions: readonly string[];
  readonly holidayRegions: readonly string[];
}

declare global {
  interface Window {
    chronoSettingsPending: Promise<unknown>;
    mountChronoSettings: (locale: PluginLocale, width: number) => void;
    captureChronoSettings: () => SettingsBrowserSnapshot;
  }
}

installObsidianDomFactories(document);
Object.defineProperties(HTMLElement.prototype, {
  empty: { configurable: true, value(this: HTMLElement) { this.replaceChildren(); } },
  addClass: { configurable: true, value(this: HTMLElement, ...names: string[]) { this.classList.add(...names); } },
});

let tab: ChronoNotesSettingTab | null = null;
let saves = 0;
let settings = createDefaultSettings();

window.mountChronoSettings = (locale, width) => {
  tab?.hide();
  const root = document.getElementById("settings-fixture");
  if (root === null) throw new Error("Missing settings fixture root");
  root.replaceChildren();
  root.style.width = `${width}px`;
  settings = createDefaultSettings();
  settings.locale = locale;
  settings.holidayRegions = ["cn"];
  saves = 0;
  window.chronoSettingsPending = Promise.resolve();
  const host = {
    settings,
    isSettingsReadOnly: () => false,
    getTranslator: () => createTranslator(settings.locale, "en"),
    saveSettings: async () => { saves += 1; },
    getIcsSnapshot: () => null,
    subscribeIcs: () => () => undefined,
    refreshIcs: async () => undefined,
  } as unknown as SettingsHost;
  const app = { vault: { on: () => ({}), offref: () => undefined } } as unknown as App;
  tab = new ChronoNotesSettingTab(app, host);
  root.appendChild(tab.containerEl);
  tab.display();
};

window.captureChronoSettings = () => {
  const container = tab?.containerEl;
  const list = container?.querySelector<HTMLElement>('[role="tablist"]');
  const active = container?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
  if (list == null || active == null) throw new Error("Settings tabs are not mounted");
  const listRect = list.getBoundingClientRect();
  const activeRect = active.getBoundingClientRect();
  return {
    direction: getComputedStyle(list).direction,
    activeTab: active.dataset.tabId,
    activeVisibleWidth: Math.max(0, Math.min(activeRect.right, listRect.right) - Math.max(activeRect.left, listRect.left)),
    activeWidth: activeRect.width,
    scrollLeft: list.scrollLeft,
    savedCount: saves,
    calendarExtensions: [...settings.calendarExtensions],
    holidayRegions: [...settings.holidayRegions],
  };
};
