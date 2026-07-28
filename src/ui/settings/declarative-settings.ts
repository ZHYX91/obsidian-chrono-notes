import type {
  SettingDefinitionItem,
  SettingDefinitionPage,
  SettingGroupItem,
} from "obsidian";

import {
  PERIODIC_NOTE_TYPES,
  type PeriodicNoteType,
} from "../../core/periodic/periodic-date";
import {
  isPropertyDateDisplayFormat,
  isPropertyTimeDisplayFormat,
} from "../../core/properties/property-date-display";
import {
  CALENDAR_EXTENSION_DEFINITIONS,
  isCalendarExtensionSupported,
  updateCalendarExtensionSlot,
} from "../../features/calendar/calendar-extension-registry";
import {
  HOLIDAY_REGION_DEFINITIONS,
  updateHolidayRegionSlot,
} from "../../features/calendar/holiday-region-registry";
import { PLUGIN_LANGUAGE_OPTIONS } from "../../shared/plugin-languages";
import {
  isCalendarExtension,
  isFontSizeMode,
  isHolidayRegion,
  isPluginLocale,
  isQuarterNameMode,
  isRangeNoteScanScope,
  isStatisticDisplayDimension,
  isTemplateEngine,
  isWeekStartDay,
  type ChronoNotesSettings,
} from "../../shared/settings";
import { configurePropertyFormatSetting } from "./general-settings-section";
import {
  formatIcsSourceStatus,
  formatIcsStatus,
  getSettingsTabLabels,
  periodicNoteLabel,
} from "./settings-presentation";
import type { SettingsSectionContext } from "./settings-section-context";
import type { SettingsTabId } from "./settings-tab-navigation";
import { configurePeriodicPathSetting } from "./periodic-settings-section";
import {
  configureCustomRangeFolderSetting,
  configureRangeFolderSetting,
} from "./range-settings-section";
import {
  configureTemplatePathSetting,
  renderTemplateEngineGuide,
} from "./template-settings";
import { getPeriodicNoteTemplatePathExample } from "./periodic-note-settings-presentation";
import { normalizeSourceInput } from "./extensions-and-integrations-settings-section";

type PeriodicEnabledKey = `periodicNotes.${PeriodicNoteType}.enabled`;
type CalendarExtensionKey = `calendarExtensions.${0 | 1}`;
type HolidayRegionKey = `holidayRegions.${0 | 1 | 2}`;

export type ChronoNotesControlKey =
  | "locale"
  | "weekStartDay"
  | "showNoteNavbar"
  | "propertyDateDisplayFormat"
  | "propertyTimeDisplayFormat"
  | "interceptPropertyDateClicks"
  | "templateEngine"
  | "showHoverPreview"
  | "quarterNameMode"
  | "fontSizeMode"
  | "immutableFontSizeFactor"
  | "showNoteIndicators"
  | "showTaskProgress"
  | "statisticDisplayDimension"
  | "statisticValueStep"
  | "confirmPeriodicNoteCreation"
  | "cascadeLargerNotes"
  | PeriodicEnabledKey
  | "confirmIntervalNoteCreation"
  | "rangeNotes.showInCalendar"
  | "rangeNotes.scanScope"
  | "rangeNotes.monthViewLimit"
  | "rangeNotes.weekViewLimit"
  | CalendarExtensionKey
  | HolidayRegionKey
  | "ics.enabled"
  | "ics.sources";

export interface DeclarativeSettingMutation {
  readonly persistence: "immediate" | "scheduled";
  readonly refresh: "none" | "refresh-dom-state" | "update";
}

