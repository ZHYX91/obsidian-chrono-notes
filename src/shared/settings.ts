import {
  PERIODIC_NOTE_TYPES,
  type PeriodicNoteType,
  type WeekStartDay,
} from "../core/periodic/periodic-date";
import type { StatisticDisplayDimension } from "../core/statistics/heatmap";
import type { CalendarOverlayId } from "../core/calendar/calendar-overlay";

export const SETTINGS_SCHEMA_VERSION = 15;

export type PluginLocale =
  | "auto"
  | "en"
  | "zh-CN"
  | "zh-TW"
  | "ar"
  | "fa"
  | "he"
  | "am"
  | "hi";
export type CalendarOverlay = CalendarOverlayId;
export type HolidayRegion = "cn" | "sg";
export type QuarterNameMode = "number" | "chinese";
export type FontSizeMode = "follow-obsidian" | "follow-widget" | "immutable";
export type TodoAnnotationMode = "none" | "color" | "hole";
export type TemplateEngine = "builtin" | "templater";
export type RangeNoteScanScope = "range-folder" | "custom-folder" | "entire-vault";
export type { WeekStartDay } from "../core/periodic/periodic-date";

export interface PeriodicNoteSettings {
  enabled: boolean;
  pattern: string;
  templatePath: string;
}

export interface RangeNoteSettings {
  showInCalendar: boolean;
  folder: string;
  scanScope: RangeNoteScanScope;
  customFolder: string;
  monthViewLimit: number;
  weekViewLimit: number;
}

export interface IcsSettings {
  enabled: boolean;
  sources: string[];
}

export interface ChronoNotesSettings {
  schemaVersion: number;
  locale: PluginLocale;
  weekStartDay: WeekStartDay;
  calendarOverlays: CalendarOverlay[];
  holidayRegions: HolidayRegion[];
  showNoteIndicators: boolean;
  quarterNameMode: QuarterNameMode;
  fontSizeMode: FontSizeMode;
  immutableFontSizeFactor: number;
  todoAnnotationMode: TodoAnnotationMode;
  interceptPropertyDateClicks: boolean;
  showHoverPreview: boolean;
  showNoteNavbar: boolean;
  relatedIntervalNotesCollapsed: boolean;
  firstUseGuideSeen: boolean;
  statisticDisplayDimension: StatisticDisplayDimension;
  statisticValueStep: number;
  yearViewHeatmap: boolean;
  confirmPeriodicNoteCreation: boolean;
  confirmIntervalNoteCreation: boolean;
  cascadeLargerNotes: boolean;
  templateEngine: TemplateEngine;
  periodicNotes: Record<PeriodicNoteType, PeriodicNoteSettings>;
  rangeNotes: RangeNoteSettings;
  ics: IcsSettings;
}

export const DEFAULT_SETTINGS: Readonly<ChronoNotesSettings> = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  locale: "auto",
  weekStartDay: "monday",
  calendarOverlays: ["chinese-lunar"],
  holidayRegions: ["cn", "sg"],
  showNoteIndicators: true,
  quarterNameMode: "number",
  fontSizeMode: "immutable",
  immutableFontSizeFactor: 10,
  todoAnnotationMode: "hole",
  interceptPropertyDateClicks: false,
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
  periodicNotes: createDefaultPeriodicNotes(),
  rangeNotes: createDefaultRangeNotes(),
  ics: createDefaultIcsSettings(),
};

export function createDefaultSettings(): ChronoNotesSettings {
  return {
    ...DEFAULT_SETTINGS,
    calendarOverlays: [...DEFAULT_SETTINGS.calendarOverlays],
    holidayRegions: [...DEFAULT_SETTINGS.holidayRegions],
    periodicNotes: clonePeriodicNotes(DEFAULT_SETTINGS.periodicNotes),
    rangeNotes: { ...DEFAULT_SETTINGS.rangeNotes },
    ics: { ...DEFAULT_SETTINGS.ics, sources: [...DEFAULT_SETTINGS.ics.sources] },
  };
}

type RawSettings = Record<string, unknown>;
type SettingsMigration = (settings: RawSettings) => RawSettings;

