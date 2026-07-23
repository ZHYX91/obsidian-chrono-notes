import { Setting } from "obsidian";

import {
  CALENDAR_OVERLAY_DEFINITIONS,
  isCalendarOverlaySupported,
  updateCalendarOverlaySlot,
} from "../../features/calendar/calendar-overlay-registry";
import {
  HOLIDAY_REGION_DEFINITIONS,
  updateHolidayRegionSlot,
} from "../../features/calendar/holiday-region-registry";
import {
  isCalendarOverlay,
  isFontSizeMode,
  isHolidayRegion,
  isQuarterNameMode,
  isStatisticDisplayDimension,
  isTodoAnnotationMode,
  type CalendarOverlay,
  type HolidayRegion,
} from "../../shared/settings";
import type { SettingsSectionContext } from "./settings-section-context";

export function renderAppearanceSettingsSection(
  containerEl: HTMLElement,
  context: SettingsSectionContext,
): void {
  const { t } = context.translator;
  containerEl.createEl("h3", { text: t("settings.appearance.calendarViews") });
  new Setting(containerEl)
    .setName(t("settings.appearance.hoverPreviews"))
    .setDesc(t("settings.appearance.hoverPreviewsDesc"))
    .addToggle((toggle) => {
      toggle.setValue(context.host.settings.showHoverPreview).onChange(async (enabled) => {
        context.host.settings.showHoverPreview = enabled;
        await context.persistSettings();
      });
    });

  new Setting(containerEl)
    .setName(t("settings.appearance.showNoteIndicators"))
    .setDesc(t("settings.appearance.showNoteIndicatorsDesc"))
    .addToggle((toggle) => {
      toggle.setValue(context.host.settings.showNoteIndicators).onChange(async (enabled) => {
        context.host.settings.showNoteIndicators = enabled;
        await context.persistSettings();
      });
    });

  new Setting(containerEl)
    .setName(t("settings.appearance.quarterNameMode"))
    .setDesc(t("settings.appearance.quarterNameModeDesc"))
    .addDropdown((dropdown) => {
      dropdown
        .addOption("number", t("settings.appearance.quarterNameNumber"))
        .addOption("chinese", t("settings.appearance.quarterNameChinese"))
        .setValue(context.host.settings.quarterNameMode)
        .onChange(async (value) => {
          if (!isQuarterNameMode(value)) return;
          context.host.settings.quarterNameMode = value;
          await context.persistSettings();
        });
    });

  new Setting(containerEl)
    .setName(t("settings.appearance.fontSizeMode"))
    .setDesc(t("settings.appearance.fontSizeModeDesc"))
    .addDropdown((dropdown) => {
      dropdown
        .addOption("follow-obsidian", t("settings.appearance.fontSizeFollowObsidian"))
        .addOption("follow-widget", t("settings.appearance.fontSizeFollowSidebar"))
        .addOption("immutable", t("settings.appearance.fontSizeFixed"))
        .setValue(context.host.settings.fontSizeMode)
        .onChange(async (value) => {
          if (!isFontSizeMode(value)) return;
          context.host.settings.fontSizeMode = value;
          await context.persistSettings();
          context.display();
        });
    });

  const fixedFontSize = new Setting(containerEl)
    .setName(t("settings.appearance.fixedFontSize"))
    .setDesc(t("settings.appearance.fixedFontSizeDesc"))
    .addSlider((slider) => {
      slider
        .setLimits(0, 20, 1)
        .setValue(context.host.settings.immutableFontSizeFactor)
        .setDynamicTooltip()
        .onChange(async (value) => {
          context.host.settings.immutableFontSizeFactor = value;
          await context.persistSettings();
        });
    });
  fixedFontSize.setDisabled(context.host.settings.fontSizeMode !== "immutable");

  new Setting(containerEl)
    .setName(t("settings.appearance.todoAnnotationMode"))
    .setDesc(t("settings.appearance.todoAnnotationModeDesc"))
    .addDropdown((dropdown) => {
      dropdown
        .addOption("none", t("settings.appearance.todoAnnotationNone"))
        .addOption("color", t("settings.appearance.todoAnnotationColor"))
        .addOption("hole", t("settings.appearance.todoAnnotationHole"))
        .setValue(context.host.settings.todoAnnotationMode)
        .onChange(async (value) => {
          if (!isTodoAnnotationMode(value)) return;
          context.host.settings.todoAnnotationMode = value;
          await context.persistSettings();
        });
    });

  containerEl.createEl("h3", { text: t("settings.appearance.statistics") });
  new Setting(containerEl)
    .setName(t("settings.appearance.heatmapDimension"))
    .setDesc(t("settings.appearance.heatmapDimensionDesc"))
    .addDropdown((dropdown) => {
      dropdown
        .addOption("word-count", t("calendar.statistic.words"))
        .addOption("link-count", t("calendar.statistic.links"))
        .addOption("tag-count", t("calendar.statistic.tags"))
        .addOption("task-completion-rate", t("calendar.statistic.taskCompletion"))
        .setValue(context.host.settings.statisticDisplayDimension)
        .onChange(async (value) => {
          if (!isStatisticDisplayDimension(value)) return;
          context.host.settings.statisticDisplayDimension = value;
          await context.persistSettings();
        });
    });
  new Setting(containerEl)
    .setName(t("settings.appearance.heatmapValueStep"))
    .setDesc(t("settings.appearance.heatmapValueStepDesc"))
    .addText((text) => {
      text
        .setValue(String(context.host.settings.statisticValueStep))
        .onChange((value) => {
          const parsed = Number(value);
          if (!Number.isFinite(parsed) || parsed <= 0) return;
          const normalized = Math.floor(parsed);
          if (normalized < 1) return;
          context.host.settings.statisticValueStep = normalized;
          context.scheduleSettingsSave();
        });
      text.inputEl.inputMode = "numeric";
      context.flushSettingsSaveOnBlur(text.inputEl);
    });

  containerEl.createEl("h3", { text: t("settings.appearance.calendarExtensions") });
  containerEl.createEl("p", {
    cls: "setting-item-description",
    text: t("settings.appearance.calendarExtensionsDesc"),
  });
  addCalendarOverlaySlot(containerEl, 0, context);
  addCalendarOverlaySlot(containerEl, 1, context);

  containerEl.createEl("h3", { text: t("settings.appearance.holidayRegions") });
  containerEl.createEl("p", {
    cls: "setting-item-description",
    text: t("settings.appearance.holidayRegionsDesc"),
  });
  addHolidayRegionSlot(containerEl, 0, context);
  addHolidayRegionSlot(containerEl, 1, context);
  addHolidayRegionSlot(containerEl, 2, context);
}