export function getDeclarativeSettingDefinitions(
  context: SettingsSectionContext,
  preferredPage: SettingsTabId,
): SettingDefinitionItem<ChronoNotesControlKey>[] {
  const labels = new Map(
    getSettingsTabLabels(context.translator.t).map(({ id, label }) => [id, label]),
  );
  const pages: Array<{
    readonly id: SettingsTabId;
    readonly page: SettingDefinitionPage<ChronoNotesControlKey>;
  }> = [
    {
      id: "general",
      page: {
        type: "page",
        name: getRequiredLabel(labels, "general"),
        items: getGeneralDefinitions(context),
      },
    },
    {
      id: "appearance",
      page: {
        type: "page",
        name: getRequiredLabel(labels, "appearance"),
        items: getAppearanceDefinitions(context),
      },
    },
    {
      id: "periodic",
      page: {
        type: "page",
        name: getRequiredLabel(labels, "periodic"),
        items: getPeriodicDefinitions(context),
      },
    },
    {
      id: "ranges",
      page: {
        type: "page",
        name: getRequiredLabel(labels, "ranges"),
        items: getRangeDefinitions(context),
      },
    },
    {
      id: "extensions-and-integrations",
      page: {
        type: "page",
        name: getRequiredLabel(labels, "extensions-and-integrations"),
        items: getExtensionDefinitions(context),
      },
    },
  ];
  return pages
    .sort((left, right) => pageOrder(left.id, preferredPage) - pageOrder(right.id, preferredPage))
    .map(({ page }) => page);
}

export function getDeclarativeControlValue(
  settings: ChronoNotesSettings,
  key: string,
): unknown {
  switch (key) {
    case "locale":
    case "weekStartDay":
    case "showNoteNavbar":
    case "propertyDateDisplayFormat":
    case "propertyTimeDisplayFormat":
    case "interceptPropertyDateClicks":
    case "templateEngine":
    case "showHoverPreview":
    case "quarterNameMode":
    case "fontSizeMode":
    case "immutableFontSizeFactor":
    case "showNoteIndicators":
    case "showTaskProgress":
    case "statisticDisplayDimension":
    case "statisticValueStep":
    case "confirmPeriodicNoteCreation":
    case "cascadeLargerNotes":
    case "confirmIntervalNoteCreation":
      return settings[key];
    case "rangeNotes.showInCalendar":
      return settings.rangeNotes.showInCalendar;
    case "rangeNotes.scanScope":
      return settings.rangeNotes.scanScope;
    case "rangeNotes.monthViewLimit":
      return settings.rangeNotes.monthViewLimit;
    case "rangeNotes.weekViewLimit":
      return settings.rangeNotes.weekViewLimit;
    case "ics.enabled":
      return settings.ics.enabled;
    case "ics.sources":
      return settings.ics.sources.join("\n");
  }
  const periodicKey = parsePeriodicEnabledKey(key);
  if (periodicKey !== null) return settings.periodicNotes[periodicKey].enabled;
  const calendarSlot = parseSlotKey(key, "calendarExtensions", 2);
  if (calendarSlot !== null) return settings.calendarExtensions[calendarSlot] ?? "";
  const holidaySlot = parseSlotKey(key, "holidayRegions", 3);
  if (holidaySlot !== null) return settings.holidayRegions[holidaySlot] ?? "";
  return undefined;
}