const SETTINGS_MIGRATIONS: Readonly<Record<number, SettingsMigration>> = {
  1: (settings) => addSettingsFields(settings, 2, {
    periodicNotes: createDefaultSettings().periodicNotes,
  }),
  2: (settings) => addSettingsFields(settings, 3, {
    cascadeLargerNotes: DEFAULT_SETTINGS.cascadeLargerNotes,
  }),
  3: (settings) => addSettingsFields(settings, 4, {
    templateEngine: DEFAULT_SETTINGS.templateEngine,
  }),
  4: (settings) => addSettingsFields(settings, 5, {
    showHoverPreview: DEFAULT_SETTINGS.showHoverPreview,
    statisticDisplayDimension: DEFAULT_SETTINGS.statisticDisplayDimension,
    statisticValueStep: DEFAULT_SETTINGS.statisticValueStep,
  }),
  5: (settings) => addSettingsFields(settings, 6, {
    yearViewHeatmap: DEFAULT_SETTINGS.yearViewHeatmap,
    rangeNotes: createDefaultSettings().rangeNotes,
    showNoteNavbar: DEFAULT_SETTINGS.showNoteNavbar,
    relatedIntervalNotesCollapsed: DEFAULT_SETTINGS.relatedIntervalNotesCollapsed,
  }),
  6: (settings) => addSettingsFields(settings, 7, {
    ics: createDefaultSettings().ics,
  }),
  7: (settings) => addSettingsFields(settings, 8, {
    firstUseGuideSeen: DEFAULT_SETTINGS.firstUseGuideSeen,
  }),
  8: (settings) => addSettingsFields(settings, 9, {}),
  9: (settings) => addSettingsFields(settings, 10, {
    quarterNameMode: DEFAULT_SETTINGS.quarterNameMode,
  }),
  10: (settings) => addSettingsFields(settings, 11, {
    fontSizeMode: DEFAULT_SETTINGS.fontSizeMode,
    immutableFontSizeFactor: DEFAULT_SETTINGS.immutableFontSizeFactor,
  }),
  11: (settings) => addSettingsFields(settings, 12, {
    todoAnnotationMode: DEFAULT_SETTINGS.todoAnnotationMode,
  }),
  12: (settings) => addSettingsFields(settings, 13, {
    interceptPropertyDateClicks: DEFAULT_SETTINGS.interceptPropertyDateClicks,
  }),
  13: (settings) => addSettingsFields(settings, 14, {
    showNoteIndicators: DEFAULT_SETTINGS.showNoteIndicators,
  }),
  14: (settings) => {
    const migrated = addSettingsFields(settings, 15, {
      confirmPeriodicNoteCreation: DEFAULT_SETTINGS.confirmPeriodicNoteCreation,
      confirmIntervalNoteCreation: DEFAULT_SETTINGS.confirmIntervalNoteCreation,
    });
    delete migrated.confirmBeforeCreate;
    return migrated;
  },
};

export function migrateSettings(value: unknown): RawSettings {
  let settings = isRecord(value) ? cloneRawSettings(value) : {};
  let schemaVersion = getSettingsSchemaVersion(settings.schemaVersion);
  if (schemaVersion > SETTINGS_SCHEMA_VERSION) return settings;

  while (schemaVersion < SETTINGS_SCHEMA_VERSION) {
    const migrate = SETTINGS_MIGRATIONS[schemaVersion];
    if (migrate === undefined) break;
    settings = migrate(settings);
    schemaVersion += 1;
  }
  return settings;
}

