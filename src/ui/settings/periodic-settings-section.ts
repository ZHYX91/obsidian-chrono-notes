import { Setting } from "obsidian";

import {
  PERIODIC_NOTE_TYPES,
  type PeriodicNoteType,
} from "../../core/periodic/periodic-date";
import { getCurrentLocalDate } from "../../shared/local-date-clock";
import { isTemplateEngine } from "../../shared/settings";
import {
  createPeriodicNotePathPreview,
  getPeriodicNotePathExample,
  getPeriodicNoteTemplatePathExample,
} from "./periodic-note-settings-presentation";
import { periodicNoteLabel } from "./settings-presentation";
import type { SettingsSectionContext } from "./settings-section-context";
import { preparePathInput } from "./path-input";
import {
  MarkdownFileSuggest,
  PeriodicNoteFolderSuggest,
} from "./vault-path-suggest";

export function renderPeriodicSettingsSection(
  containerEl: HTMLElement,
  context: SettingsSectionContext,
): void {
  const { t } = context.translator;
  containerEl.createEl("h3", { text: t("settings.periodic.behavior") });
  new Setting(containerEl)
    .setName(t("settings.periodic.confirmBeforeCreating"))
    .setDesc(t("settings.periodic.confirmBeforeCreatingDesc"))
    .addToggle((toggle) => {
      toggle
        .setValue(context.host.settings.confirmPeriodicNoteCreation)
        .onChange(async (value) => {
          context.host.settings.confirmPeriodicNoteCreation = value;
          await context.persistSettings();
        });
    });
  new Setting(containerEl)
    .setName(t("settings.periodic.createLarger"))
    .setDesc(t("settings.periodic.createLargerDesc"))
    .addToggle((toggle) => {
      toggle.setValue(context.host.settings.cascadeLargerNotes).onChange(async (value) => {
        context.host.settings.cascadeLargerNotes = value;
        await context.persistSettings();
      });
    });
  new Setting(containerEl)
    .setName(t("settings.periodic.templateEngine"))
    .setDesc(t("settings.periodic.templateEngineDesc"))
    .addDropdown((dropdown) => {
      dropdown
        .addOption("builtin", t("settings.periodic.builtinEngine"))
        .addOption("templater", t("settings.periodic.templaterEngine"))
        .setValue(context.host.settings.templateEngine)
        .onChange(async (value) => {
          if (!isTemplateEngine(value)) return;
          context.host.settings.templateEngine = value;
          await context.persistSettings();
        });
    });

  containerEl.createEl("h3", { text: t("settings.periodic.paths") });
  const pathGuideEl = containerEl.createDiv({ cls: "chrono-notes-settings-guide" });
  pathGuideEl.createEl("p", { text: t("settings.periodic.pathsDesc") });
  const syntaxComparisonEl = pathGuideEl.createDiv({
    cls: "chrono-notes-settings-syntax-comparison",
  });
  syntaxComparisonEl.createSpan({ text: `${t("settings.periodic.obsidianSyntax")}: ` });
  syntaxComparisonEl.createEl("code", { text: "YYYY-MM-DD" });
  syntaxComparisonEl.createSpan({ text: " → " });
  syntaxComparisonEl.createSpan({ text: `${t("settings.periodic.chronoSyntax")}: ` });
  syntaxComparisonEl.createEl("code", { text: "yyyy-MM-dd" });

  for (const noteType of PERIODIC_NOTE_TYPES) {
    renderPeriodicNoteType(containerEl, noteType, context);
  }
}