function addCalendarOverlaySlot(
  containerEl: HTMLElement,
  slot: 0 | 1,
  context: SettingsSectionContext,
): void {
  const { t } = context.translator;
  const selected = context.host.settings.calendarOverlays;
  const current = selected[slot] ?? null;
  const usedByOtherSlot = selected[slot === 0 ? 1 : 0] ?? null;
  const definition = current === null
    ? null
    : CALENDAR_OVERLAY_DEFINITIONS.find(({ id }) => id === current) ?? null;
  const currentSupported = current === null ||
    isCalendarOverlaySupported(current, context.translator.locale);

  const setting = new Setting(containerEl)
    .setName(t(slot === 0
      ? "settings.appearance.calendarExtensionFirst"
      : "settings.appearance.calendarExtensionSecond"));
  if (definition !== null) {
    setting.setDesc(currentSupported
      ? t(definition.descriptionKey)
      : t("settings.appearance.calendarExtensionUnavailable", {
        calendar: t(definition.labelKey),
      }));
  }
  setting.addDropdown((dropdown) => {
    dropdown.addOption("", t("settings.appearance.calendarExtensionNone"));
    for (const overlay of CALENDAR_OVERLAY_DEFINITIONS) {
      if (
        overlay.id !== usedByOtherSlot &&
        (overlay.id === current ||
          isCalendarOverlaySupported(overlay.id, context.translator.locale))
      ) {
        dropdown.addOption(overlay.id, t(overlay.labelKey));
      }
    }
    dropdown.setValue(current ?? "").onChange(async (value) => {
      const next: CalendarOverlay | null = value.length === 0
        ? null
        : isCalendarOverlay(value) ? value : null;
      context.host.settings.calendarOverlays = [
        ...updateCalendarOverlaySlot(context.host.settings.calendarOverlays, slot, next),
      ];
      await context.persistSettings();
      context.display();
    });
  });
}

function addHolidayRegionSlot(
  containerEl: HTMLElement,
  slot: 0 | 1 | 2,
  context: SettingsSectionContext,
): void {
  const { t } = context.translator;
  const selected = context.host.settings.holidayRegions;
  const current = selected[slot] ?? null;
  const usedByOtherSlots = new Set(selected.filter((_, index) => index !== slot));
  const slotKeys = [
    "settings.appearance.holidayRegionSlot1",
    "settings.appearance.holidayRegionSlot2",
    "settings.appearance.holidayRegionSlot3",
  ] as const;

  new Setting(containerEl).setName(t(slotKeys[slot])).addDropdown((dropdown) => {
    dropdown.addOption("", t("settings.appearance.holidayRegionNone"));
    for (const definition of HOLIDAY_REGION_DEFINITIONS) {
      if (!usedByOtherSlots.has(definition.id)) {
        dropdown.addOption(definition.id, t(definition.labelKey));
      }
    }
    dropdown.setValue(current ?? "").onChange(async (value) => {
      const next: HolidayRegion | null = value.length === 0
        ? null
        : isHolidayRegion(value) ? value : null;
      context.host.settings.holidayRegions = [
        ...updateHolidayRegionSlot(context.host.settings.holidayRegions, slot, next),
      ];
      await context.persistSettings();
      context.display();
    });
  });
}