export function normalizeSettings(value: unknown): ChronoNotesSettings {
  const defaults = createDefaultSettings();
  if (!isRecord(value)) return defaults;

  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    locale: isPluginLocale(value.locale) ? value.locale : defaults.locale,
    weekStartDay: isWeekStartDay(value.weekStartDay)
      ? value.weekStartDay
      : defaults.weekStartDay,
    calendarOverlays: normalizeEnumList(
      value.calendarOverlays,
      isCalendarOverlay,
      defaults.calendarOverlays,
    ).slice(0, 2),
    holidayRegions: normalizeEnumList(
      value.holidayRegions,
      isHolidayRegion,
      defaults.holidayRegions,
    ).slice(0, 3),
    showNoteIndicators:
      typeof value.showNoteIndicators === "boolean"
        ? value.showNoteIndicators
        : defaults.showNoteIndicators,
    quarterNameMode: isQuarterNameMode(value.quarterNameMode)
      ? value.quarterNameMode
      : defaults.quarterNameMode,
    fontSizeMode: isFontSizeMode(value.fontSizeMode)
      ? value.fontSizeMode
      : defaults.fontSizeMode,
    immutableFontSizeFactor: normalizeIntegerInRange(
      value.immutableFontSizeFactor,
      defaults.immutableFontSizeFactor,
      0,
      20,
    ),
    todoAnnotationMode: isTodoAnnotationMode(value.todoAnnotationMode)
      ? value.todoAnnotationMode
      : defaults.todoAnnotationMode,
    interceptPropertyDateClicks:
      typeof value.interceptPropertyDateClicks === "boolean"
        ? value.interceptPropertyDateClicks
        : defaults.interceptPropertyDateClicks,
    showHoverPreview:
      typeof value.showHoverPreview === "boolean"
        ? value.showHoverPreview
        : defaults.showHoverPreview,
    showNoteNavbar:
      typeof value.showNoteNavbar === "boolean"
        ? value.showNoteNavbar
        : defaults.showNoteNavbar,
    relatedIntervalNotesCollapsed:
      typeof value.relatedIntervalNotesCollapsed === "boolean"
        ? value.relatedIntervalNotesCollapsed
        : defaults.relatedIntervalNotesCollapsed,
    firstUseGuideSeen:
      typeof value.firstUseGuideSeen === "boolean"
        ? value.firstUseGuideSeen
        : defaults.firstUseGuideSeen,
    statisticDisplayDimension: isStatisticDisplayDimension(value.statisticDisplayDimension)
      ? value.statisticDisplayDimension
      : defaults.statisticDisplayDimension,
    statisticValueStep: normalizePositiveInteger(
      value.statisticValueStep,
      defaults.statisticValueStep,
    ),
    yearViewHeatmap:
      typeof value.yearViewHeatmap === "boolean"
        ? value.yearViewHeatmap
        : defaults.yearViewHeatmap,
    confirmPeriodicNoteCreation:
      typeof value.confirmPeriodicNoteCreation === "boolean"
        ? value.confirmPeriodicNoteCreation
        : defaults.confirmPeriodicNoteCreation,
    confirmIntervalNoteCreation:
      typeof value.confirmIntervalNoteCreation === "boolean"
        ? value.confirmIntervalNoteCreation
        : defaults.confirmIntervalNoteCreation,
    cascadeLargerNotes:
      typeof value.cascadeLargerNotes === "boolean"
        ? value.cascadeLargerNotes
        : defaults.cascadeLargerNotes,
    templateEngine: isTemplateEngine(value.templateEngine)
      ? value.templateEngine
      : defaults.templateEngine,
    periodicNotes: normalizePeriodicNotes(value.periodicNotes, defaults.periodicNotes),
    rangeNotes: normalizeRangeNotes(value.rangeNotes, defaults.rangeNotes),
    ics: normalizeIcsSettings(value.ics, defaults.ics),
  };
}

export function isPluginLocale(value: unknown): value is PluginLocale {
  return value === "auto" ||
    value === "en" ||
    value === "zh-CN" ||
    value === "zh-TW" ||
    value === "ar" ||
    value === "fa" ||
    value === "he" ||
    value === "am" ||
    value === "hi";
}

export function isWeekStartDay(value: unknown): value is WeekStartDay {
  return value === "monday" || value === "sunday";
}

export function isCalendarOverlay(value: unknown): value is CalendarOverlay {
  return value === "chinese-lunar" ||
    value === "ganzhi" ||
    value === "persian" ||
    value === "ethiopic" ||
    value === "hebrew" ||
    value === "indian" ||
    value === "islamic-civil" ||
    value === "islamic-umalqura";
}

export function isHolidayRegion(value: unknown): value is HolidayRegion {
  return value === "cn" || value === "sg";
}

export function isQuarterNameMode(value: unknown): value is QuarterNameMode {
  return value === "number" || value === "chinese";
}

export function isFontSizeMode(value: unknown): value is FontSizeMode {
  return value === "follow-obsidian" || value === "follow-widget" || value === "immutable";
}

export function isTodoAnnotationMode(value: unknown): value is TodoAnnotationMode {
  return value === "none" || value === "color" || value === "hole";
}

export function isTemplateEngine(value: unknown): value is TemplateEngine {
  return value === "builtin" || value === "templater";
}

export function isStatisticDisplayDimension(
  value: unknown,
): value is StatisticDisplayDimension {
  return value === "word-count" ||
    value === "link-count" ||
    value === "tag-count" ||
    value === "task-completion-rate";
}

export function isRangeNoteScanScope(value: unknown): value is RangeNoteScanScope {
  return value === "range-folder" || value === "custom-folder" || value === "entire-vault";
}