function renderPeriodicNoteType(
  containerEl: HTMLElement,
  noteType: PeriodicNoteType,
  context: SettingsSectionContext,
): void {
  const { t } = context.translator;
  const config = context.host.settings.periodicNotes[noteType];
  const headerSetting = new Setting(containerEl)
    .setName(periodicNoteLabel(noteType, t));
  headerSetting.settingEl.addClass("chrono-notes-periodic-section-heading");
  headerSetting.addToggle((toggle) => {
    toggle.setValue(config.enabled).onChange(async (value) => {
      config.enabled = value;
      await context.persistSettings();
      context.display();
    });
  });
  if (!config.enabled) return;

  const previewDate = getCurrentLocalDate();
  const pathExample = getPeriodicNotePathExample(noteType);
  const pathSetting = new Setting(containerEl)
    .setName(t("settings.periodic.pathPattern"));
  pathSetting.settingEl.addClass("chrono-notes-periodic-path-setting");
  const pathExampleId = `chrono-notes-${noteType}-path-example`;
  const pathFeedbackId = `chrono-notes-${noteType}-path-feedback`;
  const pathExampleEl = pathSetting.descEl.createDiv({
    cls: "chrono-notes-periodic-path-example",
    attr: { id: pathExampleId },
  });
  pathExampleEl.append(`${t("settings.periodic.pathExample")}: `);
  pathExampleEl.createEl("code", { text: pathExample });
  let pathInputEl: HTMLInputElement | null = null;
  let pathFeedbackEl: HTMLDivElement | null = null;
  const updatePathDescription = (): void => {
    const preview = createPeriodicNotePathPreview(previewDate, noteType, config.pattern, {
      locale: context.translator.locale,
      weekStartDay: context.host.settings.weekStartDay,
    });
    const hasError = preview.status !== "valid";
    pathFeedbackEl?.empty();
    pathFeedbackEl?.classList.toggle("is-error", hasError);
    if (preview.status === "valid") {
      pathFeedbackEl?.createSpan({
        cls: "chrono-notes-periodic-path-feedback-label",
        text: `${t("settings.periodic.pathPreviewLabel")} `,
      });
      pathFeedbackEl?.createEl("code", {
        cls: "chrono-notes-periodic-path-feedback-value",
        text: preview.path,
      });
    } else {
      pathFeedbackEl?.setText(t(preview.status === "empty"
        ? "settings.periodic.pathPatternEmpty"
        : preview.reason === "moment-tokens"
          ? "settings.periodic.pathPatternMomentTokens"
          : "settings.periodic.pathPatternInvalid"));
    }
    pathInputEl?.setAttribute("aria-invalid", String(hasError));
  };
  pathSetting.addText((text) => {
    pathInputEl = text.inputEl;
    text
      .setPlaceholder(pathExample)
      .setValue(config.pattern)
      .onChange((value) => {
        config.pattern = value;
        updatePathDescription();
        context.scheduleSettingsSave();
      });
    text.inputEl.setAttribute("aria-describedby", `${pathExampleId} ${pathFeedbackId}`);
    text.inputEl.setAttribute("aria-required", "true");
    preparePathInput(text.inputEl);
    context.flushSettingsSaveOnBlur(text.inputEl);
    new PeriodicNoteFolderSuggest(
      context.app,
      text.inputEl,
      noteType,
      context.vaultPathSuggestionCatalog,
    );
  });
  pathFeedbackEl = pathSetting.controlEl.createDiv({
    cls: "chrono-notes-periodic-path-feedback",
    attr: {
      id: pathFeedbackId,
      "aria-live": "polite",
    },
  });
  updatePathDescription();
  const templateSetting = new Setting(containerEl)
    .setName(t("settings.periodic.templatePath"))
    .setDesc(t("settings.periodic.templatePathDesc"));
  templateSetting.settingEl.addClass("chrono-notes-periodic-template-setting");
  const templateExample = getPeriodicNoteTemplatePathExample(noteType);
  const templateExampleEl = templateSetting.descEl.createDiv({
    cls: "chrono-notes-periodic-template-example",
  });
  templateExampleEl.append(`${t("settings.periodic.pathExample")}: `);
  templateExampleEl.createEl("code", { text: templateExample });
  templateSetting.addText((text) => {
    text
      .setPlaceholder(templateExample)
      .setValue(config.templatePath)
      .onChange((value) => {
        config.templatePath = value;
        context.scheduleSettingsSave();
      });
    preparePathInput(text.inputEl);
    context.flushSettingsSaveOnBlur(text.inputEl);
    new MarkdownFileSuggest(
      context.app,
      text.inputEl,
      context.vaultPathSuggestionCatalog,
    );
  });
}
