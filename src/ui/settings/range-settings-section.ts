import { Setting } from "obsidian";

import { isRangeNoteScanScope } from "../../shared/settings";
import { preparePathInput } from "./path-input";
import type { SettingsSectionContext } from "./settings-section-context";
import { VaultFolderSuggest } from "./vault-path-suggest";

export function renderRangeSettingsSection(
  containerEl: HTMLElement,
  context: SettingsSectionContext,
): void {
  const { t } = context.translator;
  const settings = context.host.settings.rangeNotes;
  containerEl.createEl("h3", { text: t("settings.ranges.title") });
  const listSetting = new Setting(containerEl)
    .setName(t("settings.ranges.list"))
    .setDesc(t("settings.ranges.listDesc"));
  listSetting.settingEl.addClass("chrono-notes-settings-primary-action");
  listSetting.addButton((button) => {
    button
      .setButtonText(t("settings.ranges.openList"))
      .onClick(() => context.host.openIntervalNoteList());
  });
  new Setting(containerEl)
    .setName(t("settings.ranges.confirmBeforeCreating"))
    .setDesc(t("settings.ranges.confirmBeforeCreatingDesc"))
    .addToggle((toggle) => {
      toggle
        .setValue(context.host.settings.confirmIntervalNoteCreation)
        .onChange(async (value) => {
          context.host.settings.confirmIntervalNoteCreation = value;
          await context.persistSettings();
        });
    });
  new Setting(containerEl)
    .setName(t("settings.ranges.showInCalendar"))
    .setDesc(t("settings.ranges.showInCalendarDesc"))
    .addToggle((toggle) => {
      toggle.setValue(settings.showInCalendar).onChange(async (value) => {
        settings.showInCalendar = value;
        await context.persistSettings();
      });
    });
  const folderSetting = new Setting(containerEl)
    .setName(t("settings.ranges.folder"))
    .setDesc(t("settings.ranges.folderDesc"));
  folderSetting.settingEl.addClass("chrono-notes-wide-input-setting");
  folderSetting.addText((text) => {
    text
      .setPlaceholder("Ranges")
      .setValue(settings.folder)
      .onChange((value) => {
        settings.folder = value;
        context.scheduleSettingsSave();
      });
    preparePathInput(text.inputEl);
    context.flushSettingsSaveOnBlur(text.inputEl);
    new VaultFolderSuggest(
      context.app,
      text.inputEl,
      context.vaultPathSuggestionCatalog,
    );
  });
  new Setting(containerEl).setName(t("settings.ranges.scanScope")).addDropdown((dropdown) => {
    dropdown
      .addOption("range-folder", t("settings.ranges.rangeFolder"))
      .addOption("custom-folder", t("settings.ranges.customFolder"))
      .addOption("entire-vault", t("settings.ranges.entireVault"))
      .setValue(settings.scanScope)
      .onChange(async (value) => {
        if (!isRangeNoteScanScope(value)) return;
        settings.scanScope = value;
        await context.persistSettings();
        context.display();
      });
  });
  const customFolder = new Setting(containerEl)
    .setName(t("settings.ranges.customScanFolder"))
    .setDesc(t("settings.ranges.customScanFolderDesc"));
  customFolder.settingEl.addClass("chrono-notes-wide-input-setting");
  customFolder.addText((text) => {
    text
      .setPlaceholder("Projects")
      .setValue(settings.customFolder)
      .onChange((value) => {
        settings.customFolder = value;
        context.scheduleSettingsSave();
      });
    preparePathInput(text.inputEl);
    context.flushSettingsSaveOnBlur(text.inputEl);
    new VaultFolderSuggest(
      context.app,
      text.inputEl,
      context.vaultPathSuggestionCatalog,
    );
  });
  customFolder.setDisabled(settings.scanScope !== "custom-folder");
  addPositiveIntegerSetting(
    containerEl,
    t("settings.ranges.monthMaximum"),
    settings.monthViewLimit,
    (value) => {
      settings.monthViewLimit = value;
    },
    context,
  );
  addPositiveIntegerSetting(
    containerEl,
    t("settings.ranges.weekMaximum"),
    settings.weekViewLimit,
    (value) => {
      settings.weekViewLimit = value;
    },
    context,
  );
}

function addPositiveIntegerSetting(
  containerEl: HTMLElement,
  name: string,
  current: number,
  onChange: (value: number) => void,
  context: SettingsSectionContext,
): void {
  new Setting(containerEl).setName(name).addText((text) => {
    text.setValue(String(current)).onChange((value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) return;
      onChange(Math.floor(parsed));
      context.scheduleSettingsSave();
    });
    text.inputEl.inputMode = "numeric";
    context.flushSettingsSaveOnBlur(text.inputEl);
  });
}
