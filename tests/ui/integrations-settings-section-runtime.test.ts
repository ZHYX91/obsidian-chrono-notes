import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toggleChange: null as ((enabled: boolean) => Promise<void>) | null,
  preparePathInput: vi.fn(),
}));

vi.mock("obsidian", () => ({
  Setting: class {
    readonly settingEl = { addClass: vi.fn() };

    constructor(_containerEl: unknown) {}

    setName(): this {
      return this;
    }

    setDesc(): this {
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
        setButtonText: vi.fn(() => button),
        setDisabled: vi.fn(() => button),
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

vi.mock("../../src/ui/settings/settings-presentation", () => ({
  formatIcsSourceStatus: vi.fn(() => "source"),
  formatIcsStatus: vi.fn(() => "status"),
}));

import { createDefaultSettings } from "../../src/shared/settings";
import { renderIntegrationsSettingsSection } from "../../src/ui/settings/integrations-settings-section";
import type { SettingsSectionContext } from "../../src/ui/settings/settings-section-context";

describe("integrations settings runtime", () => {
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
        refreshIcs,
      },
      translator: { t: (key: string) => key },
      persistSettings,
      scheduleSettingsSave: vi.fn(),
      flushSettingsSaveOnBlur: vi.fn(),
      display,
    } as unknown as SettingsSectionContext;
    const containerEl = {
      createEl: vi.fn(),
      createDiv: vi.fn(),
    } as unknown as HTMLElement;

    renderIntegrationsSettingsSection(containerEl, context);
    const onToggle = mocks.toggleChange;
    if (onToggle === null) throw new Error("Expected the ICS toggle handler.");
    await onToggle(true);

    expect(settings.ics.enabled).toBe(true);
    expect(persistSettings).toHaveBeenCalledOnce();
    expect(refreshIcs).not.toHaveBeenCalled();
    expect(display).toHaveBeenCalledOnce();
  });
});
