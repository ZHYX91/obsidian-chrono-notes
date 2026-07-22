import { describe, expect, it } from "vitest";

import {
  SETTINGS_SCHEMA_VERSION,
  createDefaultSettings,
  migrateSettings,
  normalizeSettings,
} from "../../src/shared/settings";

describe("settings", () => {
  it("creates independent mutable arrays and periodic note records", () => {
    const first = createDefaultSettings();
    const second = createDefaultSettings();
    first.holidayRegions.pop();
    first.periodicNotes.daily.pattern = "'Daily'/yyyy-MM-dd";
    expect(second.holidayRegions).toEqual(["cn", "sg"]);
    expect(second.periodicNotes.daily.pattern).toBe("");
  });

  it("normalizes supported extensions and three ordered holiday-region slots", () => {
    expect(normalizeSettings({
      schemaVersion: 0,
      locale: "zh-CN",
      weekStartDay: "sunday",
      calendarOverlays: ["ganzhi", "chinese-lunar", "ganzhi", "unknown"],
      holidayRegions: ["sg", "cn", "sg", "unknown"],
    })).toEqual({
      ...createDefaultSettings(),
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      locale: "zh-CN",
      weekStartDay: "sunday",
      calendarOverlays: ["ganzhi", "chinese-lunar"],
      holidayRegions: ["sg", "cn"],
    });
  });

  it("falls back safely for an invalid settings object", () => {
    expect(normalizeSettings(null)).toEqual(createDefaultSettings());
  });

  it("preserves explicit empty extension lists", () => {
    expect(normalizeSettings({
      calendarOverlays: [],
      holidayRegions: [],
    })).toMatchObject({
      calendarOverlays: [],
      holidayRegions: [],
    });
  });

  it("normalizes independent note-creation confirmation flags", () => {
    expect(
      normalizeSettings({
        confirmPeriodicNoteCreation: false,
        confirmIntervalNoteCreation: true,
        cascadeLargerNotes: false,
      }),
    ).toMatchObject({
      confirmPeriodicNoteCreation: false,
      confirmIntervalNoteCreation: true,
      cascadeLargerNotes: false,
    });
    expect(
      normalizeSettings({
        confirmPeriodicNoteCreation: "false",
        confirmIntervalNoteCreation: 0,
        cascadeLargerNotes: 1,
      }),
    ).toMatchObject({
      confirmPeriodicNoteCreation: true,
      confirmIntervalNoteCreation: true,
      cascadeLargerNotes: true,
    });
  });

  it("does not translate the removed shared confirmation flag", () => {
    expect(normalizeSettings({ confirmBeforeCreate: false })).toMatchObject({
      confirmPeriodicNoteCreation: true,
      confirmIntervalNoteCreation: true,
    });
  });

  it("defaults hover previews on and normalizes only explicit boolean values", () => {
    expect(createDefaultSettings().showHoverPreview).toBe(true);
    expect(normalizeSettings({ showHoverPreview: false }).showHoverPreview).toBe(false);
    expect(normalizeSettings({ showHoverPreview: "false" }).showHoverPreview).toBe(true);
  });

  it("normalizes the note-indicator visibility independently of removed positions", () => {
    expect(createDefaultSettings().showNoteIndicators).toBe(true);
    expect(normalizeSettings({ showNoteIndicators: false }).showNoteIndicators).toBe(false);
    expect(normalizeSettings({ showNoteIndicators: true }).showNoteIndicators).toBe(true);
    expect(normalizeSettings({ showNoteIndicators: "false" }).showNoteIndicators).toBe(true);
    expect(normalizeSettings({ indicatorPosition: "hidden" })).toMatchObject({
      showNoteIndicators: true,
    });
    expect(normalizeSettings({ indicatorPosition: "left" })).not.toHaveProperty(
      "indicatorPosition",
    );
  });

  it("normalizes both quarter name modes and falls back to number", () => {
    expect(createDefaultSettings().quarterNameMode).toBe("number");
    expect(normalizeSettings({ quarterNameMode: "number" }).quarterNameMode).toBe("number");
    expect(normalizeSettings({ quarterNameMode: "chinese" }).quarterNameMode).toBe("chinese");
    expect(normalizeSettings({ quarterNameMode: "season" }).quarterNameMode).toBe("number");
    expect(normalizeSettings({ quarterNameMode: null }).quarterNameMode).toBe("number");
  });

  it("normalizes all font modes and clamps the fixed factor to legacy bounds", () => {
    expect(createDefaultSettings()).toMatchObject({
      fontSizeMode: "immutable",
      immutableFontSizeFactor: 10,
    });
    for (const fontSizeMode of ["follow-obsidian", "follow-widget", "immutable"] as const) {
      expect(normalizeSettings({ fontSizeMode }).fontSizeMode).toBe(fontSizeMode);
    }
    expect(normalizeSettings({ fontSizeMode: "viewport" }).fontSizeMode).toBe("immutable");
    expect(normalizeSettings({ immutableFontSizeFactor: -4 }).immutableFontSizeFactor).toBe(0);
    expect(normalizeSettings({ immutableFontSizeFactor: 7.9 }).immutableFontSizeFactor).toBe(7);
    expect(normalizeSettings({ immutableFontSizeFactor: 99 }).immutableFontSizeFactor).toBe(20);
    expect(normalizeSettings({ immutableFontSizeFactor: "12" }).immutableFontSizeFactor).toBe(10);
  });

  it("normalizes all legacy todo annotation modes and falls back to hole", () => {
    expect(createDefaultSettings().todoAnnotationMode).toBe("hole");
    for (const todoAnnotationMode of ["none", "color", "hole"] as const) {
      expect(normalizeSettings({ todoAnnotationMode }).todoAnnotationMode)
        .toBe(todoAnnotationMode);
    }
    expect(normalizeSettings({ todoAnnotationMode: "progress" }).todoAnnotationMode).toBe("hole");
    expect(normalizeSettings({ todoAnnotationMode: null }).todoAnnotationMode).toBe("hole");
  });

  it("defaults Properties date interception off and accepts only booleans", () => {
    expect(createDefaultSettings().interceptPropertyDateClicks).toBe(false);
    expect(normalizeSettings({ interceptPropertyDateClicks: true }).interceptPropertyDateClicks)
      .toBe(true);
    expect(normalizeSettings({ interceptPropertyDateClicks: false }).interceptPropertyDateClicks)
      .toBe(false);
    expect(normalizeSettings({ interceptPropertyDateClicks: "true" }).interceptPropertyDateClicks)
      .toBe(false);
  });

  it("persists the first-use guide marker through schema normalization", () => {
    expect(createDefaultSettings().firstUseGuideSeen).toBe(false);
    expect(normalizeSettings({ firstUseGuideSeen: true }).firstUseGuideSeen).toBe(true);
    expect(normalizeSettings({ firstUseGuideSeen: "true" }).firstUseGuideSeen).toBe(false);
  });

  it("normalizes Note Navbar visibility and persisted related-range collapse", () => {
    expect(createDefaultSettings()).toMatchObject({
      showNoteNavbar: true,
      relatedIntervalNotesCollapsed: false,
    });
    expect(normalizeSettings({
      showNoteNavbar: false,
      relatedIntervalNotesCollapsed: true,
    })).toMatchObject({
      showNoteNavbar: false,
      relatedIntervalNotesCollapsed: true,
    });
    expect(normalizeSettings({
      showNoteNavbar: "false",
      relatedIntervalNotesCollapsed: 1,
    })).toMatchObject({
      showNoteNavbar: true,
      relatedIntervalNotesCollapsed: false,
    });
  });

  it("normalizes independent local ICS settings without sharing source arrays", () => {
    expect(createDefaultSettings().ics).toEqual({ enabled: false, sources: [] });
    const normalized = normalizeSettings({
      ics: {
        enabled: true,
        sources: [" Calendar/team.ics ", "Calendar/team.ics", "", 42],
      },
    });
    expect(normalized.ics).toEqual({ enabled: true, sources: ["Calendar/team.ics"] });

    normalized.ics.sources.push("changed.ics");
    expect(createDefaultSettings().ics.sources).toEqual([]);
    expect(normalizeSettings({ ics: { enabled: "true", sources: "team.ics" } }).ics)
      .toEqual({ enabled: false, sources: [] });
  });

  it("normalizes heatmap dimension and positive integer step", () => {
    expect(createDefaultSettings()).toMatchObject({
      statisticDisplayDimension: "word-count",
      statisticValueStep: 200,
      yearViewHeatmap: false,
    });
    expect(normalizeSettings({
      statisticDisplayDimension: "task-completion-rate",
      statisticValueStep: 25.9,
    })).toMatchObject({
      statisticDisplayDimension: "task-completion-rate",
      statisticValueStep: 25,
    });
    expect(normalizeSettings({
      statisticDisplayDimension: "unknown",
      statisticValueStep: 0,
    })).toMatchObject({
      statisticDisplayDimension: "word-count",
      statisticValueStep: 200,
    });
    expect(normalizeSettings({ yearViewHeatmap: true }).yearViewHeatmap).toBe(true);
    expect(normalizeSettings({ yearViewHeatmap: "true" }).yearViewHeatmap).toBe(false);
  });

  it("normalizes the selected template engine without silent fallback values", () => {
    expect(normalizeSettings({ templateEngine: "templater" }).templateEngine).toBe("templater");
    expect(normalizeSettings({ templateEngine: "unknown" }).templateEngine).toBe("builtin");
  });

  it("normalizes partial periodic note settings without sharing nested values", () => {
    const normalized = normalizeSettings({
      periodicNotes: {
        daily: {
          enabled: true,
          pattern: "'Daily'/yyyy-MM-dd",
          templatePath: "Templates/Daily.md",
        },
        weekly: {
          enabled: "yes",
          pattern: 123,
          templatePath: null,
        },
        invented: {
          enabled: true,
          pattern: "invented",
          templatePath: "invented",
        },
      },
    });

    expect(normalized.periodicNotes.daily).toEqual({
      enabled: true,
      pattern: "'Daily'/yyyy-MM-dd",
      templatePath: "Templates/Daily.md",
    });
    expect(normalized.periodicNotes.weekly).toEqual({
      enabled: false,
      pattern: "",
      templatePath: "",
    });
    expect(Object.keys(normalized.periodicNotes)).toEqual([
      "daily",
      "weekly",
      "monthly",
      "quarterly",
      "yearly",
    ]);

    normalized.periodicNotes.daily.pattern = "changed";
    expect(createDefaultSettings().periodicNotes.daily.pattern).toBe("");
  });

  it("normalizes range note settings without sharing the nested defaults", () => {
    expect(createDefaultSettings().rangeNotes).toEqual({
      showInCalendar: true,
      folder: "Calendar/Range Notes",
      scanScope: "range-folder",
      customFolder: "",
      monthViewLimit: 2,
      weekViewLimit: 5,
    });
    const normalized = normalizeSettings({
      rangeNotes: {
        showInCalendar: false,
        folder: "Projects/Ranges",
        scanScope: "entire-vault",
        customFolder: 42,
        monthViewLimit: 3.8,
        weekViewLimit: 0,
      },
    });
    expect(normalized.rangeNotes).toEqual({
      showInCalendar: false,
      folder: "Projects/Ranges",
      scanScope: "entire-vault",
      customFolder: "",
      monthViewLimit: 3,
      weekViewLimit: 5,
    });
    normalized.rangeNotes.folder = "changed";
    expect(createDefaultSettings().rangeNotes.folder).toBe("Calendar/Range Notes");
  });

  it("migrates every published settings schema through the current version", () => {
    for (let schemaVersion = 1; schemaVersion <= SETTINGS_SCHEMA_VERSION; schemaVersion += 1) {
      const migrated = migrateSettings({ schemaVersion });
      expect(migrated.schemaVersion).toBe(SETTINGS_SCHEMA_VERSION);
      expect(normalizeSettings(migrated)).toEqual(createDefaultSettings());
    }
  });

  it("adds indicator visibility without translating the removed position setting", () => {
    expect(normalizeSettings(migrateSettings({ schemaVersion: 13 }))).toMatchObject({
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      showNoteIndicators: true,
    });
    expect(normalizeSettings(migrateSettings({
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      indicatorPosition: "hidden",
    }))).toMatchObject({
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      showNoteIndicators: true,
    });
  });

  it("replaces the shared creation confirmation with independent defaults at schema 15", () => {
    const migrated = migrateSettings({
      schemaVersion: 14,
      confirmBeforeCreate: false,
    });

    expect(migrated).toMatchObject({
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      confirmPeriodicNoteCreation: true,
      confirmIntervalNoteCreation: true,
    });
    expect(migrated).not.toHaveProperty("confirmBeforeCreate");
  });

  it("adds the default quarter name mode at schema 10 without replacing a valid value", () => {
    expect(migrateSettings({ schemaVersion: 9 })).toMatchObject({
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      quarterNameMode: "number",
    });
    expect(migrateSettings({
      schemaVersion: 9,
      quarterNameMode: "chinese",
    })).toMatchObject({
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      quarterNameMode: "chinese",
    });
  });

  it("adds legacy-compatible font defaults at schema 11 without replacing valid values", () => {
    expect(migrateSettings({ schemaVersion: 10 })).toMatchObject({
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      fontSizeMode: "immutable",
      immutableFontSizeFactor: 10,
    });
    expect(migrateSettings({
      schemaVersion: 10,
      fontSizeMode: "follow-widget",
      immutableFontSizeFactor: 18,
    })).toMatchObject({
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      fontSizeMode: "follow-widget",
      immutableFontSizeFactor: 18,
    });
  });

  it("adds the legacy-compatible todo annotation default at schema 12", () => {
    expect(migrateSettings({ schemaVersion: 11 })).toMatchObject({
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      todoAnnotationMode: "hole",
    });
    expect(migrateSettings({
      schemaVersion: 11,
      todoAnnotationMode: "color",
    })).toMatchObject({
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      todoAnnotationMode: "color",
    });
  });

  it("adds disabled Properties date interception at schema 13", () => {
    expect(migrateSettings({ schemaVersion: 12 })).toMatchObject({
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      interceptPropertyDateClicks: false,
    });
    expect(migrateSettings({
      schemaVersion: 12,
      interceptPropertyDateClicks: true,
    })).toMatchObject({
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      interceptPropertyDateClicks: true,
    });
  });

  it("preserves valid historical values while adding later schema defaults", () => {
    const migrated = migrateSettings({
      schemaVersion: 1,
      locale: "zh-TW",
      weekStartDay: "sunday",
      calendarOverlays: [],
      holidayRegions: ["sg"],
    });

    expect(migrated).toMatchObject({
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      locale: "zh-TW",
      weekStartDay: "sunday",
      calendarOverlays: [],
      holidayRegions: ["sg"],
      showHoverPreview: true,
      showNoteNavbar: true,
      relatedIntervalNotesCollapsed: false,
      firstUseGuideSeen: false,
      statisticDisplayDimension: "word-count",
      statisticValueStep: 200,
      yearViewHeatmap: false,
      confirmPeriodicNoteCreation: true,
      confirmIntervalNoteCreation: true,
      cascadeLargerNotes: true,
      templateEngine: "builtin",
      ics: { enabled: false, sources: [] },
    });
    expect(normalizeSettings(migrated)).toMatchObject({
      locale: "zh-TW",
      weekStartDay: "sunday",
      calendarOverlays: [],
      holidayRegions: ["sg"],
    });
  });

  it("treats missing or invalid schema versions as version 1", () => {
    for (const schemaVersion of [undefined, null, 0, -1, 1.5, "7"]) {
      const migrated = migrateSettings({ schemaVersion, locale: "en" });
      expect(migrated).toMatchObject({
        schemaVersion: SETTINGS_SCHEMA_VERSION,
        locale: "en",
      });
    }
  });

  it("does not downgrade future schemas before normalizing known runtime fields", () => {
    const raw = {
      schemaVersion: SETTINGS_SCHEMA_VERSION + 1,
      locale: "en",
      futureSetting: { enabled: true },
    };
    const migrated = migrateSettings(raw);

    expect(migrated).toEqual(raw);
    expect(migrated).not.toBe(raw);
    expect(normalizeSettings(migrated)).toEqual({
      ...createDefaultSettings(),
      locale: "en",
    });
  });

  it("migrates idempotently without mutating or sharing input values", () => {
    const raw = {
      schemaVersion: 7,
      holidayRegions: ["sg"],
      ics: {
        enabled: true,
        sources: ["Calendar/team.ics"],
      },
    };
    const before = structuredClone(raw);
    const first = migrateSettings(raw);
    const second = migrateSettings(first);
    const normalized = normalizeSettings(second);

    expect(raw).toEqual(before);
    expect(second).toEqual(first);
    normalized.holidayRegions.push("cn");
    normalized.ics.sources.push("Calendar/other.ics");
    expect(raw).toEqual(before);
  });
});
