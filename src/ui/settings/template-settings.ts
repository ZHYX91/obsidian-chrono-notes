import { renderTemplateSyntaxGuide } from "./template-guide";
import { Setting } from "obsidian";

import { isTemplateEngine } from "../../shared/settings";
import { preparePathInput } from "./path-input";
import type { SettingsCleanup } from "./settings-cleanup";
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
  renderTemplateSyntaxGuide(containerEl, context);
}

export function renderTemplatePathSetting(
  containerEl: HTMLElement,
  name: string,
  example: string,
  value: string,
  onChange: (value: string) => void,
  context: SettingsSectionContext,
): SettingsCleanup {
  return configureTemplatePathSetting(
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
): SettingsCleanup {
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
