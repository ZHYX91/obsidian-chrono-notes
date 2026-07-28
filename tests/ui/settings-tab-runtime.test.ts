import { Window } from "happy-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  baseHide: vi.fn(),
  renderGeneral: vi.fn(),
  renderAppearance: vi.fn(),
  renderPeriodic: vi.fn(),
  renderRanges: vi.fn(),
  renderIntegrations: vi.fn(),
}));

vi.mock("obsidian", () => ({
  AbstractInputSuggest: class {},
  prepareFuzzySearch: vi.fn(),
  renderResults: vi.fn(),
  PluginSettingTab: class {
    readonly app: unknown;
    readonly containerEl: HTMLElement;

    constructor(app: unknown) {
      this.app = app;
      const containerEl = document.createElement("div");
      Object.assign(containerEl, {
        empty: () => containerEl.replaceChildren(),
        addClass: (...classes: string[]) => containerEl.classList.add(...classes),
      });
      this.containerEl = containerEl;
    }

    hide(): void {
      mocks.baseHide();
    }
  },
}));

vi.mock("../../src/ui/settings/general-settings-section", () => ({
  renderGeneralSettingsSection: mocks.renderGeneral,
}));
vi.mock("../../src/ui/settings/appearance-settings-section", () => ({
  renderAppearanceSettingsSection: mocks.renderAppearance,
}));
vi.mock("../../src/ui/settings/periodic-settings-section", () => ({
  renderPeriodicSettingsSection: mocks.renderPeriodic,
}));
vi.mock("../../src/ui/settings/range-settings-section", () => ({
  renderRangeSettingsSection: mocks.renderRanges,
}));
vi.mock("../../src/ui/settings/extensions-and-integrations-settings-section", () => ({
  normalizeSourceInput: (value: string) =>
    [...new Set(value.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean))],
  renderExtensionsAndIntegrationsSettingsSection: mocks.renderIntegrations,
}));

import type { App } from "obsidian";

import { createTranslator } from "../../src/shared/i18n";
import { createDefaultSettings } from "../../src/shared/settings";
import { ChronoNotesSettingTab } from "../../src/ui/settings/settings-tab";
import type {
  SettingsHost,
  SettingsSectionContext,
} from "../../src/ui/settings/settings-section-context";
import { installObsidianDomFactories } from "../setup/obsidian-dom";