export function applyDeclarativeControlValue(
  settings: ChronoNotesSettings,
  key: string,
  value: unknown,
): DeclarativeSettingMutation {
  switch (key) {
    case "locale":
      assertValue(isPluginLocale(value), "plugin locale");
      settings.locale = value;
      return immediateUpdate();
    case "weekStartDay":
      assertValue(isWeekStartDay(value), "week start day");
      settings.weekStartDay = value;
      return immediateNone();
    case "showNoteNavbar":
    case "interceptPropertyDateClicks":
    case "showHoverPreview":
    case "showTaskProgress":
    case "confirmPeriodicNoteCreation":
    case "cascadeLargerNotes":
    case "confirmIntervalNoteCreation":
      assertValue(typeof value === "boolean", key);
      settings[key] = value;
      return immediateNone();
    case "propertyDateDisplayFormat":
      assertValue(isPropertyDateDisplayFormat(value), "property date display format");
      settings.propertyDateDisplayFormat = value;
      return immediateDomRefresh();
    case "propertyTimeDisplayFormat":
      assertValue(isPropertyTimeDisplayFormat(value), "property time display format");
      settings.propertyTimeDisplayFormat = value;
      return immediateDomRefresh();
    case "templateEngine":
      assertValue(isTemplateEngine(value), "template engine");
      settings.templateEngine = value;
      return immediateUpdate();
    case "quarterNameMode":
      assertValue(isQuarterNameMode(value), "quarter name mode");
      settings.quarterNameMode = value;
      return immediateNone();
    case "fontSizeMode":
      assertValue(isFontSizeMode(value), "font size mode");
      settings.fontSizeMode = value;
      return immediateDomRefresh();
    case "immutableFontSizeFactor":
      assertValue(isIntegerInRange(value, 0, 20), "fixed font size");
      settings.immutableFontSizeFactor = value;
      return immediateNone();
    case "showNoteIndicators":
      assertValue(typeof value === "boolean", key);
      settings.showNoteIndicators = value;
      return immediateDomRefresh();
    case "statisticDisplayDimension":
      assertValue(isStatisticDisplayDimension(value), "statistics dimension");
      settings.statisticDisplayDimension = value;
      return immediateNone();
    case "statisticValueStep":
      assertValue(isPositiveNumber(value), "heatmap value step");
      settings.statisticValueStep = Math.floor(value);
      return scheduledNone();
    case "rangeNotes.showInCalendar":
      assertValue(typeof value === "boolean", key);
      settings.rangeNotes.showInCalendar = value;
      return immediateNone();
    case "rangeNotes.scanScope":
      assertValue(isRangeNoteScanScope(value), "range note scan scope");
      settings.rangeNotes.scanScope = value;
      return immediateUpdate();
    case "rangeNotes.monthViewLimit":
      assertValue(isPositiveNumber(value), "maximum month lanes");
      settings.rangeNotes.monthViewLimit = Math.floor(value);
      return scheduledNone();
    case "rangeNotes.weekViewLimit":
      assertValue(isPositiveNumber(value), "maximum week lanes");
      settings.rangeNotes.weekViewLimit = Math.floor(value);
      return scheduledNone();
    case "ics.enabled":
      assertValue(typeof value === "boolean", key);
      settings.ics.enabled = value;
      return immediateNone();
    case "ics.sources":
      assertValue(typeof value === "string", key);
      settings.ics.sources = normalizeSourceInput(value);
      return scheduledNone();
  }

  const periodicKey = parsePeriodicEnabledKey(key);
  if (periodicKey !== null) {
    assertValue(typeof value === "boolean", key);
    settings.periodicNotes[periodicKey].enabled = value;
    return immediateDomRefresh();
  }

  const calendarSlot = parseSlotKey(key, "calendarExtensions", 2);
  if (calendarSlot !== null) {
    const next = value === "" ? null : isCalendarExtension(value) ? value : undefined;
    assertValue(next !== undefined, key);
    settings.calendarExtensions = [
      ...updateCalendarExtensionSlot(settings.calendarExtensions, calendarSlot as 0 | 1, next),
    ];
    return immediateUpdate();
  }

  const holidaySlot = parseSlotKey(key, "holidayRegions", 3);
  if (holidaySlot !== null) {
    const next = value === "" ? null : isHolidayRegion(value) ? value : undefined;
    assertValue(next !== undefined, key);
    settings.holidayRegions = [
      ...updateHolidayRegionSlot(settings.holidayRegions, holidaySlot as 0 | 1 | 2, next),
    ];
    return immediateUpdate();
  }

  throw new Error(`Unsupported Chrono Notes setting control: ${key}`);
}