function normalizeEnumList<T extends string>(
  value: unknown,
  predicate: (item: unknown) => item is T,
  fallback: readonly T[],
): T[] {
  if (!Array.isArray(value)) return [...fallback];
  return Array.from(new Set(value.filter(predicate)));
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;
}

function createDefaultPeriodicNotes(): Record<PeriodicNoteType, PeriodicNoteSettings> {
  return Object.fromEntries(
    PERIODIC_NOTE_TYPES.map((noteType) => [
      noteType,
      { enabled: false, pattern: "", templatePath: "" },
    ]),
  ) as Record<PeriodicNoteType, PeriodicNoteSettings>;
}

function createDefaultRangeNotes(): RangeNoteSettings {
  return {
    showInCalendar: true,
    folder: "Calendar/Range Notes",
    scanScope: "range-folder",
    customFolder: "",
    monthViewLimit: 2,
    weekViewLimit: 5,
  };
}

function createDefaultIcsSettings(): IcsSettings {
  return { enabled: false, sources: [] };
}

function clonePeriodicNotes(
  notes: Readonly<Record<PeriodicNoteType, PeriodicNoteSettings>>,
): Record<PeriodicNoteType, PeriodicNoteSettings> {
  return Object.fromEntries(
    PERIODIC_NOTE_TYPES.map((noteType) => [noteType, { ...notes[noteType] }]),
  ) as Record<PeriodicNoteType, PeriodicNoteSettings>;
}

function normalizePeriodicNotes(
  value: unknown,
  defaults: Readonly<Record<PeriodicNoteType, PeriodicNoteSettings>>,
): Record<PeriodicNoteType, PeriodicNoteSettings> {
  if (!isRecord(value)) return clonePeriodicNotes(defaults);

  return Object.fromEntries(
    PERIODIC_NOTE_TYPES.map((noteType) => {
      const candidate = value[noteType];
      if (!isRecord(candidate)) return [noteType, { ...defaults[noteType] }];
      return [
        noteType,
        {
          enabled:
            typeof candidate.enabled === "boolean"
              ? candidate.enabled
              : defaults[noteType].enabled,
          pattern:
            typeof candidate.pattern === "string"
              ? candidate.pattern
              : defaults[noteType].pattern,
          templatePath:
            typeof candidate.templatePath === "string"
              ? candidate.templatePath
              : defaults[noteType].templatePath,
        },
      ];
    }),
  ) as Record<PeriodicNoteType, PeriodicNoteSettings>;
}

function normalizeRangeNotes(
  value: unknown,
  defaults: Readonly<RangeNoteSettings>,
): RangeNoteSettings {
  if (!isRecord(value)) return { ...defaults };
  return {
    showInCalendar: typeof value.showInCalendar === "boolean"
      ? value.showInCalendar
      : defaults.showInCalendar,
    folder: typeof value.folder === "string" ? value.folder : defaults.folder,
    scanScope: isRangeNoteScanScope(value.scanScope) ? value.scanScope : defaults.scanScope,
    customFolder: typeof value.customFolder === "string"
      ? value.customFolder
      : defaults.customFolder,
    monthViewLimit: normalizePositiveInteger(value.monthViewLimit, defaults.monthViewLimit),
    weekViewLimit: normalizePositiveInteger(value.weekViewLimit, defaults.weekViewLimit),
  };
}

function normalizeIcsSettings(value: unknown, defaults: Readonly<IcsSettings>): IcsSettings {
  if (!isRecord(value)) return { enabled: defaults.enabled, sources: [...defaults.sources] };
  const sources = Array.isArray(value.sources)
    ? Array.from(new Set(value.sources
      .filter((source): source is string => typeof source === "string")
      .map((source) => source.trim())
      .filter((source) => source.length > 0)))
    : [...defaults.sources];
  return {
    enabled: typeof value.enabled === "boolean" ? value.enabled : defaults.enabled,
    sources,
  };
}

function normalizeIntegerInRange(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(value)));
}

function addSettingsFields(
  settings: RawSettings,
  schemaVersion: number,
  additions: RawSettings,
): RawSettings {
  const migrated: RawSettings = { ...settings, schemaVersion };
  for (const [key, value] of Object.entries(additions)) {
    if (!(key in settings)) migrated[key] = cloneRawValue(value);
  }
  return migrated;
}

function getSettingsSchemaVersion(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1
    ? value
    : 1;
}

function cloneRawSettings(value: RawSettings): RawSettings {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, cloneRawValue(item)]),
  );
}

function cloneRawValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneRawValue);
  if (isRecord(value)) return cloneRawSettings(value);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
