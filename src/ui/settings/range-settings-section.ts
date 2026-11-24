import { renderNoteTemplateGuide } from "./template-guide";
import { Setting } from "obsidian";

import { normalizeIntervalNoteFolder } from "../../core/note/interval-note-spec";
import { isRangeNoteScanScope } from "../../shared/settings";
import { preparePathInput } from "./path-input";
import {
  combineSettingsCleanups,
  type SettingsCleanup,
} from "./settings-cleanup";
import type { SettingsSectionContext } from "./settings-section-context";
import { createSettingsGuide } from "./settings-guide";
import { renderTemplatePathSetting } from "./template-settings";
import { VaultFolderSuggest } from "./vault-path-suggest";

export function renderRangeSettingsSection(
  containerEl: HTMLElement,
  context: SettingsSectionContext,
): SettingsCleanup {
  const { t } = context.translator;
  const settings = context.host.settings.rangeNotes;
  containerEl.createEl("p", {
    cls: "chrono-notes-settings-guide-brief",
    text: t("settings.ranges.recognitionRequirements"),
  });
  containerEl.createEl("p", {
    cls: "chrono-notes-settings-guide-brief",
    text: t("settings.ranges.recognitionNoMigration"),
  });
  const recognitionGuideEl = createSettingsGuide(
    containerEl,
    t("settings.ranges.recognitionGuideTitle"),
    "range-recognition",
  );
  const recognitionRulesEl = recognitionGuideEl.createEl("ul");
  appendRecognitionRule(
    recognitionRulesEl,
    "chrono-notes: interval",
    t("settings.ranges.recognitionExplicit"),
  );
  appendRecognitionRule(
    recognitionRulesEl,
    "chrono-notes",
    t("settings.ranges.recognitionUnmarked"),
  );
  appendRecognitionRule(
    recognitionRulesEl,
    "chrono-notes",
    t("settings.ranges.recognitionExcluded"),
  );
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
  const rangeFolderCleanup = configureRangeFolderSetting(new Setting(containerEl), context);
  renderNoteTemplateGuide(containerEl, context, "interval");
  const templateCleanup = renderTemplatePathSetting(
    containerEl,
    t("settings.templates.path"),
    "Templates/Range.md",
    settings.templatePath,
    (value) => {
      settings.templatePath = value;
    },
    context,
  );
  new Setting(containerEl)
    .setName(t("settings.ranges.scanScope"))
    .setDesc(t("settings.ranges.scanScopeDesc"))
    .addDropdown((dropdown) => {
      dropdown
        .addOption("range-folder", t("settings.ranges.rangeFolder"))
        .addOption("custom-folder", t("settings.ranges.customFolder"))
        .addOption("entire-vault", t("settings.ranges.entireVault"))
        .setValue(settings.scanScope)
        .onChange(async (value) => {
          if (!isRangeNoteScanScope(value)) return;
          settings.scanScope = value;
          customFolder.setDisabled(value !== "custom-folder");
          await context.persistSettings();
        });
    });
  const customFolder = new Setting(containerEl);
  const customFolderCleanup = configureCustomRangeFolderSetting(customFolder, context);
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
  return combineSettingsCleanups([
    rangeFolderCleanup,
    templateCleanup,
    customFolderCleanup,
  ]);
}

function appendRecognitionRule(
  listEl: HTMLUListElement,
  property: string,
  description: string,
): void {
  const itemEl = listEl.createEl("li");
  itemEl.createEl("code", { text: property });
  itemEl.append(` — ${description}`);
}

export function configureRangeFolderSetting(
  folderSetting: Setting,
  context: SettingsSectionContext,
): SettingsCleanup {
  const { t } = context.translator;
  const settings = context.host.settings.rangeNotes;
  folderSetting
    .setName(t("settings.ranges.folder"))
    .setDesc(t("settings.ranges.folderDesc"));
  folderSetting.settingEl.addClass("chrono-notes-wide-input-setting");
  const pathExampleEl = folderSetting.descEl.createDiv({
    cls: "chrono-notes-range-path-example",
  });
  const updatePathExample = (): void => {
    const folder = normalizeIntervalNoteFolder(settings.folder);
    pathExampleEl.empty();
    pathExampleEl.append(`${t("settings.ranges.pathExample")}: `);
    pathExampleEl.createEl("code", {
      text: `${folder.length === 0 ? "Ranges" : folder}/`
        + "2026-07-01 - 2026-07-07.md",
    });
  };
  let suggest: VaultFolderSuggest | null = null;
  folderSetting.addText((text) => {
    text
      .setPlaceholder("Ranges")
      .setValue(settings.folder)
      .onChange((value) => {
        settings.folder = value;
        updatePathExample();
        context.scheduleSettingsSave();
      });
    preparePathInput(text.inputEl);
    context.flushSettingsSaveOnBlur(text.inputEl);
    suggest = new VaultFolderSuggest(
      context.app,
      text.inputEl,
      context.vaultPathSuggestionCatalog,
    );
  });
  updatePathExample();
  return () => suggest?.close();
}

export function configureCustomRangeFolderSetting(
  customFolder: Setting,
  context: SettingsSectionContext,
): SettingsCleanup {
  const { t } = context.translator;
  const settings = context.host.settings.rangeNotes;
  customFolder
    .setName(t("settings.ranges.customScanFolder"))
    .setDesc(t("settings.ranges.customScanFolderDesc"));
  customFolder.settingEl.addClass("chrono-notes-wide-input-setting");
  let suggest: VaultFolderSuggest | null = null;
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
    suggest = new VaultFolderSuggest(
      context.app,
      text.inputEl,
      context.vaultPathSuggestionCatalog,
    );
  });
  return () => suggest?.close();
}

function addPositiveIntegerSetting(
  containerEl: HTMLElement,
  name: string,
  current: number,
  onChange: (value: number) => void,
  context: SettingsSectionContext,
): void {
  new Setting(containerEl).setName(name).addText((text) => {
    let lastValidValue = current;
    text.setValue(String(current)).onChange((value) => {
      const parsed = parsePositiveIntegerInput(value);
      text.inputEl.setAttribute("aria-invalid", String(parsed === null));
      if (parsed === null) return;
      lastValidValue = parsed;
      onChange(parsed);
      context.scheduleSettingsSave();
    });
    text.inputEl.inputMode = "numeric";
    text.inputEl.addEventListener("blur", () => {
      const parsed = parsePositiveIntegerInput(text.inputEl.value);
      if (parsed === null) text.setValue(String(lastValidValue));
      text.inputEl.removeAttribute("aria-invalid");
    });
    context.flushSettingsSaveOnBlur(text.inputEl);
  });
}

/** Accept only complete positive integers; never silently truncate user input. */
export function parsePositiveIntegerInput(value: string): number | null {
  if (!/^[1-9]\d*$/u.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}
