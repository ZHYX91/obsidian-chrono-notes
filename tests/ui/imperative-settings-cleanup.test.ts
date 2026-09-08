import { Window } from "happy-dom";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  markdownClose: [] as Array<ReturnType<typeof vi.fn>>,
  periodicClose: [] as Array<ReturnType<typeof vi.fn>>,
  vaultClose: [] as Array<ReturnType<typeof vi.fn>>,
}));

vi.mock("obsidian", () => ({
  setIcon: vi.fn(),
  Setting: class {
    readonly settingEl = document.createElement("div");
    readonly descEl = document.createElement("div");
    readonly controlEl = document.createElement("div");

    constructor(containerEl: HTMLElement) {
      this.settingEl.append(this.descEl, this.controlEl);
      containerEl.append(this.settingEl);
    }

    setName(): this {
      return this;
    }

    setDesc(): this {
      return this;
    }

    setDisabled(): this {
      return this;
    }

    addToggle(configure: (toggle: unknown) => void): this {
      const toggle = createChainableControl();
      configure(toggle);
      return this;
    }

    addDropdown(configure: (dropdown: unknown) => void): this {
      const dropdown = createChainableControl();
      configure(dropdown);
      return this;
    }

    addButton(configure: (button: unknown) => void): this {
      const button = createChainableControl();
      configure(button);
      return this;
    }

    addText(configure: (text: unknown) => void): this {
      const inputEl = document.createElement("input");
      this.controlEl.append(inputEl);
      const text = createChainableControl({ inputEl });
      configure(text);
      return this;
    }
  },
}));

vi.mock("../../src/ui/settings/vault-path-suggest", () => ({
  MarkdownFileSuggest: class {
    readonly close = vi.fn();

    constructor() {
      mocks.markdownClose.push(this.close);
    }
  },
  PeriodicNoteFolderSuggest: class {
    readonly close = vi.fn();

    constructor() {
      mocks.periodicClose.push(this.close);
    }
  },
  VaultFolderSuggest: class {
    readonly close = vi.fn();

    constructor() {
      mocks.vaultClose.push(this.close);
    }
  },
}));

import type { App } from "obsidian";

import { createTranslator } from "../../src/shared/i18n";
import { createDefaultSettings } from "../../src/shared/settings";
import { renderPeriodicSettingsSection } from "../../src/ui/settings/periodic-settings-section";
import { renderTemplateSyntaxGuide } from "../../src/ui/settings/template-guide";
import { renderRangeSettingsSection } from "../../src/ui/settings/range-settings-section";
import { combineSettingsCleanups } from "../../src/ui/settings/settings-cleanup";
import type {
  SettingsHost,
  SettingsSectionContext,
} from "../../src/ui/settings/settings-section-context";
import { installObsidianDomFactories } from "../setup/obsidian-dom";

