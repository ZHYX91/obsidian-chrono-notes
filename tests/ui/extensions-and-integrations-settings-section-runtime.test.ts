import { Window } from "happy-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toggleChange: null as ((enabled: boolean) => Promise<void>) | null,
  preparePathInput: vi.fn(),
  buttonText: vi.fn(),
  buttonDisabled: vi.fn(),
  descriptions: vi.fn(),
  dropdowns: new Map<string, { options: string[]; value: string | undefined }>(),
}));

vi.mock("obsidian", () => ({
  Setting: class {
    readonly settingEl = { addClass: vi.fn() };

    constructor(_containerEl: unknown) {}

    setName(): this {
      return this;
    }

    setDesc(text: string): this {
      mocks.descriptions(text);
      return this;
    }

    addDropdown(configure: (dropdown: unknown) => void): this {
      const state: { options: string[]; value: string | undefined } = { options: [], value: undefined };
      const dropdown = {
        selectEl: { dataset: {} as Record<string, string> },
        addOption(id: string) { state.options.push(id); return dropdown; },
        setValue(id: string) { state.value = id; return dropdown; },
        onChange: vi.fn(() => dropdown),
      };
      configure(dropdown);
      const control = dropdown.selectEl.dataset.chronoSettingsControl;
      if (control !== undefined) mocks.dropdowns.set(control, state);
      return this;
    }

    addToggle(configure: (toggle: unknown) => void): this {
      const toggle = {
        setValue: vi.fn(() => toggle),
        onChange: vi.fn((handler: (enabled: boolean) => Promise<void>) => {
          mocks.toggleChange = handler;
          return toggle;
        }),
      };
      configure(toggle);
      return this;
    }

    addTextArea(configure: (text: unknown) => void): this {
      const text = {
        inputEl: { rows: 0 },
        setPlaceholder: vi.fn(() => text),
        setValue: vi.fn(() => text),
        onChange: vi.fn(() => text),
      };
      configure(text);
      return this;
    }

    addButton(configure: (button: unknown) => void): this {
      const button = {
        setButtonText: vi.fn((text: string) => { mocks.buttonText(text); return button; }),
        setDisabled: vi.fn((value: boolean) => { mocks.buttonDisabled(value); return button; }),
        onClick: vi.fn(() => button),
      };
      configure(button);
      return this;
    }
  },
}));

vi.mock("../../src/ui/settings/path-input", () => ({
  preparePathInput: mocks.preparePathInput,
}));

import { IcsEventIndex, type IcsEventIndexSnapshot } from "../../src/features/calendar/ics-event-index";
import { createTranslator } from "../../src/shared/i18n";
import { createDefaultSettings } from "../../src/shared/settings";
import { renderExtensionsAndIntegrationsSettingsSection } from "../../src/ui/settings/extensions-and-integrations-settings-section";
import type { SettingsSectionContext } from "../../src/ui/settings/settings-section-context";
import { installObsidianDomFactories } from "../setup/obsidian-dom";

const testDocument = new Window().document as unknown as Document;
installObsidianDomFactories(testDocument);

