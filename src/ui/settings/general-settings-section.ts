import { moment, Setting } from "obsidian";

import {
  isValidPropertyDateFormat,
  isValidPropertyTimeFormat,
  MAX_PROPERTY_DATE_FORMAT_LENGTH,
  resolvePropertyMomentLocale,
} from "../../core/properties/property-date-display";
import {
  isPropertyDateDisplayFormat,
  isPropertyTimeDisplayFormat,
  isPluginLocale,
  isWeekStartDay,
} from "../../shared/settings";
import { PLUGIN_LANGUAGE_OPTIONS } from "../../shared/plugin-languages";
import type { SettingsCleanup } from "./settings-cleanup";
import { renderIndexCacheSettingsSection } from "./index-cache-settings";
import type { SettingsSectionContext } from "./settings-section-context";
import { renderTemplateEngineSettings } from "./template-settings";

const PROPERTY_FORMAT_PREVIEW_VALUE = "2026-07-31T14:05:06.123";
const formatPreviewMoment = moment as unknown as (
  value: string,
) => {
  locale(locale: string): { format(pattern: string): string };
};

export function renderGeneralSettingsSection(
  containerEl: HTMLElement,
  context: SettingsSectionContext,
): SettingsCleanup {
  const { t } = context.translator;
  new Setting(containerEl)
    .setName(t("settings.general.language"))
    .setDesc(t("settings.general.languageDesc"))
    .addDropdown((dropdown) => {
      dropdown.addOption("auto", t("settings.general.auto"));
      for (const option of PLUGIN_LANGUAGE_OPTIONS) {
        dropdown.addOption(option.value, option.label);
      }
      dropdown
        .setValue(context.host.settings.locale)
        .onChange(async (value) => {
          if (!isPluginLocale(value)) return;
          context.host.settings.locale = value;
          await context.persistSettings();
          context.display();
        });
    });

  new Setting(containerEl)
    .setName(t("settings.general.weekStarts"))
    .addDropdown((dropdown) => {
      dropdown
        .addOption("monday", t("settings.general.monday"))
        .addOption("sunday", t("settings.general.sunday"))
        .setValue(context.host.settings.weekStartDay)
        .onChange(async (value) => {
          if (!isWeekStartDay(value)) return;
          context.host.settings.weekStartDay = value;
          await context.persistSettings();
        });
    });

  new Setting(containerEl)
    .setName(t("settings.general.noteNavbar"))
    .setDesc(t("settings.general.noteNavbarDesc"))
    .addToggle((toggle) => {
      toggle.setValue(context.host.settings.showNoteNavbar).onChange(async (enabled) => {
        context.host.settings.showNoteNavbar = enabled;
        await context.persistSettings();
      });
    });

  new Setting(containerEl)
    .setName(t("settings.general.firstUseGuide"))
    .setDesc(t("settings.general.firstUseGuideDesc"))
    .addButton((button) => {
      button
        .setButtonText(t("settings.general.showFirstUseGuide"))
        .onClick(() => context.host.openFirstUseGuide());
    });

  containerEl.createEl("h3", { text: t("settings.general.obsidianProperties") });
  const dateFormatSetting = new Setting(containerEl);
  dateFormatSetting.settingEl.addClass("chrono-notes-property-format-settings");
  dateFormatSetting
    .setName(t("settings.general.propertyDateDisplayFormat"))
    .setDesc(t("settings.general.propertyDateDisplayFormatDesc"))
    .addDropdown((dropdown) => {
      dropdown
        .addOption("system", t("settings.general.propertyDateDisplaySystem"))
        .addOption("ymd-dash", t("settings.general.propertyDateDisplayYmdDash"))
        .addOption("ymd-slash", t("settings.general.propertyDateDisplayYmdSlash"))
        .addOption(
          "ymd-slash-padded",
          t("settings.general.propertyDateDisplayYmdSlashPadded"),
        )
        .addOption("dmy-slash", t("settings.general.propertyDateDisplayDmySlash"))
        .addOption("mdy-slash", t("settings.general.propertyDateDisplayMdySlash"))
        .addOption("custom", t("settings.general.propertyDateDisplayCustom"))
        .setValue(context.host.settings.propertyDateDisplayFormat)
        .onChange(async (value) => {
          if (!isPropertyDateDisplayFormat(value)) return;
          context.host.settings.propertyDateDisplayFormat = value;
          await context.persistSettings();
          context.display();
        });
    });

  if (context.host.settings.propertyDateDisplayFormat === "custom") {
    configurePropertyFormatSetting(new Setting(containerEl), context, "date");
  }

  const timeFormatSetting = new Setting(containerEl);
  timeFormatSetting.settingEl.addClass("chrono-notes-property-format-settings");
  timeFormatSetting
    .setName(t("settings.general.propertyTimeDisplayFormat"))
    .setDesc(t("settings.general.propertyTimeDisplayFormatDesc"))
    .addDropdown((dropdown) => {
      dropdown
        .addOption("system", t("settings.general.propertyTimeDisplaySystem"))
        .addOption("24-hour", t("settings.general.propertyTimeDisplay24Hour"))
        .addOption(
          "24-hour-seconds",
          t("settings.general.propertyTimeDisplay24HourSeconds"),
        )
        .addOption("12-hour", t("settings.general.propertyTimeDisplay12Hour"))
        .addOption(
          "12-hour-seconds",
          t("settings.general.propertyTimeDisplay12HourSeconds"),
        )
        .addOption("custom", t("settings.general.propertyTimeDisplayCustom"))
        .setValue(context.host.settings.propertyTimeDisplayFormat)
        .onChange(async (value) => {
          if (!isPropertyTimeDisplayFormat(value)) return;
          context.host.settings.propertyTimeDisplayFormat = value;
          await context.persistSettings();
          context.display();
        });
    });

  if (context.host.settings.propertyTimeDisplayFormat === "custom") {
    configurePropertyFormatSetting(new Setting(containerEl), context, "time");
  }

  new Setting(containerEl)
    .setName(t("settings.general.interceptPropertyDateClicks"))
    .setDesc(t("settings.general.interceptPropertyDateClicksDesc"))
    .addToggle((toggle) => {
      toggle
        .setValue(context.host.settings.interceptPropertyDateClicks)
        .onChange(async (enabled) => {
          context.host.settings.interceptPropertyDateClicks = enabled;
          await context.persistSettings();
        });
    });

  renderTemplateEngineSettings(containerEl, context);
  return renderIndexCacheSettingsSection(containerEl, context);
}

