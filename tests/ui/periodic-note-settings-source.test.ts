import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const settingsTabSource = readFileSync(
  new URL("../../src/ui/settings/settings-tab.ts", import.meta.url),
  "utf8",
);
const appearanceSectionSource = readFileSync(
  new URL("../../src/ui/settings/appearance-settings-section.ts", import.meta.url),
  "utf8",
);
const periodicSectionSource = readFileSync(
  new URL("../../src/ui/settings/periodic-settings-section.ts", import.meta.url),
  "utf8",
);
const rangeSectionSource = readFileSync(
  new URL("../../src/ui/settings/range-settings-section.ts", import.meta.url),
  "utf8",
);
const integrationsSectionSource = readFileSync(
  new URL("../../src/ui/settings/integrations-settings-section.ts", import.meta.url),
  "utf8",
);
const settingsSaveCoordinatorSource = readFileSync(
  new URL("../../src/ui/settings/settings-save-coordinator.ts", import.meta.url),
  "utf8",
);
const pathInputSource = readFileSync(
  new URL("../../src/ui/settings/path-input.ts", import.meta.url),
  "utf8",
);
const suggestSource = readFileSync(
  new URL("../../src/ui/settings/vault-path-suggest.ts", import.meta.url),
  "utf8",
);
const pluginSource = readFileSync(
  new URL("../../src/app/plugin.ts", import.meta.url),
  "utf8",
);

describe("periodic note settings structure", () => {
  it("collapses disabled note types before rendering dependent fields", () => {
    expect(periodicSectionSource).toMatch(/if \(!config\.enabled\) return;/);
  });

  it("uses native keyboard suggestions for folders and Markdown templates", () => {
    expect(periodicSectionSource).toContain("new PeriodicNoteFolderSuggest");
    expect(periodicSectionSource).toContain("new MarkdownFileSuggest");
    expect(rangeSectionSource.match(/new VaultFolderSuggest/g)).toHaveLength(2);
    expect(suggestSource).toContain("extends AbstractInputSuggest<TFolder>");
    expect(suggestSource).toContain("extends AbstractInputSuggest<TFile>");
    expect(suggestSource).toContain("getMarkdownFiles()");
  });

  it("combines each periodic heading with its enable toggle", () => {
    expect(periodicSectionSource).toContain("chrono-notes-periodic-section-heading");
    expect(periodicSectionSource).toContain(".setName(periodicNoteLabel(noteType, t))");
    expect(periodicSectionSource).not.toContain('containerEl.createEl("h4"');
    expect(periodicSectionSource).not.toContain('.setName(t("settings.periodic.enabled"))');
  });

  it("keeps path examples visible and exposes live validation accessibly", () => {
    expect(periodicSectionSource).toContain("getPeriodicNotePathExample(noteType)");
    expect(periodicSectionSource).toContain("chrono-notes-periodic-path-example");
    expect(periodicSectionSource).toContain("pathSetting.controlEl.createDiv");
    expect(periodicSectionSource).toContain("chrono-notes-periodic-path-feedback");
    expect(periodicSectionSource).toContain('"aria-live": "polite"');
    expect(periodicSectionSource).toContain("`${pathExampleId} ${pathFeedbackId}`");
    expect(periodicSectionSource).toContain('setAttribute("aria-invalid", String(hasError))');
    expect(periodicSectionSource).toContain('setAttribute("aria-required", "true")');
    expect(periodicSectionSource.match(/preparePathInput\(text\.inputEl\)/g)).toHaveLength(2);
    expect(rangeSectionSource.match(/preparePathInput\(text\.inputEl\)/g)).toHaveLength(2);
    expect(integrationsSectionSource.match(/preparePathInput\(text\.inputEl\)/g)).toHaveLength(1);
    expect(pathInputSource).toContain('setAttribute("autocapitalize", "off")');
    expect(pathInputSource).toContain('setAttribute("autocomplete", "off")');
    expect(pathInputSource).toContain("inputEl.spellcheck = false");
  });

  it("uses note-type-specific template placeholders", () => {
    expect(periodicSectionSource).toContain("getPeriodicNoteTemplatePathExample(noteType)");
    expect(periodicSectionSource).toContain("chrono-notes-periodic-template-setting");
    expect(periodicSectionSource).toContain("chrono-notes-periodic-template-example");
    expect(periodicSectionSource).not.toContain('.setPlaceholder("Templates/Daily.md")');
  });

  it("debounces text persistence while serializing at the shared persistence boundary", () => {
    const textSettingsSource = [
      appearanceSectionSource,
      periodicSectionSource,
      rangeSectionSource,
      integrationsSectionSource,
    ].join("\n");
    expect(settingsTabSource).toContain("TEXT_SAVE_DELAY_MS = 300");
    expect(textSettingsSource).toContain("context.scheduleSettingsSave()");
    expect(textSettingsSource).toContain("context.flushSettingsSaveOnBlur");
    expect(settingsTabSource).toContain("new SettingsSaveCoordinator");
    expect(settingsTabSource.match(/this\.host\.saveSettings\(\)/g)).toHaveLength(1);
    expect(settingsSaveCoordinatorSource).not.toContain("settingsSaveTail.then");
    expect(pluginSource).toContain("this.settingsSaveTail.then");
    expect(pluginSource).toContain("normalizeSettings(this.settings)");
  });

  it("uses full-width range and ICS inputs and keeps the range list action first", () => {
    const wideInputSettingsSource = `${rangeSectionSource}\n${integrationsSectionSource}`;
    expect(wideInputSettingsSource.match(/chrono-notes-wide-input-setting/g)).toHaveLength(3);
    expect(rangeSectionSource.indexOf('setName(t("settings.ranges.list"))'))
      .toBeLessThan(rangeSectionSource.indexOf('setName(t("settings.ranges.confirmBeforeCreating"))'));
  });

  it("keeps the setting tab focused on navigation and section orchestration", () => {
    expect(settingsTabSource).toContain("renderGeneralSettingsSection(panelEl, sectionContext)");
    expect(settingsTabSource).toContain("renderAppearanceSettingsSection(panelEl, sectionContext)");
    expect(settingsTabSource).toContain("renderPeriodicSettingsSection(panelEl, sectionContext)");
    expect(settingsTabSource).toContain("renderRangeSettingsSection(panelEl, sectionContext)");
    expect(settingsTabSource).toContain("renderIntegrationsSettingsSection(panelEl, sectionContext)");
    expect(settingsTabSource).not.toContain("new Setting(");
  });

  it("isolates post-save consumers behind the shared listener boundary", () => {
    expect(pluginSource).toContain("notifyListeners(viewRefreshListeners)");
    expect(pluginSource).toContain("notifyListeners(this.settingsListeners)");
    expect(pluginSource).toContain("notifyListeners([() => this.noteNavbar?.update()])");
  });
});
