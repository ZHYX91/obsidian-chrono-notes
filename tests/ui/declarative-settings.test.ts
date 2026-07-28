import type {
  Setting,
  SettingDefinitionItem,
  SettingDefinitionPage,
  SettingDefinitionRender,
} from "obsidian";
import { describe, expect, it, vi } from "vitest";

const obsidianMocks = vi.hoisted(() => ({
  closeSuggest: vi.fn(),
}));

vi.mock("obsidian", () => ({
  AbstractInputSuggest: class {
    close(): void {
      obsidianMocks.closeSuggest();
    }
  },
  moment: vi.fn(() => {
    const formatter = {
      format: vi.fn(() => "2026-07-31"),
      locale: vi.fn(() => formatter),
    };
    return formatter;
  }),
  Platform: { isMobileApp: false },
  prepareFuzzySearch: vi.fn(),
  renderResults: vi.fn(),
  Setting: class {},
}));

import { createTranslator } from "../../src/shared/i18n";
import { createDefaultSettings } from "../../src/shared/settings";
import {
  applyDeclarativeControlValue,
  getDeclarativeControlValue,
  getDeclarativeSettingDefinitions,
  type ChronoNotesControlKey,
} from "../../src/ui/settings/declarative-settings";
import type {
  SettingsHost,
  SettingsSectionContext,
} from "../../src/ui/settings/settings-section-context";