describe("imperative settings cleanup", () => {
  beforeAll(() => {
    const testWindow = new Window();
    installObsidianDomFactories(testWindow.document as unknown as Document);
    vi.stubGlobal("window", testWindow);
    vi.stubGlobal("document", testWindow.document);
    vi.stubGlobal("HTMLElement", testWindow.HTMLElement);
    Object.defineProperties(HTMLElement.prototype, {
      addClass: {
        configurable: true,
        value(this: HTMLElement, ...classes: string[]): void {
          this.classList.add(...classes);
        },
      },
      empty: {
        configurable: true,
        value(this: HTMLElement): void {
          this.replaceChildren();
        },
      },
      setText: {
        configurable: true,
        value(this: HTMLElement, text: string): void {
          this.textContent = text;
        },
      },
    });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.markdownClose.length = 0;
    mocks.periodicClose.length = 0;
    mocks.vaultClose.length = 0;
  });

  it("closes every periodic folder and template suggestion exactly once", () => {
    const context = createContext();
    context.host.settings.periodicNotes.daily.enabled = true;
    context.host.settings.periodicNotes.weekly.enabled = true;

    const cleanup = renderPeriodicSettingsSection(document.createElement("div"), context);

    expect(mocks.periodicClose).toHaveLength(2);
    expect(mocks.markdownClose).toHaveLength(2);

    cleanup();
    cleanup();

    expect([...mocks.periodicClose, ...mocks.markdownClose].every(
      (close) => close.mock.calls.length === 1,
    )).toBe(true);
  });

  it.each(["builtin", "templater"] as const)("keeps %s template guidance with its note type", (engine) => {
    const context = createContext();
    context.host.settings.templateEngine = engine;
    const paths = document.createElement("div");
    const templates = document.createElement("div");
    const ranges = document.createElement("div");
    const cleanup = renderPeriodicSettingsSection(paths, context);
    const rangeCleanup = renderRangeSettingsSection(ranges, context);
    renderTemplateSyntaxGuide(templates, context);
    expect(paths.querySelectorAll(".chrono-notes-periodic-note-section")).toHaveLength(7);
    expect(templates.querySelectorAll(".chrono-notes-settings-guide")).toHaveLength(1);
    expect(paths.querySelectorAll(".chrono-notes-settings-guide")).toHaveLength(2);
    expect(ranges.querySelectorAll(".chrono-notes-settings-guide")).toHaveLength(2);
    expect(paths.textContent).toContain("2001-01-01");
    expect(paths.textContent).toContain("2100-12-31");
    expect(paths.textContent).toContain("based on its first year, 2000");
    expect(ranges.textContent).toContain("chrono-notes: interval");
    const periodicExample = engine === "builtin" ? "{{date:DEC[s]}}" : '<% tp_calendar.date("DEC[s]") %>';
    const centuryExample = engine === "builtin" ? "{{date:[C]CEN}}" : '<% tp_calendar.date("[C]CEN") %>';
    const date = engine === "builtin" ? "{{date}}" : "<% tp_calendar.date() %>";
    const days = engine === "builtin" ? "{{days}}" : "<% tp_calendar.dayCount %>";
    expect(paths.textContent).toContain(periodicExample);
    expect(paths.textContent).toContain(centuryExample);
    expect(paths.textContent).toContain(date);
    expect(paths.textContent).toContain(days);
    expect(ranges.textContent).toContain(days);
    expect(ranges.textContent).not.toContain(date);
    expect(templates.textContent).not.toContain(periodicExample);
    expect(templates.textContent).toContain("HH:mm");
    expect(templates.textContent).toContain("YYYY-MM-DD");
    cleanup();
    rangeCleanup();
  });

  it("closes range, custom scan, and template suggestions exactly once", () => {
    const context = createContext();

    const cleanup = renderRangeSettingsSection(document.createElement("div"), context);

    expect(mocks.vaultClose).toHaveLength(2);
    expect(mocks.markdownClose).toHaveLength(1);

    cleanup();
    cleanup();

    expect([...mocks.vaultClose, ...mocks.markdownClose].every(
      (close) => close.mock.calls.length === 1,
    )).toBe(true);
  });

  it("explains explicit and unmarked range-note recognition before controls", () => {
    const container = document.createElement("div");

    renderRangeSettingsSection(container, createContext());

    const guide = container.querySelector<HTMLElement>(".chrono-notes-settings-guide");
    expect(guide?.getAttribute("role")).toBe("note");
    expect(guide?.textContent).toContain("Range-note recognition rules");
    expect(guide?.textContent).toContain("chrono-notes: interval");
    expect(guide?.textContent).toContain("does not modify existing notes automatically");
    expect(container.firstElementChild).toBe(guide);
  });

  it("runs every cleanup in reverse order before reporting the first failure", () => {
    const order: string[] = [];
    const cleanup = combineSettingsCleanups([
      () => order.push("first"),
      () => {
        order.push("second");
        throw new Error("injected cleanup failure");
      },
      () => order.push("third"),
    ]);

    expect(cleanup).toThrow("injected cleanup failure");
    expect(order).toEqual(["third", "second", "first"]);

    cleanup();
    expect(order).toEqual(["third", "second", "first"]);
  });
});

function createChainableControl(extra: object = {}): Record<string, unknown> {
  const control: Record<string, unknown> = { ...extra };
  for (const method of [
    "addOption",
    "onChange",
    "onClick",
    "setButtonText",
    "setPlaceholder",
    "setValue",
  ]) {
    control[method] = vi.fn(() => control);
  }
  return control;
}

function createContext(): SettingsSectionContext {
  const settings = createDefaultSettings();
  const host = {
    settings,
    openIntervalNoteList: vi.fn(),
  } as unknown as SettingsHost;

  return {
    app: {} as App,
    host,
    translator: createTranslator("en", "en"),
    vaultPathSuggestionCatalog: {} as SettingsSectionContext["vaultPathSuggestionCatalog"],
    persistSettings: vi.fn(async () => undefined),
    scheduleSettingsSave: vi.fn(),
    flushSettingsSave: vi.fn(),
    flushSettingsSaveOnBlur: vi.fn(),
    display: vi.fn(),
  };
}
