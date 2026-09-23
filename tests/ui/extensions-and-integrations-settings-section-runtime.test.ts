import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toggleChange: null as ((enabled: boolean) => Promise<void>) | null,
  preparePathInput: vi.fn(),
  buttonText: vi.fn(),
  buttonDisabled: vi.fn(),
  descriptions: vi.fn(),
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
      const dropdown = {
        addOption: vi.fn(() => dropdown),
        setValue: vi.fn(() => dropdown),
        onChange: vi.fn(() => dropdown),
      };
      configure(dropdown);
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

describe("extensions and integrations settings runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.toggleChange = null;
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
      translator: { t: (key: string) => key },
      persistSettings,
      scheduleSettingsSave: vi.fn(),
      flushSettingsSave: vi.fn(),
      flushSettingsSaveOnBlur: vi.fn(),
      display,
    } as unknown as SettingsSectionContext;
    const containerEl = {
      createEl: vi.fn(),
      createDiv: vi.fn(() => ({ empty: vi.fn(), hidden: false })),
    } as unknown as HTMLElement;

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
    const list = { empty: vi.fn(), createDiv: vi.fn(), hidden: false };
    const container = { createEl: vi.fn(), createDiv: vi.fn(() => list) };
    const cleanup = renderExtensionsAndIntegrationsSettingsSection(
      container as unknown as HTMLElement, context,
    );
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
    expect(list.createDiv).toHaveBeenCalledWith(expect.objectContaining({
      text: expect.stringContaining("275 events"),
    }));
    expect(context.display).not.toHaveBeenCalled();
    expect(container.createDiv).toHaveBeenCalledOnce();

    snapshot = { ...snapshot, totalSources: 4, sourceLimit: 1 };
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