describe("declarative settings", () => {
  it("indexes five unique native pages without traversing the Vault", () => {
    const { context, startCatalog } = createContext();

    const pages = getPages(getDeclarativeSettingDefinitions(context, "general"));

    expect(pages.map(({ name }) => name)).toEqual([
      "General",
      "Appearance & views",
      "Periodic notes",
      "Range notes",
      "Extensions & integrations",
    ]);
    expect(new Set(pages.map(({ name }) => name)).size).toBe(pages.length);
    expect(pages[0]?.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "group",
        cls: "chrono-notes-property-format-settings",
      }),
    ]));
    expect(getControlKeys(pages)).toEqual([
      "locale",
      "weekStartDay",
      "showNoteNavbar",
      "propertyDateDisplayFormat",
      "propertyTimeDisplayFormat",
      "interceptPropertyDateClicks",
      "templateEngine",
      "showHoverPreview",
      "quarterNameMode",
      "fontSizeMode",
      "immutableFontSizeFactor",
      "showNoteIndicators",
      "showTaskProgress",
      "statisticDisplayDimension",
      "statisticValueStep",
      "confirmPeriodicNoteCreation",
      "cascadeLargerNotes",
      "periodicNotes.daily.enabled",
      "periodicNotes.weekly.enabled",
      "periodicNotes.monthly.enabled",
      "periodicNotes.quarterly.enabled",
      "periodicNotes.yearly.enabled",
      "confirmIntervalNoteCreation",
      "rangeNotes.showInCalendar",
      "rangeNotes.scanScope",
      "rangeNotes.monthViewLimit",
      "rangeNotes.weekViewLimit",
      "calendarExtensions.0",
      "calendarExtensions.1",
      "holidayRegions.0",
      "holidayRegions.1",
      "holidayRegions.2",
      "ics.enabled",
      "ics.sources",
    ]);
    expect(startCatalog).not.toHaveBeenCalled();
  });

  it("moves an explicitly requested legacy section to the first native page", () => {
    const { context } = createContext();

    const pages = getPages(getDeclarativeSettingDefinitions(context, "ranges"));

    expect(pages[0]?.name).toBe("Range notes");
    expect(pages.map(({ name }) => name).sort()).toEqual([
      "Appearance & views",
      "Extensions & integrations",
      "General",
      "Periodic notes",
      "Range notes",
    ]);
  });

  it("binds nested values, validates mutations, and reports refresh requirements", () => {
    const settings = createDefaultSettings();

    expect(getDeclarativeControlValue(settings, "periodicNotes.daily.enabled")).toBe(false);
    expect(getDeclarativeControlValue(settings, "ics.sources")).toBe("");
    expect(getDeclarativeControlValue(settings, "unknown")).toBeUndefined();

    expect(applyDeclarativeControlValue(settings, "locale", "zh-CN")).toEqual({
      persistence: "immediate",
      refresh: "update",
    });
    expect(settings.locale).toBe("zh-CN");

    expect(applyDeclarativeControlValue(settings, "weekStartDay", "sunday")).toEqual({
      persistence: "immediate",
      refresh: "none",
    });

    expect(applyDeclarativeControlValue(
      settings,
      "periodicNotes.daily.enabled",
      true,
    )).toEqual({ persistence: "immediate", refresh: "refresh-dom-state" });
    expect(settings.periodicNotes.daily.enabled).toBe(true);

    expect(applyDeclarativeControlValue(
      settings,
      "propertyDateDisplayFormat",
      "custom",
    )).toEqual({ persistence: "immediate", refresh: "refresh-dom-state" });
    expect(applyDeclarativeControlValue(
      settings,
      "fontSizeMode",
      "follow-obsidian",
    )).toEqual({ persistence: "immediate", refresh: "refresh-dom-state" });
    expect(applyDeclarativeControlValue(
      settings,
      "showNoteIndicators",
      false,
    )).toEqual({ persistence: "immediate", refresh: "refresh-dom-state" });
    expect(applyDeclarativeControlValue(
      settings,
      "rangeNotes.scanScope",
      "custom-folder",
    )).toEqual({ persistence: "immediate", refresh: "update" });

    applyDeclarativeControlValue(settings, "calendarExtensions.1", "ganzhi");
    applyDeclarativeControlValue(settings, "calendarExtensions.0", "ganzhi");
    expect(settings.calendarExtensions).toEqual(["ganzhi"]);

    expect(applyDeclarativeControlValue(
      settings,
      "ics.sources",
      " Calendars/team.ics\nCalendars/team.ics\nother.ics ",
    )).toEqual({ persistence: "scheduled", refresh: "none" });
    expect(settings.ics.sources).toEqual(["Calendars/team.ics", "other.ics"]);

    expect(applyDeclarativeControlValue(settings, "ics.enabled", true)).toEqual({
      persistence: "immediate",
      refresh: "none",
    });

    expect(() => applyDeclarativeControlValue(
      settings,
      "rangeNotes.monthViewLimit",
      0,
    )).toThrow("Invalid Chrono Notes maximum month lanes setting.");
    expect(() => applyDeclarativeControlValue(settings, "unknown", true)).toThrow(
      "Unsupported Chrono Notes setting control: unknown",
    );
  });

  it("renders custom path controls lazily and flushes their cleanup lifecycle", () => {
    obsidianMocks.closeSuggest.mockClear();
    const { context, startCatalog } = createContext();
    context.host.settings.periodicNotes.daily.enabled = true;
    const pages = getPages(getDeclarativeSettingDefinitions(context, "periodic"));
    const pathDefinition = getRenderDefinition(
      pages,
      context.translator.t("settings.periodic.pathPattern"),
    );
    const harness = createSettingHarness();

    expect(startCatalog).not.toHaveBeenCalled();
    const cleanup = pathDefinition.render(harness.setting, {} as never);

    expect(startCatalog).toHaveBeenCalledOnce();
    expect(context.scheduleSettingsSave).not.toHaveBeenCalled();
    harness.changeText("Daily/YYYY-MM-DD");
    expect(context.host.settings.periodicNotes.daily.pattern).toBe("Daily/YYYY-MM-DD");
    expect(context.scheduleSettingsSave).toHaveBeenCalledOnce();

    expect(cleanup).toBeTypeOf("function");
    cleanup?.();
    expect(obsidianMocks.closeSuggest).toHaveBeenCalledOnce();
    expect(context.flushSettingsSave).toHaveBeenCalledOnce();
  });

  it("renders custom property formats and flushes pending saves on cleanup", () => {
    const { context } = createContext();
    context.host.settings.propertyDateDisplayFormat = "custom";
    const pages = getPages(getDeclarativeSettingDefinitions(context, "general"));
    const formatDefinition = getRenderDefinition(
      pages,
      context.translator.t("settings.general.propertyDateCustomFormat"),
    );
    const harness = createSettingHarness();

    const cleanup = formatDefinition.render(harness.setting, {} as never);
    harness.changeText("YYYY/MM/DD");

    expect(context.host.settings.propertyDateCustomFormat).toBe("YYYY/MM/DD");
    expect(context.scheduleSettingsSave).toHaveBeenCalledOnce();
    expect(context.flushSettingsSaveOnBlur).toHaveBeenCalledOnce();

    cleanup?.();
    expect(context.flushSettingsSave).toHaveBeenCalledOnce();
  });
});

