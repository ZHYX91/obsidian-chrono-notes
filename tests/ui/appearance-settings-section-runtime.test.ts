import { beforeEach, describe, expect, it, vi } from "vitest";

interface SettingRecord {
  name: string;
  disabled: boolean;
  toggleValue: boolean | null;
  onToggle: ((enabled: boolean) => Promise<void>) | null;
}

const mocks = vi.hoisted(() => ({
  settings: [] as SettingRecord[],
}));

vi.mock("obsidian", () => ({
  Setting: class {
    private readonly record: SettingRecord;

    constructor(_containerEl: unknown) {
      this.record = {
        name: "",
        disabled: false,
        toggleValue: null,
        onToggle: null,
      };
      mocks.settings.push(this.record);
    }

    setName(name: string): this {
      this.record.name = name;
      return this;
    }

    setDesc(): this {
      return this;
    }

    setDisabled(disabled: boolean): this {
      this.record.disabled = disabled;
      return this;
    }

    addToggle(configure: (toggle: unknown) => void): this {
      const toggle = {
        setValue: vi.fn((value: boolean) => {
          this.record.toggleValue = value;
          return toggle;
        }),
        onChange: vi.fn((handler: (enabled: boolean) => Promise<void>) => {
          this.record.onToggle = handler;
          return toggle;
        }),
      };
      configure(toggle);
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

    addSlider(configure: (slider: unknown) => void): this {
      const slider = {
        setLimits: vi.fn(() => slider),
        setValue: vi.fn(() => slider),
        setDynamicTooltip: vi.fn(() => slider),
        onChange: vi.fn(() => slider),
      };
      configure(slider);
      return this;
    }

    addText(configure: (text: unknown) => void): this {
      const text = {
        inputEl: { inputMode: "" },
        setValue: vi.fn(() => text),
        onChange: vi.fn(() => text),
      };
      configure(text);
      return this;
    }
  },
}));

import { createDefaultSettings } from "../../src/shared/settings";
import { renderAppearanceSettingsSection } from "../../src/ui/settings/appearance-settings-section";
import type { SettingsSectionContext } from "../../src/ui/settings/settings-section-context";

describe("appearance settings runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.settings.length = 0;
  });

  it("keeps task progress next to and dependent on note status", async () => {
    const settings = createDefaultSettings();
    settings.showNoteIndicators = false;
    settings.showTaskProgress = true;
    const persistSettings = vi.fn(async () => undefined);
    const display = vi.fn();
    const context = {
      host: { settings },
      translator: { t: (key: string) => key },
      persistSettings,
      scheduleSettingsSave: vi.fn(),
      flushSettingsSaveOnBlur: vi.fn(),
      display,
    } as unknown as SettingsSectionContext;
    const containerEl = {
      createEl: vi.fn(),
    } as unknown as HTMLElement;

    renderAppearanceSettingsSection(containerEl, context);

    const noteStatusIndex = mocks.settings.findIndex(
      ({ name }) => name === "settings.appearance.showNoteIndicators",
    );
    const taskProgressIndex = mocks.settings.findIndex(
      ({ name }) => name === "settings.appearance.showTaskProgress",
    );
    const noteStatus = mocks.settings[noteStatusIndex];
    const taskProgress = mocks.settings[taskProgressIndex];

    expect(taskProgressIndex).toBe(noteStatusIndex + 1);
    expect(noteStatus?.toggleValue).toBe(false);
    expect(taskProgress?.toggleValue).toBe(true);
    expect(taskProgress?.disabled).toBe(true);

    await noteStatus?.onToggle?.(true);
    expect(settings.showNoteIndicators).toBe(true);
    expect(settings.showTaskProgress).toBe(true);
    expect(persistSettings).toHaveBeenCalledOnce();
    expect(display).toHaveBeenCalledOnce();

    await taskProgress?.onToggle?.(false);
    expect(settings.showTaskProgress).toBe(false);
    expect(persistSettings).toHaveBeenCalledTimes(2);
  });
});
