import { Setting } from "obsidian";

import { isTemplateEngine } from "../../shared/settings";
import { preparePathInput } from "./path-input";
import type { SettingsSectionContext } from "./settings-section-context";
import { MarkdownFileSuggest } from "./vault-path-suggest";

export function renderTemplateEngineSettings(
  containerEl: HTMLElement,
  context: SettingsSectionContext,
): void {
  const { t } = context.translator;
  containerEl.createEl("h3", { text: t("settings.templates.settingsHeading") });
  new Setting(containerEl)
    .setName(t("settings.templates.engine"))
    .setDesc(t("settings.templates.engineDesc"))
    .addDropdown((dropdown) => {
      dropdown
        .addOption("builtin", t("settings.templates.builtinEngine"))
        .addOption("templater", t("settings.templates.templaterEngine"))
        .setValue(context.host.settings.templateEngine)
        .onChange(async (value) => {
          if (!isTemplateEngine(value)) return;
          context.host.settings.templateEngine = value;
          await context.persistSettings();
          context.display();
        });
    });
  renderTemplateEngineGuide(containerEl, context);
}

export function renderTemplateEngineGuide(
  containerEl: HTMLElement,
  context: SettingsSectionContext,
): void {
  const { t } = context.translator;
  const guideEl = containerEl.createDiv({ cls: "chrono-notes-settings-guide" });
  if (context.host.settings.templateEngine === "builtin") {
    guideEl.createEl("p", { text: t("settings.templates.builtinHelp") });
    guideEl.createEl("p").createEl("code", {
      text: "FORMAT: YYYY, YY, M, MM, MMM, MMMM, D, DD, ddd, dddd, "
        + "GGGG, GG, W, WW, Q, H, HH, m, mm, s, ss, A, a; [text]",
    });
    const periodicEl = guideEl.createEl("p");
    periodicEl.append(`${t("settings.templates.periodicHeading")}: `);
    periodicEl.createEl("code", {
      text: "{{title}}, {{date}}, {{date:FORMAT}}, {{time}}, {{time:FORMAT}}",
    });
    const intervalEl = guideEl.createEl("p");
    intervalEl.append(`${t("settings.templates.intervalHeading")}: `);
    intervalEl.createEl("code", {
      text: "{{title}}, {{start}}, {{start:FORMAT}}, {{end}}, "
        + "{{end:FORMAT}}, {{days}}, {{time}}, {{time:FORMAT}}",
    });
    return;
  }
  guideEl.createEl("p", { text: t("settings.templates.templaterHelp") });
  const periodicEl = guideEl.createEl("p");
  periodicEl.append(`${t("settings.templates.periodicHeading")}: `);
  periodicEl.createEl("code", {
    text: "tp_calendar.noteType, tp_calendar.title, tp_calendar.targetDate, "
      + "tp_calendar.date(), tp_calendar.time()",
  });
  const intervalEl = guideEl.createEl("p");
  intervalEl.append(`${t("settings.templates.intervalHeading")}: `);
  intervalEl.createEl("code", {
    text: "tp_calendar.title, tp_calendar.startDate, tp_calendar.endDate, "
      + "tp_calendar.dayCount, tp_calendar.start(), tp_calendar.end(), "
      + "tp_calendar.time()",
  });
}

export function renderTemplatePathSetting(
  containerEl: HTMLElement,
  name: string,
  example: string,
  value: string,
  onChange: (value: string) => void,
  context: SettingsSectionContext,
): void {
  configureTemplatePathSetting(
    new Setting(containerEl),
    name,
    example,
    value,
    onChange,
    context,
  );
}

export function configureTemplatePathSetting(
  setting: Setting,
  name: string,
  example: string,
  value: string,
  onChange: (value: string) => void,
  context: SettingsSectionContext,
): () => void {
  const { t } = context.translator;
  setting.setName(name).setDesc(t("settings.templates.pathDesc"));
  setting.settingEl.addClass("chrono-notes-template-path-setting");
  const exampleEl = setting.descEl.createDiv({
    cls: "chrono-notes-template-path-example",
  });
  exampleEl.append(`${t("settings.templates.pathExample")}: `);
  exampleEl.createEl("code", { text: example });
  let suggest: MarkdownFileSuggest | null = null;
  setting.addText((text) => {
    text
      .setPlaceholder(example)
      .setValue(value)
      .onChange((next) => {
        onChange(next);
        context.scheduleSettingsSave();
      });
    preparePathInput(text.inputEl);
    context.flushSettingsSaveOnBlur(text.inputEl);
    suggest = new MarkdownFileSuggest(
      context.app,
      text.inputEl,
      context.vaultPathSuggestionCatalog,
    );
  });
  return () => suggest?.close();
}