function createContext(): {
  readonly context: SettingsSectionContext;
  readonly startCatalog: ReturnType<typeof vi.fn>;
} {
  const settings = createDefaultSettings();
  const translator = createTranslator("en", "en");
  const startCatalog = vi.fn();
  const host = {
    settings,
    getTranslator: () => translator,
    saveSettings: vi.fn(async () => undefined),
    openIntervalNoteList: vi.fn(),
    getIcsSnapshot: vi.fn(() => null),
    refreshIcs: vi.fn(async () => undefined),
    openFirstUseGuide: vi.fn(),
  } as unknown as SettingsHost;
  return {
    startCatalog,
    context: {
      app: {
        vault: {
          getAllFolders: vi.fn(() => []),
          getMarkdownFiles: vi.fn(() => []),
        },
      } as never,
      host,
      translator,
      vaultPathSuggestionCatalog: {
        start: startCatalog,
      } as never,
      persistSettings: vi.fn(async () => undefined),
      scheduleSettingsSave: vi.fn(),
      flushSettingsSave: vi.fn(),
      flushSettingsSaveOnBlur: vi.fn(),
      display: vi.fn(),
    },
  };
}

function getPages(
  definitions: SettingDefinitionItem<ChronoNotesControlKey>[],
): SettingDefinitionPage<ChronoNotesControlKey>[] {
  return definitions.filter(
    (definition): definition is SettingDefinitionPage<ChronoNotesControlKey> =>
      "type" in definition && definition.type === "page",
  );
}

function getControlKeys(
  pages: SettingDefinitionPage<ChronoNotesControlKey>[],
): ChronoNotesControlKey[] {
  return pages.flatMap((page) =>
    (page.items ?? []).flatMap(getItemControlKeys),
  );
}

function getItemControlKeys(
  item: SettingDefinitionItem<ChronoNotesControlKey>,
): ChronoNotesControlKey[] {
  if ("type" in item && (item.type === "group" || item.type === "list")) {
    return (item.items ?? []).flatMap(getItemControlKeys);
  }
  return "control" in item && item.control !== undefined
    ? [item.control.key]
    : [];
}

function getRenderDefinition(
  pages: SettingDefinitionPage<ChronoNotesControlKey>[],
  name: string,
): SettingDefinitionRender {
  const definitions = pages.flatMap((page) => page.items ?? []);
  const pending = [...definitions];
  while (pending.length > 0) {
    const definition = pending.shift();
    if (definition === undefined) break;
    if ("type" in definition && (definition.type === "group" || definition.type === "list")) {
      pending.unshift(...(definition.items ?? []));
    } else if (
      "render" in definition &&
      typeof definition.render === "function" &&
      definition.name === name
    ) {
      return definition;
    }
  }
  throw new Error(`Missing render definition: ${name}`);
}

function createSettingHarness(): {
  readonly setting: Setting;
  changeText(value: string): void;
} {
  let onChange: ((value: string) => void) | null = null;
  const element = (): Record<string, unknown> => ({
    addClass: vi.fn(),
    append: vi.fn(),
    classList: { toggle: vi.fn() },
    createDiv: vi.fn(() => element()),
    createEl: vi.fn(() => element()),
    createSpan: vi.fn(() => element()),
    empty: vi.fn(),
    setText: vi.fn(),
    toggleClass: vi.fn(),
  });
  const inputEl = {
    setAttribute: vi.fn(),
    spellcheck: true,
    value: "",
  } as unknown as HTMLInputElement;
  const text = {
    inputEl,
    onChange(callback: (value: string) => void) {
      onChange = callback;
      return this;
    },
    setPlaceholder: vi.fn(function setPlaceholder() {
      return text;
    }),
    setValue(value: string) {
      inputEl.value = value;
      return this;
    },
  };
  const setting = {
    controlEl: element(),
    descEl: element(),
    settingEl: element(),
    addText(callback: (component: typeof text) => void) {
      callback(text);
      return this;
    },
    setDesc: vi.fn(function setDesc() {
      return setting;
    }),
    setName: vi.fn(function setName() {
      return setting;
    }),
  } as unknown as Setting;
  return {
    setting,
    changeText(value) {
      if (onChange === null) throw new Error("Expected a text change handler.");
      inputEl.value = value;
      onChange(value);
    },
  };
}