function getGeneralDefinitions(
  context: SettingsSectionContext,
): SettingDefinitionItem<ChronoNotesControlKey>[] {
  const { t } = context.translator;
  const languageOptions: Record<string, string> = {
    auto: t("settings.general.auto"),
  };
  for (const { value, label } of PLUGIN_LANGUAGE_OPTIONS) {
    languageOptions[value] = label;
  }
  return [
    {
      type: "group",
      heading: t("settings.general.title"),
      items: [
        {
          name: t("settings.general.language"),
          desc: t("settings.general.languageDesc"),
          control: {
            type: "dropdown",
            key: "locale",
            defaultValue: "auto",
            options: languageOptions,
          },
        },
        {
          name: t("settings.general.weekStarts"),
          control: {
            type: "dropdown",
            key: "weekStartDay",
            defaultValue: "monday",
            options: {
              monday: t("settings.general.monday"),
              sunday: t("settings.general.sunday"),
            },
          },
        },
        {
          name: t("settings.general.noteNavbar"),
          desc: t("settings.general.noteNavbarDesc"),
          control: {
            type: "toggle",
            key: "showNoteNavbar",
            defaultValue: true,
          },
        },
        buttonDefinition(
          t("settings.general.firstUseGuide"),
          t("settings.general.firstUseGuideDesc"),
          t("settings.general.showFirstUseGuide"),
          () => context.host.openFirstUseGuide(),
        ),
      ],
    },
    {
      type: "group",
      heading: t("settings.general.obsidianProperties"),
      cls: "chrono-notes-property-format-settings",
      items: [
        {
          name: t("settings.general.propertyDateDisplayFormat"),
          desc: t("settings.general.propertyDateDisplayFormatDesc"),
          control: {
            type: "dropdown",
            key: "propertyDateDisplayFormat",
            defaultValue: "system",
            options: {
              system: t("settings.general.propertyDateDisplaySystem"),
              "ymd-dash": t("settings.general.propertyDateDisplayYmdDash"),
              "ymd-slash": t("settings.general.propertyDateDisplayYmdSlash"),
              "ymd-slash-padded": t("settings.general.propertyDateDisplayYmdSlashPadded"),
              "dmy-slash": t("settings.general.propertyDateDisplayDmySlash"),
              "mdy-slash": t("settings.general.propertyDateDisplayMdySlash"),
              custom: t("settings.general.propertyDateDisplayCustom"),
            },
          },
        },
        {
          name: t("settings.general.propertyDateCustomFormat"),
          desc: t("settings.general.propertyDateCustomFormatDesc"),
          visible: () => context.host.settings.propertyDateDisplayFormat === "custom",
          render: (setting) => renderManagedSetting(context, () => {
            configurePropertyFormatSetting(setting, context, "date");
          }),
        },
        {
          name: t("settings.general.propertyTimeDisplayFormat"),
          desc: t("settings.general.propertyTimeDisplayFormatDesc"),
          control: {
            type: "dropdown",
            key: "propertyTimeDisplayFormat",
            defaultValue: "system",
            options: {
              system: t("settings.general.propertyTimeDisplaySystem"),
              "24-hour": t("settings.general.propertyTimeDisplay24Hour"),
              "24-hour-seconds": t("settings.general.propertyTimeDisplay24HourSeconds"),
              "12-hour": t("settings.general.propertyTimeDisplay12Hour"),
              "12-hour-seconds": t("settings.general.propertyTimeDisplay12HourSeconds"),
              custom: t("settings.general.propertyTimeDisplayCustom"),
            },
          },
        },
        {
          name: t("settings.general.propertyTimeCustomFormat"),
          desc: t("settings.general.propertyTimeCustomFormatDesc"),
          visible: () => context.host.settings.propertyTimeDisplayFormat === "custom",
          render: (setting) => renderManagedSetting(context, () => {
            configurePropertyFormatSetting(setting, context, "time");
          }),
        },
        {
          name: t("settings.general.interceptPropertyDateClicks"),
          desc: t("settings.general.interceptPropertyDateClicksDesc"),
          control: {
            type: "toggle",
            key: "interceptPropertyDateClicks",
            defaultValue: true,
          },
        },
      ],
    },
    {
      type: "group",
      heading: t("settings.templates.settingsHeading"),
      items: [
        {
          name: t("settings.templates.engine"),
          desc: t("settings.templates.engineDesc"),
          control: {
            type: "dropdown",
            key: "templateEngine",
            defaultValue: "builtin",
            options: {
              builtin: t("settings.templates.builtinEngine"),
              templater: t("settings.templates.templaterEngine"),
            },
          },
        },
        {
          name: t("settings.templates.settingsHeading"),
          searchable: false,
          render: (setting) => {
            setting.settingEl.empty();
            renderTemplateEngineGuide(setting.settingEl, context);
          },
        },
      ],
    },
  ];
}

