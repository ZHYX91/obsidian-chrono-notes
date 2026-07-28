import { Setting } from "obsidian";

import {
  PERIODIC_NOTE_TYPES,
  type PeriodicNoteType,
} from "../../core/periodic/periodic-date";
import { getCurrentLocalDate } from "../../shared/local-date-clock";
import {
  createPeriodicNotePathPreview,
  getPeriodicNotePathExample,
  getPeriodicNoteTemplatePathExample,
} from "./periodic-note-settings-presentation";
import { periodicNoteLabel } from "./settings-presentation";
import type { SettingsSectionContext } from "./settings-section-context";
import { preparePathInput } from "./path-input";
import { renderTemplatePathSetting } from "./template-settings";
import { PeriodicNoteFolderSuggest } from "./vault-path-suggest";

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
  containerEl.createEl("h3", { text: t("settings.periodic.paths") });
  const pathGuideEl = containerEl.createDiv({ cls: "chrono-notes-settings-guide" });
  pathGuideEl.createEl("p", { text: t("settings.periodic.pathsDesc") });

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
  const headingId = `chrono-notes-${noteType}-settings-heading`;
  const sectionEl = containerEl.createEl("section", {
    cls: "chrono-notes-periodic-note-section",
    attr: { "aria-labelledby": headingId },
  });
  sectionEl.createEl("h3", {
    text: periodicNoteLabel(noteType, t),
    attr: { id: headingId },
  });
  new Setting(sectionEl)
    .setName(t("settings.periodic.enabled"))
    .addToggle((toggle) => {
      toggle.setValue(config.enabled).onChange(async (value) => {
        config.enabled = value;
        await context.persistSettings();
        context.display();
      });
    });
  if (!config.enabled) return;

  const pathSetting = new Setting(sectionEl);
  configurePeriodicPathSetting(pathSetting, noteType, context);
  renderTemplatePathSetting(
    sectionEl,
    t("settings.templates.path"),
    getPeriodicNoteTemplatePathExample(noteType),
    config.templatePath,
    (value) => {
      config.templatePath = value;
    },
    context,
  );
}

export function configurePeriodicPathSetting(
  pathSetting: Setting,
  noteType: PeriodicNoteType,
  context: SettingsSectionContext,
): () => void {
  const { t } = context.translator;
  const config = context.host.settings.periodicNotes[noteType];
  const previewDate = getCurrentLocalDate();
  const pathExample = getPeriodicNotePathExample(noteType);
  pathSetting.setName(t("settings.periodic.pathPattern"));
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
        : "settings.periodic.pathPatternInvalid"));
    }
    pathInputEl?.setAttribute("aria-invalid", String(hasError));
  };
  let suggest: PeriodicNoteFolderSuggest | null = null;
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
    suggest = new PeriodicNoteFolderSuggest(
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
  return () => suggest?.close();
}
