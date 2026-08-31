import {
  PluginSettingTab,
  type App,
  type Plugin,
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
import {
  SettingsSaveCoordinator,
  type SettingsSaveStatus,
} from "./settings-save-coordinator";
import type { SettingsCleanup } from "./settings-cleanup";
import { createSettingsTabLayout } from "./settings-tab-layout";
import type { SettingsTabId } from "./settings-tab-navigation";
import { getSettingsTabLabels } from "./settings-presentation";
import { VaultPathSuggestionCatalog } from "./vault-path-suggest";
import {
  applyDeclarativeControlValue,
  getDeclarativeControlValue,
  getDeclarativeSettingDefinitions,
} from "./declarative-settings";

// Declarative settings are intentionally inactive. Obsidian 1.13 renders
// non-empty definitions as navigable pages and bypasses display(), which removes
// this plugin's top tab bar and degrades the established settings experience.
// Dormant definitions remain covered by tests but must not become active by default.
const ENABLE_DECLARATIVE_SETTINGS = false;

export class ChronoNotesSettingTab extends PluginSettingTab {
  private static readonly TEXT_SAVE_DELAY_MS = 300;

  private activeTab: SettingsTabId = "general";
  private readonly settingsSave: SettingsSaveCoordinator;
  private readonly vaultPathSuggestionCatalog: VaultPathSuggestionCatalog;
  private imperativeSectionCleanup: SettingsCleanup | null = null;
  private imperativeSaveStatusCleanup: SettingsCleanup | null = null;
  private surfaceRevision = 0;
  private surfaceVisible = false;
  private translator: Translator = createTranslator("en", "en");

  constructor(app: App, private readonly host: SettingsHost) {
    // The Obsidian base class keeps a plugin reference for its own rendering
    // lifecycle; the tab itself only consumes the narrow SettingsHost port.
    super(app, host as unknown as Plugin);
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
    this.surfaceVisible = true;
    this.vaultPathSuggestionCatalog.start();
    this.render(null);
  }

  override getSettingDefinitions(): SettingDefinitionItem[] {
    if (!ENABLE_DECLARATIVE_SETTINGS) return [];
    return this.getDeclarativeSettingDefinitions();
  }

  getDeclarativeSettingDefinitions(): SettingDefinitionItem[] {
    this.surfaceVisible = true;
    const surfaceRevision = ++this.surfaceRevision;
    this.translator = this.host.getTranslator();
    this.applySurfaceSemantics();
    return getDeclarativeSettingDefinitions(
      this.createSectionContext(
        () => updateDeclarativeSettingTab(this),
        surfaceRevision,
      ),
    );
  }

  override getControlValue(key: string): unknown {
    return getDeclarativeControlValue(this.host.settings, key);
  }

  override async setControlValue(key: string, value: unknown): Promise<void> {
    if (this.host.isSettingsReadOnly()) return;
    const surfaceRevision = this.surfaceRevision;
    const mutation = applyDeclarativeControlValue(this.host.settings, key, value);
    if (mutation.persistence === "scheduled") {
      this.settingsSave.schedule();
    } else {
      await this.settingsSave.saveNow();
    }
    if (!this.isSurfaceCurrent(surfaceRevision)) return;
    if (mutation.refresh === "update") {
      this.surfaceRevision += 1;
      updateDeclarativeSettingTab(this);
    } else if (mutation.refresh === "refresh-dom-state") {
      refreshDeclarativeSettingTabState(this);
    }
  }

  override hide(): void {
    this.surfaceVisible = false;
    this.surfaceRevision += 1;
    this.cleanupImperativeSection();
    try {
      // Obsidian 1.13 owns declarative control cleanup in the base lifecycle,
      // so let it release those resources while their DOM is still attached.
      super.hide();
    } finally {
      this.containerEl.empty();
      this.settingsSave.close();
      this.vaultPathSuggestionCatalog.dispose();
    }
  }

  flushSettingsSaveOnUnload(): void {
    this.settingsSave.close();
  }

  private render(focusTab: SettingsTabId | null): void {
    if (!this.surfaceVisible) return;
    const surfaceRevision = ++this.surfaceRevision;
    const { containerEl } = this;
    this.translator = this.host.getTranslator();
    this.cleanupImperativeSection();
    containerEl.empty();
    this.applySurfaceSemantics();

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
    const settingsReadOnly = this.host.isSettingsReadOnly();
    if (settingsReadOnly) this.renderReadOnlyStatus(panelEl);
    this.imperativeSaveStatusCleanup = this.renderSaveStatus(panelEl);
    const sectionContext = this.createSectionContext(undefined, surfaceRevision);

    let cleanup: SettingsCleanup | void;
    switch (this.activeTab) {
      case "appearance":
        cleanup = renderAppearanceSettingsSection(panelEl, sectionContext);
        break;
      case "periodic":
        cleanup = renderPeriodicSettingsSection(panelEl, sectionContext);
        break;
      case "ranges":
        cleanup = renderRangeSettingsSection(panelEl, sectionContext);
        break;
      case "extensions-and-integrations":
        cleanup = renderExtensionsAndIntegrationsSettingsSection(panelEl, sectionContext);
        break;
      case "general":
      default:
        cleanup = renderGeneralSettingsSection(panelEl, sectionContext);
        break;
    }
    this.imperativeSectionCleanup = cleanup ?? null;
    if (settingsReadOnly) this.disableSettingsControls(panelEl);

    if (focusTab !== null) {
      activeTabEl.focus();
    }
  }

  private cleanupImperativeSection(): void {
    const saveStatusCleanup = this.imperativeSaveStatusCleanup;
    this.imperativeSaveStatusCleanup = null;
    saveStatusCleanup?.();

    const cleanup = this.imperativeSectionCleanup;
    this.imperativeSectionCleanup = null;
    if (cleanup === null) return;

    try {
      cleanup();
    } catch (error) {
      console.error("Chrono Notes: failed to clean up settings section", error);
    }
  }

  private renderSaveStatus(containerEl: HTMLElement): SettingsCleanup {
    const statusEl = containerEl.createDiv({
      cls: "chrono-notes-settings-save-status",
    });
    const messageEl = statusEl.createSpan({
      cls: "chrono-notes-settings-save-message",
    });
    const retryButtonEl = statusEl.createEl("button", {
      cls: "chrono-notes-settings-save-retry",
      text: this.translator.t("settings.save.retry"),
    });
    retryButtonEl.type = "button";
    const retry = (): void => this.settingsSave.retryInBackground();
    retryButtonEl.addEventListener("click", retry);

    const renderStatus = (status: SettingsSaveStatus): void => {
      statusEl.dataset.state = status.state;
      statusEl.hidden = status.state === "idle";
      statusEl.classList.toggle("is-error", status.state === "failed");
      statusEl.setAttribute("role", status.state === "failed" ? "alert" : "status");
      statusEl.setAttribute(
        "aria-live",
        status.state === "failed" ? "assertive" : "polite",
      );
      retryButtonEl.hidden = status.state !== "failed";
      retryButtonEl.disabled = status.state !== "failed";
      switch (status.state) {
        case "scheduled":
          messageEl.textContent = this.translator.t("settings.save.scheduled");
          break;
        case "saving":
          messageEl.textContent = this.translator.t("settings.save.saving");
          break;
        case "failed":
          messageEl.textContent = this.translator.t("settings.save.failed");
          break;
        case "idle":
        default:
          messageEl.textContent = "";
          break;
      }
    };
    const unsubscribe = this.settingsSave.subscribe(renderStatus);
    return () => {
      unsubscribe();
      retryButtonEl.removeEventListener("click", retry);
    };
  }

  private renderReadOnlyStatus(containerEl: HTMLElement): void {
    const statusEl = containerEl.createDiv({
      cls: "chrono-notes-settings-read-only-status",
      text: this.translator.t("settings.readOnly.futureSchema"),
    });
    statusEl.setAttribute("role", "alert");
    statusEl.setAttribute("aria-live", "polite");
  }

  private disableSettingsControls(containerEl: HTMLElement): void {
    containerEl.setAttribute("aria-disabled", "true");
    const controls = containerEl.querySelectorAll<
      HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("button, input, select, textarea");
    for (const control of controls) control.disabled = true;
  }

  private applySurfaceSemantics(): void {
    this.containerEl.addClass("chrono-notes-settings");
    this.containerEl.dir = this.translator.direction;
  }

  private createSectionContext(
    display: () => void = () => this.render(null),
    surfaceRevision = this.surfaceRevision,
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
      display: () => {
        if (this.isSurfaceCurrent(surfaceRevision)) display();
      },
    };
  }

  private isSurfaceCurrent(surfaceRevision: number): boolean {
    return this.surfaceVisible && this.surfaceRevision === surfaceRevision;
  }
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