function getAppearanceDefinitions(
  context: SettingsSectionContext,
): SettingDefinitionItem<ChronoNotesControlKey>[] {
  const { t } = context.translator;
  return [
    {
      type: "group",
      heading: t("settings.appearance.calendarViews"),
      items: [
        toggleDefinition(
          t("settings.appearance.hoverPreviews"),
          t("settings.appearance.hoverPreviewsDesc"),
          "showHoverPreview",
          true,
        ),
        {
          name: t("settings.appearance.quarterNameMode"),
          desc: t("settings.appearance.quarterNameModeDesc"),
          control: {
            type: "dropdown",
            key: "quarterNameMode",
            defaultValue: "number",
            options: {
              number: t("settings.appearance.quarterNameNumber"),
              chinese: t("settings.appearance.quarterNameChinese"),
            },
          },
        },
        {
          name: t("settings.appearance.fontSizeMode"),
          desc: t("settings.appearance.fontSizeModeDesc"),
          control: {
            type: "dropdown",
            key: "fontSizeMode",
            defaultValue: "immutable",
            options: {
              "follow-obsidian": t("settings.appearance.fontSizeFollowObsidian"),
              "follow-widget": t("settings.appearance.fontSizeFollowSidebar"),
              immutable: t("settings.appearance.fontSizeFixed"),
            },
          },
        },
        {
          name: t("settings.appearance.fixedFontSize"),
          desc: t("settings.appearance.fixedFontSizeDesc"),
          control: {
            type: "slider",
            key: "immutableFontSizeFactor",
            defaultValue: 10,
            min: 0,
            max: 20,
            step: 1,
            disabled: () => context.host.settings.fontSizeMode !== "immutable",
          },
        },
      ],
    },
    {
      type: "group",
      heading: t("settings.appearance.noteStatusAndTasks"),
      items: [
        toggleDefinition(
          t("settings.appearance.showNoteIndicators"),
          t("settings.appearance.showNoteIndicatorsDesc"),
          "showNoteIndicators",
          true,
        ),
        {
          name: t("settings.appearance.showTaskProgress"),
          desc: t("settings.appearance.showTaskProgressDesc"),
          control: {
            type: "toggle",
            key: "showTaskProgress",
            defaultValue: true,
            disabled: () => !context.host.settings.showNoteIndicators,
          },
        },
      ],
    },
    {
      type: "group",
      heading: t("settings.appearance.statistics"),
      items: [
        {
          name: t("settings.appearance.heatmapDimension"),
          desc: t("settings.appearance.heatmapDimensionDesc"),
          control: {
            type: "dropdown",
            key: "statisticDisplayDimension",
            defaultValue: "word-count",
            options: {
              "word-count": t("calendar.statistic.words"),
              "link-count": t("calendar.statistic.links"),
              "tag-count": t("calendar.statistic.tags"),
              "task-completion-rate": t("calendar.statistic.taskCompletion"),
            },
          },
        },
        {
          name: t("settings.appearance.heatmapValueStep"),
          desc: t("settings.appearance.heatmapValueStepDesc"),
          control: {
            type: "number",
            key: "statisticValueStep",
            defaultValue: 200,
            min: 1,
            step: 1,
          },
        },
      ],
    },
  ];
}

function getPeriodicDefinitions(
  context: SettingsSectionContext,
): SettingDefinitionItem<ChronoNotesControlKey>[] {
  const { t } = context.translator;
  return [
    {
      type: "group",
      heading: t("settings.periodic.behavior"),
      items: [
        toggleDefinition(
          t("settings.periodic.confirmBeforeCreating"),
          t("settings.periodic.confirmBeforeCreatingDesc"),
          "confirmPeriodicNoteCreation",
          true,
        ),
        toggleDefinition(
          t("settings.periodic.createLarger"),
          t("settings.periodic.createLargerDesc"),
          "cascadeLargerNotes",
          true,
        ),
      ],
    },
    {
      name: t("settings.periodic.paths"),
      desc: t("settings.periodic.pathsDesc"),
      searchable: false,
    },
    ...PERIODIC_NOTE_TYPES.map((noteType) => ({
      type: "group" as const,
      heading: periodicNoteLabel(noteType, t),
      items: getPeriodicNoteDefinitions(noteType, context),
    })),
  ];
}

