import {
  PluginSettingTab,
  type App,
  type SettingDefinitionItem,
} from "obsidian";

import { createTranslator, type Translator } from "../../shared/i18n";
import { renderAppearanceSettingsSection } from "./appearance-settings-section";
import { renderGeneralSettingsSection } from "./general-settings-section";
import {
  renderExtensionsAndIntegrationsSettingsSection,
} from "./extensions-and-integrations-settings-section";
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
import {
  applyDeclarativeControlValue,
  getDeclarativeControlValue,
  getDeclarativeSettingDefinitions,
} from "./declarative-settings";

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
          console.error("Chrono Notes Calendar: failed to save settings", error);
        },
      },
    );
  }

  override display(): void {
    this.vaultPathSuggestionCatalog.start();
    this.render(null);
  }

  override getSettingDefinitions(): SettingDefinitionItem[] {
    this.translator = this.host.getTranslator();
    return getDeclarativeSettingDefinitions(
      this.createSectionContext(() => updateDeclarativeSettingTab(this)),
      this.activeTab,
    );
  }

  override getControlValue(key: string): unknown {
    return getDeclarativeControlValue(this.host.settings, key);
  }

  override async setControlValue(key: string, value: unknown): Promise<void> {
    const mutation = applyDeclarativeControlValue(this.host.settings, key, value);
    if (mutation.persistence === "scheduled") {
      this.settingsSave.schedule();
    } else {
      await this.settingsSave.saveNow();
    }
    if (mutation.refresh === "update") {
      updateDeclarativeSettingTab(this);
    } else if (mutation.refresh === "refresh-dom-state") {
      refreshDeclarativeSettingTabState(this);
    }
  }

  activate(tab: SettingsTabId): void {
    this.activeTab = tab;
    if (hasDeclarativeSettingApi(this) && this.containerEl.isConnected) {
      updateDeclarativeSettingTab(this);
    } else if (!hasDeclarativeSettingApi(this) && this.containerEl.isConnected) {
      this.render(null);
    }
  }

  override hide(): void {
    this.settingsSave.close();
    this.vaultPathSuggestionCatalog.dispose();
    super.hide();
  }

  private render(focusTab: SettingsTabId | null): void {
    const { containerEl } = this;
    this.translator = this.host.getTranslator();
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
      case "extensions-and-integrations":
        renderExtensionsAndIntegrationsSettingsSection(panelEl, sectionContext);
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

  private createSectionContext(
    display: () => void = () => this.render(null),
  ): SettingsSectionContext {
    return {
      app: this.app,
      host: this.host,
      translator: this.translator,
      vaultPathSuggestionCatalog: this.vaultPathSuggestionCatalog,
      persistSettings: () => this.settingsSave.saveNow(),
      scheduleSettingsSave: () => this.settingsSave.schedule(),
      flushSettingsSave: () => this.settingsSave.flushInBackground(),
      flushSettingsSaveOnBlur: (inputEl) => {
        inputEl.addEventListener("blur", () => {
          this.settingsSave.flushInBackground();
        });
      },
      display,
    };
  }
}

function hasDeclarativeSettingApi(settingTab: object): boolean {
  return typeof Reflect.get(settingTab, "update") === "function";
}

function updateDeclarativeSettingTab(settingTab: object): void {
  const update: unknown = Reflect.get(settingTab, "update");
  if (typeof update === "function") Reflect.apply(update, settingTab, []);
}

function refreshDeclarativeSettingTabState(settingTab: object): void {
  const refreshDomState: unknown = Reflect.get(settingTab, "refreshDomState");
  if (typeof refreshDomState === "function") {
    Reflect.apply(refreshDomState, settingTab, []);
  }
}