describe("ChronoNotesSettingTab save orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    const testWindow = new Window();
    installObsidianDomFactories(testWindow.document as unknown as Document);
    Object.assign(testWindow, {
      setTimeout: (callback: () => void, delayMs: number) =>
        globalThis.setTimeout(callback, delayMs),
      clearTimeout: (handle: ReturnType<typeof globalThis.setTimeout>) =>
        globalThis.clearTimeout(handle),
    });
    vi.stubGlobal("window", testWindow);
    vi.stubGlobal("document", testWindow.document);
    vi.stubGlobal("navigator", testWindow.navigator);
    vi.stubGlobal("HTMLElement", testWindow.HTMLElement);
    vi.stubGlobal("FocusEvent", testWindow.FocusEvent);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("routes the initial panel and a tab switch to the matching section renderer", () => {
    const { tab, host } = createTab();

    tab.display();
    expect(mocks.renderGeneral).toHaveBeenCalledOnce();
    expect(mocks.renderGeneral.mock.calls[0]?.[1]).toMatchObject({ host });

    const appearanceTab = tab.containerEl.querySelector<HTMLButtonElement>(
      '[role="tab"][data-tab-id="appearance"]',
    );
    appearanceTab?.click();

    expect(appearanceTab).not.toBeNull();
    expect(mocks.renderAppearance).toHaveBeenCalledOnce();
    expect(mocks.renderPeriodic).not.toHaveBeenCalled();
    expect(mocks.renderRanges).not.toHaveBeenCalled();
    expect(mocks.renderIntegrations).not.toHaveBeenCalled();
    expect(tab.containerEl.querySelector('[data-tab-id="appearance"]')
      ?.getAttribute("aria-selected")).toBe("true");

    const integrationsTab = tab.containerEl.querySelector<HTMLButtonElement>(
      '[role="tab"][data-tab-id="extensions-and-integrations"]',
    );
    integrationsTab?.click();

    expect(integrationsTab).not.toBeNull();
    expect(mocks.renderIntegrations).toHaveBeenCalledOnce();
    expect(tab.containerEl.querySelector('[data-tab-id="extensions-and-integrations"]')
      ?.getAttribute("aria-selected")).toBe("true");
    expect(tab.containerEl.querySelector('[data-tab-id="templates"]')).toBeNull();
  });

  it("sets the settings surface direction from the selected locale", () => {
    const { tab, host } = createTab();
    host.settings.locale = "ar";
    tab.display();
    expect(tab.containerEl.dir).toBe("rtl");

    host.settings.locale = "hi";
    tab.display();
    expect(tab.containerEl.dir).toBe("ltr");
  });

  it("uses the Obsidian locale supplied by the host when language is Auto", () => {
    const { tab, host } = createTab();
    host.settings.locale = "auto";
    host.getTranslator = () => createTranslator("auto", "ar");

    tab.display();

    expect(tab.containerEl.dir).toBe("rtl");
    expect(mocks.renderGeneral.mock.calls[0]?.[1]).toMatchObject({
      translator: {
        locale: "ar",
        direction: "rtl",
      },
    });
  });

  it("saves a scheduled section edit after the 300 ms debounce", async () => {
    const { context, saveSettings } = displayAndGetGeneralContext();

    context.scheduleSettingsSave();
    await vi.advanceTimersByTimeAsync(299);
    expect(saveSettings).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(saveSettings).toHaveBeenCalledOnce();
  });

  it("flushes a pending section edit immediately when its input blurs", async () => {
    const { context, saveSettings } = displayAndGetGeneralContext();
    const inputEl = document.createElement("input");
    context.flushSettingsSaveOnBlur(inputEl);
    context.scheduleSettingsSave();

    inputEl.dispatchEvent(new FocusEvent("blur"));
    await Promise.resolve();

    expect(saveSettings).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(300);
    expect(saveSettings).toHaveBeenCalledOnce();
  });

  it("flushes a pending declarative edit when its rendered row is cleaned up", async () => {
    const { context, saveSettings } = displayAndGetGeneralContext();
    context.scheduleSettingsSave();

    context.flushSettingsSave();
    await Promise.resolve();

    expect(saveSettings).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(300);
    expect(saveSettings).toHaveBeenCalledOnce();
  });

  it("flushes a pending edit before delegating the tab hide lifecycle", async () => {
    const { tab, context, saveSettings } = displayAndGetGeneralContext();
    context.scheduleSettingsSave();

    tab.hide();
    await Promise.resolve();

    expect(saveSettings).toHaveBeenCalledOnce();
    expect(mocks.baseHide).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(300);
    expect(saveSettings).toHaveBeenCalledOnce();
  });

  it("cancels a scheduled timer when the section persists immediately", async () => {
    const { context, saveSettings } = displayAndGetGeneralContext();
    context.scheduleSettingsSave();

    await context.persistSettings();
    expect(saveSettings).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(300);
    expect(saveSettings).toHaveBeenCalledOnce();
  });

  it("builds declarative pages without starting Vault suggestion listeners", () => {
    const { tab, vaultOn } = createTab();

    const definitions = tab.getSettingDefinitions();

    expect(definitions).toHaveLength(5);
    expect(vaultOn).not.toHaveBeenCalled();
  });

  it("persists declarative controls and selects the guarded 1.13 refresh path", async () => {
    const { tab, host, saveSettings } = createTab();
    const update = vi.fn();
    const refreshDomState = vi.fn();
    Object.defineProperty(tab, "update", { configurable: true, value: update });
    Object.defineProperty(tab, "refreshDomState", {
      configurable: true,
      value: refreshDomState,
    });

    await tab.setControlValue("locale", "zh-CN");

    expect(host.settings.locale).toBe("zh-CN");
    expect(saveSettings).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledOnce();
    expect(refreshDomState).not.toHaveBeenCalled();

    await tab.setControlValue("propertyDateDisplayFormat", "custom");
    expect(host.settings.propertyDateDisplayFormat).toBe("custom");
    expect(saveSettings).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledOnce();
    expect(refreshDomState).toHaveBeenCalledOnce();

    await tab.setControlValue("periodicNotes.daily.enabled", true);
    expect(host.settings.periodicNotes.daily.enabled).toBe(true);
    expect(saveSettings).toHaveBeenCalledTimes(3);
    expect(update).toHaveBeenCalledOnce();
    expect(refreshDomState).toHaveBeenCalledTimes(2);

    tab.activate("ranges");
    expect(update).toHaveBeenCalledTimes(2);
    expect(refreshDomState).toHaveBeenCalledTimes(2);
    expect(mocks.renderRanges).not.toHaveBeenCalled();
  });

  it("retains debounced persistence for declarative text controls", async () => {
    const { tab, host, saveSettings } = createTab();

    await tab.setControlValue("ics.sources", " a.ics\na.ics\nb.ics ");
    expect(host.settings.ics.sources).toEqual(["a.ics", "b.ics"]);
    expect(saveSettings).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);
    expect(saveSettings).toHaveBeenCalledOnce();
  });
});

function createTab(): {
  readonly tab: ChronoNotesSettingTab;
  readonly host: SettingsHost;
  readonly saveSettings: ReturnType<typeof vi.fn<() => Promise<void>>>;
  readonly vaultOn: ReturnType<typeof vi.fn>;
} {
  const saveSettings = vi.fn(async () => undefined);
  const settings = createDefaultSettings();
  const host = {
    settings,
    getTranslator: () => createTranslator(settings.locale, "en"),
    saveSettings,
    openIntervalNoteList: vi.fn(),
    getIcsSnapshot: vi.fn(() => null),
    refreshIcs: vi.fn(async () => undefined),
    openFirstUseGuide: vi.fn(),
  } as unknown as SettingsHost;
  const vaultOn = vi.fn(() => ({}));
  const app = {
    vault: {
      on: vaultOn,
      offref: vi.fn(),
      getMarkdownFiles: vi.fn(() => []),
      getAllFolders: vi.fn(() => []),
    },
  } as unknown as App;
  const tab = new ChronoNotesSettingTab(app, host);
  document.body.append(tab.containerEl);
  return { tab, host, saveSettings, vaultOn };
}

function displayAndGetGeneralContext(): {
  readonly tab: ChronoNotesSettingTab;
  readonly context: SettingsSectionContext;
  readonly saveSettings: ReturnType<typeof vi.fn<() => Promise<void>>>;
} {
  const result = createTab();
  result.tab.display();
  const context = mocks.renderGeneral.mock.calls[0]?.[1];
  if (context === undefined) {
    throw new Error("Expected the general settings section to receive a context.");
  }
  return {
    ...result,
    context: context as SettingsSectionContext,
  };
}