function getPeriodicNoteDefinitions(
  noteType: PeriodicNoteType,
  context: SettingsSectionContext,
): SettingGroupItem<ChronoNotesControlKey>[] {
  const { t } = context.translator;
  const enabled = (): boolean => context.host.settings.periodicNotes[noteType].enabled;
  return [
    {
      name: t("settings.periodic.enabled"),
      control: {
        type: "toggle",
        key: `periodicNotes.${noteType}.enabled`,
        defaultValue: false,
      },
    },
    {
      name: t("settings.periodic.pathPattern"),
      visible: enabled,
      render: (setting) => renderManagedSetting(context, () => {
        context.vaultPathSuggestionCatalog.start();
        return configurePeriodicPathSetting(setting, noteType, context);
      }),
    },
    {
      name: t("settings.templates.path"),
      desc: t("settings.templates.pathDesc"),
      visible: enabled,
      render: (setting) => renderManagedSetting(context, () => {
        context.vaultPathSuggestionCatalog.start();
        const config = context.host.settings.periodicNotes[noteType];
        return configureTemplatePathSetting(
          setting,
          t("settings.templates.path"),
          getPeriodicNoteTemplatePathExample(noteType),
          config.templatePath,
          (value) => {
            config.templatePath = value;
          },
          context,
        );
      }),
    },
  ];
}

function getRangeDefinitions(
  context: SettingsSectionContext,
): SettingDefinitionItem<ChronoNotesControlKey>[] {
  const { t } = context.translator;
  return [
    {
      type: "group",
      heading: t("settings.ranges.title"),
      items: [
        buttonDefinition(
          t("settings.ranges.list"),
          t("settings.ranges.listDesc"),
          t("settings.ranges.openList"),
          () => context.host.openIntervalNoteList(),
          "chrono-notes-settings-primary-action",
        ),
        toggleDefinition(
          t("settings.ranges.confirmBeforeCreating"),
          t("settings.ranges.confirmBeforeCreatingDesc"),
          "confirmIntervalNoteCreation",
          true,
        ),
        toggleDefinition(
          t("settings.ranges.showInCalendar"),
          t("settings.ranges.showInCalendarDesc"),
          "rangeNotes.showInCalendar",
          true,
        ),
        {
          name: t("settings.ranges.folder"),
          desc: t("settings.ranges.folderDesc"),
          render: (setting) => renderManagedSetting(context, () => {
            context.vaultPathSuggestionCatalog.start();
            return configureRangeFolderSetting(setting, context);
          }),
        },
        {
          name: t("settings.templates.path"),
          desc: t("settings.templates.pathDesc"),
          render: (setting) => renderManagedSetting(context, () => {
            context.vaultPathSuggestionCatalog.start();
            const settings = context.host.settings.rangeNotes;
            return configureTemplatePathSetting(
              setting,
              t("settings.templates.path"),
              "Templates/Range.md",
              settings.templatePath,
              (value) => {
                settings.templatePath = value;
              },
              context,
            );
          }),
        },
        {
          name: t("settings.ranges.scanScope"),
          control: {
            type: "dropdown",
            key: "rangeNotes.scanScope",
            defaultValue: "range-folder",
            options: {
              "range-folder": t("settings.ranges.rangeFolder"),
              "custom-folder": t("settings.ranges.customFolder"),
              "entire-vault": t("settings.ranges.entireVault"),
            },
          },
        },
        {
          name: t("settings.ranges.customScanFolder"),
          desc: t("settings.ranges.customScanFolderDesc"),
          render: (setting) => renderManagedSetting(context, () => {
            context.vaultPathSuggestionCatalog.start();
            setting.setDisabled(context.host.settings.rangeNotes.scanScope !== "custom-folder");
            return configureCustomRangeFolderSetting(setting, context);
          }),
        },
        {
          name: t("settings.ranges.monthMaximum"),
          control: {
            type: "number",
            key: "rangeNotes.monthViewLimit",
            defaultValue: 2,
            min: 1,
            step: 1,
          },
        },
        {
          name: t("settings.ranges.weekMaximum"),
          control: {
            type: "number",
            key: "rangeNotes.weekViewLimit",
            defaultValue: 5,
            min: 1,
            step: 1,
          },
        },
      ],
    },
  ];
}

