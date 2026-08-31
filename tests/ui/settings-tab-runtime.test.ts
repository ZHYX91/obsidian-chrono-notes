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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

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

  it("cleans the active imperative section before rerendering and hiding", () => {
    const { tab } = createTab();
    const generalCleanup = vi.fn(() => {
      expect(tab.containerEl.querySelector('[data-tab-id="general"]')).not.toBeNull();
    });
    const appearanceCleanup = vi.fn(() => {
      expect(tab.containerEl.querySelector('[data-tab-id="appearance"]')).not.toBeNull();
    });
    mocks.renderGeneral.mockReturnValueOnce(generalCleanup);
    mocks.renderAppearance.mockReturnValueOnce(appearanceCleanup);

    tab.display();
    tab.containerEl.querySelector<HTMLButtonElement>(
      '[role="tab"][data-tab-id="appearance"]',
    )?.click();

    expect(generalCleanup).toHaveBeenCalledOnce();
    expect(appearanceCleanup).not.toHaveBeenCalled();

    mocks.baseHide.mockImplementationOnce(() => {
      expect(tab.containerEl.querySelector('[data-tab-id="appearance"]')).not.toBeNull();
      expect(appearanceCleanup).toHaveBeenCalledOnce();
    });
    tab.hide();

    expect(appearanceCleanup).toHaveBeenCalledOnce();
    expect(tab.containerEl.childElementCount).toBe(0);
  });

  it("does not let an asynchronous section callback revive a hidden surface", async () => {
    let resolveSave!: () => void;
    const save = new Promise<void>((resolve) => {
      resolveSave = resolve;
    });
    const { tab, context, saveSettings } = displayAndGetGeneralContext();
    saveSettings.mockReturnValueOnce(save);

    const continuation = context.persistSettings().then(() => context.display());
    tab.hide();
    resolveSave();
    await continuation;

    expect(mocks.renderGeneral).toHaveBeenCalledOnce();
    expect(tab.containerEl.childElementCount).toBe(0);
  });

  it("logs an imperative cleanup failure and still renders the next section", () => {
    const cleanupError = new Error("injected settings cleanup failure");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.renderGeneral.mockReturnValueOnce(() => {
      throw cleanupError;
    });
    const { tab } = createTab();

    tab.display();
    tab.containerEl.querySelector<HTMLButtonElement>(
      '[role="tab"][data-tab-id="appearance"]',
    )?.click();

    expect(consoleError).toHaveBeenCalledWith(
      "Chrono Notes: failed to clean up settings section",
      cleanupError,
    );
    expect(mocks.renderAppearance).toHaveBeenCalledOnce();
    consoleError.mockRestore();
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

  it("shows a localized future-schema warning and disables only settings controls", async () => {
    mocks.renderGeneral.mockImplementationOnce((containerEl: HTMLElement) => {
      containerEl.append(document.createElement("input"));
      containerEl.append(document.createElement("select"));
      containerEl.append(document.createElement("textarea"));
      containerEl.append(document.createElement("button"));
    });
    const { tab, host, saveSettings } = createTab();
    host.settings.locale = "zh-CN";
    host.isSettingsReadOnly = () => true;

    tab.display();

    const warningEl = tab.containerEl.querySelector<HTMLElement>(
      ".chrono-notes-settings-read-only-status",
    );
    const panelEl = tab.containerEl.querySelector<HTMLElement>(
      ".chrono-notes-settings-panel",
    );
    expect(warningEl?.textContent).toContain("较新版本");
    expect(warningEl?.getAttribute("role")).toBe("alert");
    expect(panelEl?.getAttribute("aria-disabled")).toBe("true");
    expect([
      ...(panelEl?.querySelectorAll<
        HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >("button, input, select, textarea") ?? []),
    ].every((control) => control.disabled)).toBe(true);
    expect([
      ...tab.containerEl.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    ].every((control) => !control.disabled)).toBe(true);
    expect(tab.getSettingDefinitions()).toEqual([]);

    await tab.setControlValue("locale", "en");
    expect(host.settings.locale).toBe("zh-CN");
    expect(saveSettings).not.toHaveBeenCalled();
  });

  it("applies locale direction to the declarative 1.13 surface", () => {
    const { tab, host } = createTab();
    host.settings.locale = "ar";

    expect(tab.getSettingDefinitions()).toEqual([]);
    tab.getDeclarativeSettingDefinitions();

    expect(tab.containerEl.dir).toBe("rtl");
    expect(tab.containerEl.classList.contains("chrono-notes-settings")).toBe(true);

    host.settings.locale = "hi";
    tab.getDeclarativeSettingDefinitions();
    expect(tab.containerEl.dir).toBe("ltr");
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

  it("shows a localized failure with explicit retry and keeps session edits", async () => {
    const error = new Error("disk full");
    const { tab, host, context, saveSettings } = displayAndGetGeneralContext();
    host.settings.locale = "zh-CN";
    tab.display();
    const localizedContext = mocks.renderGeneral.mock.calls.at(-1)?.[1] as
      | SettingsSectionContext
      | undefined;
    if (localizedContext === undefined) {
      throw new Error("Expected the localized settings section context.");
    }
    saveSettings.mockRejectedValueOnce(error).mockResolvedValueOnce(undefined);
    host.settings.showNoteNavbar = false;

    await expect(localizedContext.persistSettings()).rejects.toBe(error);

    const statusEl = tab.containerEl.querySelector<HTMLElement>(
      ".chrono-notes-settings-save-status",
    );
    const retryButtonEl = statusEl?.querySelector<HTMLButtonElement>(
      ".chrono-notes-settings-save-retry",
    );
    expect(statusEl).toMatchObject({ hidden: false });
    expect(statusEl?.getAttribute("role")).toBe("alert");
    expect(statusEl?.textContent).toContain("设置未能保存");
    expect(retryButtonEl?.textContent).toBe("重试");
    expect(retryButtonEl?.disabled).toBe(false);
    expect(host.settings.showNoteNavbar).toBe(false);

    retryButtonEl?.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(saveSettings).toHaveBeenCalledTimes(2);
    expect(statusEl).toMatchObject({ hidden: true });
    expect(host.settings.showNoteNavbar).toBe(false);
    expect(context.host.settings).toBe(host.settings);
  });

  it("retains a failed hide flush and shows it when settings reopen", async () => {
    const pendingSave = deferred<void>();
    const error = new Error("permission denied");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { tab, context, saveSettings } = displayAndGetGeneralContext();
    saveSettings.mockReturnValueOnce(pendingSave.promise);
    context.scheduleSettingsSave();

    tab.hide();
    pendingSave.reject(error);
    await Promise.resolve();
    await Promise.resolve();
    tab.display();

    const statusEl = tab.containerEl.querySelector<HTMLElement>(
      ".chrono-notes-settings-save-status",
    );
    expect(statusEl).toMatchObject({ hidden: false });
    expect(statusEl?.dataset.state).toBe("failed");
    expect(statusEl?.getAttribute("role")).toBe("alert");
    expect(consoleError).toHaveBeenCalledWith(
      "Chrono Notes: failed to save settings",
      error,
    );
    consoleError.mockRestore();
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

    const definitions = tab.getDeclarativeSettingDefinitions();

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
    tab.getDeclarativeSettingDefinitions();

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

    expect(update).toHaveBeenCalledOnce();
    expect(refreshDomState).toHaveBeenCalledTimes(2);
    expect(mocks.renderRanges).not.toHaveBeenCalled();
    tab.hide();
  });

  it("does not refresh a reopened declarative surface from an older pending save", async () => {
    let resolveSave!: () => void;
    const save = new Promise<void>((resolve) => {
      resolveSave = resolve;
    });
    const { tab, host, saveSettings } = createTab();
    const update = vi.fn();
    Object.defineProperty(tab, "update", { configurable: true, value: update });
    tab.getDeclarativeSettingDefinitions();
    saveSettings.mockReturnValueOnce(save);

    const pendingMutation = tab.setControlValue("locale", "zh-CN");
    tab.hide();
    const reopenedDefinitions = tab.getDeclarativeSettingDefinitions();
    resolveSave();
    await pendingMutation;

    expect(host.settings.locale).toBe("zh-CN");
    expect(reopenedDefinitions).toHaveLength(5);
    expect(update).not.toHaveBeenCalled();
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
    isSettingsReadOnly: () => false,
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
  readonly host: SettingsHost;
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