export function configurePropertyFormatSetting(
  setting: Setting,
  context: SettingsSectionContext,
  kind: "date" | "time",
): void {
  const { t } = context.translator;
  const isDate = kind === "date";
  setting.settingEl.addClass("chrono-notes-property-custom-format-setting");
  setting
    .setName(t(isDate
      ? "settings.general.propertyDateCustomFormat"
      : "settings.general.propertyTimeCustomFormat"))
    .setDesc(t(isDate
      ? "settings.general.propertyDateCustomFormatDesc"
      : "settings.general.propertyTimeCustomFormatDesc"));
  const feedback = setting.descEl.createDiv({
    cls: "chrono-notes-property-format-feedback",
  });
  const renderFeedback = (format: string, inputEl: HTMLInputElement): void => {
    const valid = isDate
      ? isValidPropertyDateFormat(format)
      : isValidPropertyTimeFormat(format);
    inputEl.setAttribute("aria-invalid", String(!valid));
    feedback.toggleClass("is-error", !valid);
    feedback.setText(valid
      ? t("settings.general.propertyFormatPreview", {
        preview: formatPreviewMoment(PROPERTY_FORMAT_PREVIEW_VALUE)
          .locale(resolvePropertyMomentLocale(context.translator.locale))
          .format(format),
      })
      : t("settings.general.propertyFormatInvalid"));
  };
  setting.addText((text) => {
    const current = isDate
      ? context.host.settings.propertyDateCustomFormat
      : context.host.settings.propertyTimeCustomFormat;
    text
      .setPlaceholder(isDate ? "YYYY-MM-DD dddd" : "HH:mm")
      .setValue(current)
      .onChange((value) => {
        const normalized = value.slice(0, MAX_PROPERTY_DATE_FORMAT_LENGTH);
        if (isDate) context.host.settings.propertyDateCustomFormat = normalized;
        else context.host.settings.propertyTimeCustomFormat = normalized;
        renderFeedback(normalized, text.inputEl);
        context.scheduleSettingsSave();
      });
    text.inputEl.maxLength = MAX_PROPERTY_DATE_FORMAT_LENGTH;
    context.flushSettingsSaveOnBlur(text.inputEl);
    renderFeedback(current, text.inputEl);
  });
}