function getExtensionDefinitions(
  context: SettingsSectionContext,
): SettingDefinitionItem<ChronoNotesControlKey>[] {
  const { t } = context.translator;
  const snapshot = context.host.getIcsSnapshot();
  return [
    {
      type: "group",
      heading: t("settings.extensions.calendarExtensions"),
      items: [
        {
          name: t("settings.extensions.calendarExtensions"),
          desc: t("settings.extensions.calendarExtensionsDesc"),
          searchable: false,
        },
        calendarExtensionDefinition(0, context),
        calendarExtensionDefinition(1, context),
      ],
    },
    {
      type: "group",
      heading: t("settings.extensions.holidayExtensions"),
      items: [
        {
          name: t("settings.extensions.holidayExtensions"),
          desc: t("settings.extensions.holidayExtensionsDesc"),
          searchable: false,
        },
        holidayRegionDefinition(0, context),
        holidayRegionDefinition(1, context),
        holidayRegionDefinition(2, context),
      ],
    },
    {
      type: "group",
      heading: t("settings.ics.title"),
      items: [
        toggleDefinition(
          t("settings.ics.showEvents"),
          t("settings.ics.showEventsDesc"),
          "ics.enabled",
          false,
        ),
        {
          name: t("settings.ics.sources"),
          desc: t("settings.ics.sourcesDesc"),
          control: {
            type: "textarea",
            key: "ics.sources",
            defaultValue: "",
            placeholder: "Calendars/team.ics",
            rows: 4,
          },
        },
        buttonDefinition(
          t("settings.ics.refresh"),
          formatIcsStatus(snapshot, t),
          snapshot?.state === "refreshing"
            ? t("settings.ics.refreshingButton")
            : t("settings.ics.refreshNow"),
          async () => {
            await context.host.refreshIcs(true);
            context.display();
          },
          undefined,
          snapshot?.state === "refreshing",
        ),
        {
          name: t("settings.ics.refresh"),
          searchable: false,
          visible: () => (context.host.getIcsSnapshot()?.sourceStatuses.length ?? 0) > 0,
          render: (setting) => {
            setting.settingEl.empty();
            const statuses = context.host.getIcsSnapshot()?.sourceStatuses ?? [];
            const statusList = setting.settingEl.createDiv({ cls: "chrono-notes-ics-status" });
            for (const status of statuses) {
              statusList.createDiv({
                cls: status.error === null
                  ? "chrono-notes-ics-source"
                  : "chrono-notes-ics-source is-error",
                text: formatIcsSourceStatus(status, t),
              });
            }
          },
        },
      ],
    },
  ];
}

function calendarExtensionDefinition(
  slot: 0 | 1,
  context: SettingsSectionContext,
): SettingGroupItem<ChronoNotesControlKey> {
  const { t } = context.translator;
  const selected = context.host.settings.calendarExtensions;
  const current = selected[slot] ?? null;
  const usedByOtherSlot = selected[slot === 0 ? 1 : 0] ?? null;
  const definition = current === null
    ? null
    : CALENDAR_EXTENSION_DEFINITIONS.find(({ id }) => id === current) ?? null;
  const currentSupported = current === null ||
    isCalendarExtensionSupported(current, context.translator.locale);
  const options: Record<string, string> = {
    "": t("settings.extensions.calendarExtensionNone"),
  };
  for (const extension of CALENDAR_EXTENSION_DEFINITIONS) {
    if (
      extension.id !== usedByOtherSlot &&
      (extension.id === current ||
        isCalendarExtensionSupported(extension.id, context.translator.locale))
    ) {
      options[extension.id] = t(extension.labelKey);
    }
  }
  return {
    name: t(slot === 0
      ? "settings.extensions.calendarSlot1"
      : "settings.extensions.calendarSlot2"),
    ...(definition === null
      ? {}
      : {
        desc: currentSupported
          ? t(definition.descriptionKey)
          : t("settings.extensions.calendarExtensionUnavailable", {
            calendar: t(definition.labelKey),
          }),
      }),
    control: {
      type: "dropdown",
      key: `calendarExtensions.${slot}`,
      defaultValue: "",
      options,
    },
  };
}

