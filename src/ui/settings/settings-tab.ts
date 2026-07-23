import { PluginSettingTab, type App } from "obsidian";

import { createTranslator, type Translator } from "../../shared/i18n";
import { renderAppearanceSettingsSection } from "./appearance-settings-section";
import { renderGeneralSettingsSection } from "./general-settings-section";
import { renderIntegrationsSettingsSection } from "./integrations-settings-section";
import { renderPeriodicSettingsSection } from "./periodic-settings-section";
import { renderRangeSettingsSection } from "./range-settings-section";
import {
  type SettingsHost,
  type SettingsSectionContext,
} from "./settings-section-context";
import { SettingsSaveCoordinator } from "./settings-save-coordinator";
import { createSettingsTabLayout } from "./settings-tab-layout";
import type { SettingsTabId } from "./settings-tab-navigation";
import { getSettingsTabLabels } from "./settings-presentation";
import { VaultPathSuggestionCatalog } from "./vault-path-suggest";

export class ChronoNotesSettingTab extends PluginSettingTab {
  private static readonly TEXT_SAVE_DELAY_MS = 300;

  private activeTab: SettingsTabId = "general";
  private readonly settingsSave: SettingsSaveCoordinator;
  private readonly vaultPathSuggestionCatalog: VaultPathSuggestionCatalog;
  private translator: Translator = createTranslator("en", "en");

  constructor(app: App, private readonly host: SettingsHost) {
    super(app, host);
    this.vaultPathSuggestionCatalog = new VaultPathSuggestionCatalog(app);
    this.settingsSave = new SettingsSaveCoordinator(
      () => this.host.saveSettings(),
      {
        delayMs: ChronoNotesSettingTab.TEXT_SAVE_DELAY_MS,
        onError: (error) => {
          console.error("Chrono Notes: failed to save settings", error);
        },
      },
    );
  }

  override display(): void {
    this.vaultPathSuggestionCatalog.start();
    this.render(null);
  }

  activate(tab: SettingsTabId): void {
    this.activeTab = tab;
    if (this.containerEl.isConnected) this.render(null);
  }

  override hide(): void {
    this.settingsSave.close();
    this.vaultPathSuggestionCatalog.dispose();
    super.hide();
  }

  private render(focusTab: SettingsTabId | null): void {
    const { containerEl } = this;
    this.translator = createTranslator(this.host.settings.locale, navigator.language);
    containerEl.empty();
    containerEl.addClass("chrono-notes-settings");
    containerEl.dir = this.translator.direction;

    const { activeTabEl, panelEl } = createSettingsTabLayout(
      containerEl,
      getSettingsTabLabels(this.translator.t),
      this.activeTab,
      this.translator.t("settings.tabsLabel"),
      (tabId) => {
        this.activeTab = tabId;
        this.render(tabId);
      },
    );
    const sectionContext = this.createSectionContext();

    switch (this.activeTab) {
      case "appearance":
        renderAppearanceSettingsSection(panelEl, sectionContext);
        break;
      case "periodic":
        renderPeriodicSettingsSection(panelEl, sectionContext);
        break;
      case "ranges":
        renderRangeSettingsSection(panelEl, sectionContext);
        break;
      case "integrations":
        renderIntegrationsSettingsSection(panelEl, sectionContext);
        break;
      case "general":
      default:
        renderGeneralSettingsSection(panelEl, sectionContext);
        break;
    }

    if (focusTab !== null) {
      activeTabEl.focus();
    }
  }

  private createSectionContext(): SettingsSectionContext {
    return {
      app: this.app,
      host: this.host,
      translator: this.translator,
      vaultPathSuggestionCatalog: this.vaultPathSuggestionCatalog,
      persistSettings: () => this.settingsSave.saveNow(),
      scheduleSettingsSave: () => this.settingsSave.schedule(),
      flushSettingsSaveOnBlur: (inputEl) => {
        inputEl.addEventListener("blur", () => {
          this.settingsSave.flushInBackground();
        });
      },
      display: () => this.display(),
    };
  }
}
