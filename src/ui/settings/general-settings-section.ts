import { Setting } from "obsidian";

import { isPluginLocale, isWeekStartDay } from "../../shared/settings";
import type { SettingsSectionContext } from "./settings-section-context";

export function renderGeneralSettingsSection(
  containerEl: HTMLElement,
  context: SettingsSectionContext,
): void {
  const { t } = context.translator;
  containerEl.createEl("h3", { text: t("settings.general.title") });
  new Setting(containerEl)
    .setName(t("settings.general.language"))
    .setDesc(t("settings.general.languageDesc"))
    .addDropdown((dropdown) => {
      dropdown
        .addOption("auto", t("settings.general.auto"))
        .addOption("en", t("settings.general.languageEnglish"))
        .addOption("zh-CN", t("settings.general.languageSimplifiedChinese"))
        .addOption("zh-TW", t("settings.general.languageTraditionalChinese"))
        .addOption("ar", "العربية")
        .addOption("fa", "فارسی")
        .addOption("he", "עברית")
        .addOption("am", "አማርኛ")
        .addOption("hi", "हिन्दी")
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

  new Setting(containerEl)
    .setName(t("settings.general.firstUseGuide"))
    .setDesc(t("settings.general.firstUseGuideDesc"))
    .addButton((button) => {
      button
        .setButtonText(t("settings.general.showFirstUseGuide"))
        .onClick(() => context.host.openFirstUseGuide());
    });
}