function holidayRegionDefinition(
  slot: 0 | 1 | 2,
  context: SettingsSectionContext,
): SettingGroupItem<ChronoNotesControlKey> {
  const { t } = context.translator;
  const selected = context.host.settings.holidayRegions;
  const usedByOtherSlots = new Set(selected.filter((_, index) => index !== slot));
  const slotKeys = [
    "settings.extensions.holidayRegionSlot1",
    "settings.extensions.holidayRegionSlot2",
    "settings.extensions.holidayRegionSlot3",
  ] as const;
  const options: Record<string, string> = {
    "": t("settings.extensions.holidayRegionNone"),
  };
  for (const definition of HOLIDAY_REGION_DEFINITIONS) {
    if (!usedByOtherSlots.has(definition.id)) {
      options[definition.id] = t(definition.labelKey);
    }
  }
  return {
    name: t(slotKeys[slot]),
    control: {
      type: "dropdown",
      key: `holidayRegions.${slot}`,
      defaultValue: "",
      options,
    },
  };
}

function toggleDefinition(
  name: string,
  desc: string,
  key: ChronoNotesControlKey,
  defaultValue: boolean,
): SettingGroupItem<ChronoNotesControlKey> {
  return {
    name,
    desc,
    control: {
      type: "toggle",
      key,
      defaultValue,
    },
  };
}

function buttonDefinition(
  name: string,
  desc: string,
  label: string,
  onClick: () => void | Promise<void>,
  cls?: string,
  disabled = false,
): SettingGroupItem<ChronoNotesControlKey> {
  return {
    name,
    desc,
    render: (setting) => {
      if (cls !== undefined) setting.settingEl.addClass(cls);
      setting.addButton((button) => {
        button
          .setButtonText(label)
          .setDisabled(disabled)
          .onClick(onClick);
      });
    },
  };
}

function parsePeriodicEnabledKey(key: string): PeriodicNoteType | null {
  const match = /^periodicNotes\.(daily|weekly|monthly|quarterly|yearly)\.enabled$/.exec(key);
  return match === null ? null : match[1] as PeriodicNoteType;
}

function parseSlotKey(
  key: string,
  prefix: "calendarExtensions" | "holidayRegions",
  slotCount: number,
): number | null {
  if (!key.startsWith(`${prefix}.`)) return null;
  const slot = Number(key.slice(prefix.length + 1));
  return Number.isInteger(slot) && slot >= 0 && slot < slotCount ? slot : null;
}

function assertValue(condition: boolean, label: string): asserts condition {
  if (!condition) throw new TypeError(`Invalid Chrono Notes ${label} setting.`);
}

function isIntegerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function immediateNone(): DeclarativeSettingMutation {
  return { persistence: "immediate", refresh: "none" };
}

function immediateDomRefresh(): DeclarativeSettingMutation {
  return { persistence: "immediate", refresh: "refresh-dom-state" };
}

function immediateUpdate(): DeclarativeSettingMutation {
  return { persistence: "immediate", refresh: "update" };
}

function scheduledNone(): DeclarativeSettingMutation {
  return { persistence: "scheduled", refresh: "none" };
}

function renderManagedSetting(
  context: SettingsSectionContext,
  render: () => void | (() => void),
): () => void {
  const cleanup = render();
  return () => {
    try {
      cleanup?.();
    } finally {
      context.flushSettingsSave();
    }
  };
}

function getRequiredLabel(
  labels: ReadonlyMap<SettingsTabId, string>,
  id: SettingsTabId,
): string {
  const label = labels.get(id);
  if (label === undefined) throw new Error(`Missing settings tab label: ${id}`);
  return label;
}

function pageOrder(id: SettingsTabId, preferredPage: SettingsTabId): number {
  if (id === preferredPage) return -1;
  return [
    "general",
    "appearance",
    "periodic",
    "ranges",
    "extensions-and-integrations",
  ].indexOf(id);
}
