import { Setting } from "obsidian";

import {
  isFontSizeMode,
  isQuarterNameMode,
  isStatisticDisplayDimension,
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
        .onChange(async (value) => {
          context.host.settings.immutableFontSizeFactor = value;
          await context.persistSettings();
        });
      enableLegacyDynamicSliderTooltip(slider);
    });
  fixedFontSize.setDisabled(context.host.settings.fontSizeMode !== "immutable");

  containerEl.createEl("h3", {
    text: t("settings.appearance.noteStatusAndTasks"),
  });
  new Setting(containerEl)
    .setName(t("settings.appearance.showNoteIndicators"))
    .setDesc(t("settings.appearance.showNoteIndicatorsDesc"))
    .addToggle((toggle) => {
      toggle.setValue(context.host.settings.showNoteIndicators).onChange(async (enabled) => {
        context.host.settings.showNoteIndicators = enabled;
        await context.persistSettings();
        context.display();
      });
    });

  const taskProgressSetting = new Setting(containerEl)
    .setName(t("settings.appearance.showTaskProgress"))
    .setDesc(t("settings.appearance.showTaskProgressDesc"))
    .addToggle((toggle) => {
      toggle
        .setValue(context.host.settings.showTaskProgress)
        .onChange(async (enabled) => {
          context.host.settings.showTaskProgress = enabled;
          await context.persistSettings();
        });
    });
  taskProgressSetting.setDisabled(!context.host.settings.showNoteIndicators);

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

}

function enableLegacyDynamicSliderTooltip(slider: object): void {
  const setDynamicTooltip: unknown = Reflect.get(slider, "setDynamicTooltip");
  if (typeof setDynamicTooltip === "function") {
    Reflect.apply(setDynamicTooltip, slider, []);
  }
}