describe("extensions and integrations settings runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.toggleChange = null;
    mocks.dropdowns.clear();
  });

  it("orders choices without changing saved slots and retains an unavailable selected calendar", () => {
    const settings = createDefaultSettings();
    settings.holidayRegions = ["cn"];
    settings.calendarExtensions = ["persian"];
    const persistSettings = vi.fn();
    const context = {
      host: {
        settings, isSettingsReadOnly: () => false, getIcsSnapshot: () => null,
        subscribeIcs: () => () => undefined,
      },
      translator: createTranslator("auto", "zh-SG"),
      persistSettings,
      flushSettingsSaveOnBlur: vi.fn(),
    } as unknown as SettingsSectionContext;
    const support = vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      locale: "en", calendar: "gregory", numberingSystem: "latn", timeZone: "UTC",
    });
    try {
      renderExtensionsAndIntegrationsSettingsSection(testDocument.createElement("div"), context);
      const firstRegion = mocks.dropdowns.get("holiday-region-0");
      expect(firstRegion?.options.slice(0, 3)).toEqual(["", "sg", "cn"]);
      expect(firstRegion?.value).toBe("cn");
      expect(mocks.dropdowns.get("holiday-region-1")?.options).not.toContain("cn");
      const calendar = mocks.dropdowns.get("calendar-extension-0");
      expect(calendar?.options).toContain("persian");
      expect(calendar?.value).toBe("persian");
      expect(mocks.dropdowns.get("calendar-extension-1")?.options).not.toContain("persian");
      expect(persistSettings).not.toHaveBeenCalled();
      expect(settings.calendarExtensions).toEqual(["persian"]);
    } finally {
      support.mockRestore();
    }
  });

  it("persists an ICS toggle once and delegates its single refresh to the plugin", async () => {
    const settings = createDefaultSettings();
    const persistSettings = vi.fn(async () => undefined);
    const refreshIcs = vi.fn(async () => undefined);
    const display = vi.fn();
    const context = {
      host: {
        settings,
        getIcsSnapshot: () => null,
        subscribeIcs: () => () => undefined,
        isSettingsReadOnly: () => false,
        refreshIcs,
      },
      translator: createTranslator("en", "en"),
      persistSettings,
      scheduleSettingsSave: vi.fn(),
      flushSettingsSave: vi.fn(),
      flushSettingsSaveOnBlur: vi.fn(),
      display,
    } as unknown as SettingsSectionContext;
    const containerEl = testDocument.createElement("div");

    renderExtensionsAndIntegrationsSettingsSection(containerEl, context);
    const onToggle = mocks.toggleChange;
    if (onToggle === null) throw new Error("Expected the ICS toggle handler.");
    await onToggle(true);

    expect(settings.ics.enabled).toBe(true);
    expect(persistSettings).toHaveBeenCalledOnce();
    expect(refreshIcs).not.toHaveBeenCalled();
    expect(display).not.toHaveBeenCalled();
  });

  it("updates background refresh feedback in place and unsubscribes when the section closes", () => {
    const index = new IcsEventIndex({ read: async () => "" });
    let snapshot: IcsEventIndexSnapshot = index.getSnapshot();
    let listener: () => void = () => undefined;
    const unsubscribe = vi.fn();
    const context = {
      host: {
        settings: createDefaultSettings(),
        getIcsSnapshot: () => snapshot,
        subscribeIcs: (callback: () => void) => { listener = callback; return unsubscribe; },
        isSettingsReadOnly: () => false,
      },
      translator: createTranslator("en", "en"),
      flushSettingsSaveOnBlur: vi.fn(),
      display: vi.fn(),
    } as unknown as SettingsSectionContext;
    const container = testDocument.createElement("div");
    const cleanup = renderExtensionsAndIntegrationsSettingsSection(container, context);
    const loaded = container.querySelector<HTMLDetailsElement>('[data-chrono-guide="ics-loaded-sources"]')!;
    expect(loaded.parentElement?.hidden).toBe(true);
    snapshot = { ...snapshot, enabled: true, state: "refreshing" };
    listener();
    expect(mocks.buttonDisabled).toHaveBeenLastCalledWith(true);
    expect(mocks.buttonText).toHaveBeenLastCalledWith("Refreshing");

    snapshot = {
      ...snapshot, state: "ready", totalSources: 1, loadedSources: 1,
      occurrenceLimit: 100_000, truncatedEvents: 2,
      sourceStatuses: [{ source: "Budget.ics", sourceLabel: "Budget.ics", eventCount: 275,
        skippedRecurring: 0, skippedInvalid: 0, error: null }],
    };
    listener();
    expect(mocks.buttonDisabled).toHaveBeenLastCalledWith(false);
    expect(mocks.buttonText).toHaveBeenLastCalledWith("Refresh now");
    expect(mocks.descriptions.mock.lastCall?.[0]).toContain("100000");
    expect(loaded.textContent).toContain("Budget.ics · Events: 275");
    expect(loaded.open).toBe(false);
    expect(loaded.parentElement?.hidden).toBe(false);
    expect(context.display).not.toHaveBeenCalled();

    loaded.open = true;
    const clean = snapshot.sourceStatuses[0]!;
    snapshot = { ...snapshot, totalSources: 5, loadedSources: 4, sourceStatuses: [
      clean,
      { ...clean, sourceLabel: "Repeat.ics", skippedRecurring: 2 },
      { ...clean, sourceLabel: "Invalid.ics", skippedInvalid: 1 },
      { ...clean, sourceLabel: "Zone.ics", skippedUnsupportedTimezone: 3 },
      { ...clean, sourceLabel: "Error.ics", error: "read failed" },
    ] };
    listener();
    expect(container.querySelector("details")).toBe(loaded);
    expect(loaded.open).toBe(true);
    const issues = container.querySelector(".chrono-notes-ics-status")!.firstElementChild!;
    for (const name of ["Repeat.ics", "Invalid.ics", "Zone.ics", "Error.ics"]) {
      expect(issues.textContent).toContain(name);
      expect(loaded.textContent).not.toContain(name);
    }

    snapshot = { ...snapshot, totalSources: 8, sourceLimit: 5 };
    listener();
    expect(mocks.descriptions.mock.lastCall?.[0]).toContain("3 sources were omitted");
    expect(mocks.descriptions.mock.lastCall?.[0]).toContain("100000");
    expect(context.display).not.toHaveBeenCalled();

    cleanup();
    expect(unsubscribe).toHaveBeenCalledOnce();
    mocks.descriptions.mockClear();
    listener();
    expect(mocks.descriptions).not.toHaveBeenCalled();
  });
});
