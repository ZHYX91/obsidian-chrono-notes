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
const generalSectionSource = readFileSync(
  new URL("../../src/ui/settings/general-settings-section.ts", import.meta.url),
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
const templateSectionSource = readFileSync(
  new URL("../../src/ui/settings/template-settings.ts", import.meta.url),
  "utf8",
);
const settingsGuideSource = readFileSync(
  new URL("../../src/ui/settings/settings-guide.ts", import.meta.url),
  "utf8",
);
const extensionsAndIntegrationsSectionSource = readFileSync(
  new URL("../../src/ui/settings/extensions-and-integrations-settings-section.ts", import.meta.url),
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
    expect(periodicSectionSource).toMatch(/if \(!config\.enabled\) return null;/);
  });

  it("uses native keyboard suggestions for folders and Markdown templates", () => {
    expect(periodicSectionSource).toContain("new PeriodicNoteFolderSuggest");
    expect(templateSectionSource).toContain("new MarkdownFileSuggest");
    expect(rangeSectionSource.match(/new VaultFolderSuggest/g)).toHaveLength(2);
    expect(suggestSource).toContain("extends AbstractInputSuggest<TFolder>");
    expect(suggestSource).toContain("extends AbstractInputSuggest<TFile>");
    expect(suggestSource).toContain("getMarkdownFiles()");
  });

  it("groups each periodic type under its own level-three heading", () => {
    expect(periodicSectionSource).toContain('containerEl.createEl("section"');
    expect(periodicSectionSource).toContain('"chrono-notes-periodic-note-section"');
    expect(periodicSectionSource).toContain('attr: { "aria-labelledby": headingId }');
    expect(periodicSectionSource).toContain('sectionEl.createEl("h3"');
    expect(periodicSectionSource).toContain("text: periodicNoteLabel(noteType, t)");
    expect(periodicSectionSource).toContain('.setName(t("settings.periodic.enabled"))');
    expect(periodicSectionSource).not.toContain('createEl("h4"');
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
    expect(periodicSectionSource.match(/preparePathInput\(text\.inputEl\)/g)).toHaveLength(1);
    expect(templateSectionSource.match(/preparePathInput\(text\.inputEl\)/g)).toHaveLength(1);
    expect(rangeSectionSource.match(/preparePathInput\(text\.inputEl\)/g)).toHaveLength(2);
    expect(
      extensionsAndIntegrationsSectionSource.match(/preparePathInput\(text\.inputEl\)/g),
    ).toHaveLength(1);
    expect(pathInputSource).toContain('setAttribute("autocapitalize", "off")');
    expect(pathInputSource).toContain('setAttribute("autocomplete", "off")');
    expect(pathInputSource).toContain("inputEl.spellcheck = false");
  });

  it("keeps template paths with their note types and global syntax under General", () => {
    expect(generalSectionSource).toContain("renderTemplateEngineSettings(containerEl, context)");
    expect(periodicSectionSource).toContain("getPeriodicNoteTemplatePathExample(noteType)");
    expect(periodicSectionSource).toContain("config.templatePath");
    expect(rangeSectionSource).toContain("settings.templatePath");
    expect(templateSectionSource).toContain("{{date:FORMAT}}");
    expect(templateSectionSource).toContain("{{start:FORMAT}}");
    expect(templateSectionSource).toContain("GGGG, GG, W, WW, Q, H, HH");
    expect(templateSectionSource).toContain("tp_calendar.targetDate");
    expect(templateSectionSource).toContain("tp_calendar.date()");
    expect(templateSectionSource).toContain("tp_calendar.startDate");
    expect(templateSectionSource).toContain("tp_calendar.endDate");
    expect(templateSectionSource).not.toContain("PERIODIC_NOTE_TYPES");
    expect(settingsTabSource).not.toContain('case "templates"');
  });

  it("uses one accessible settings-guide structure for path and template help", () => {
    expect(periodicSectionSource).toContain("createSettingsGuide");
    expect(templateSectionSource).toContain("createSettingsGuide");
    expect(settingsGuideSource).toContain('attr: { role: "note" }');
    expect(settingsGuideSource).toContain('setIcon(iconEl, "info")');
    expect(settingsGuideSource).toContain("chrono-notes-settings-guide-heading");
    expect(settingsGuideSource).toContain("chrono-notes-settings-guide-body");
  });

  it("groups independent Obsidian Properties integrations under General", () => {
    const heading = generalSectionSource.indexOf(
      't("settings.general.obsidianProperties")',
    );
    const displayFormat = generalSectionSource.indexOf(
      'setName(t("settings.general.propertyDateDisplayFormat"))',
    );
    const timeFormat = generalSectionSource.indexOf(
      'setName(t("settings.general.propertyTimeDisplayFormat"))',
    );
    const openDate = generalSectionSource.indexOf(
      'setName(t("settings.general.interceptPropertyDateClicks"))',
    );
    const guide = generalSectionSource.indexOf(
      'setName(t("settings.general.firstUseGuide"))',
    );
    expect(heading).toBeGreaterThan(-1);
    expect(guide).toBeLessThan(heading);
    expect(heading).toBeLessThan(displayFormat);
    expect(displayFormat).toBeLessThan(timeFormat);
    expect(timeFormat).toBeLessThan(openDate);
    for (const value of [
      "system",
      "ymd-dash",
      "ymd-slash",
      "ymd-slash-padded",
      "dmy-slash",
      "mdy-slash",
      "custom",
      "24-hour",
      "24-hour-seconds",
      "12-hour",
      "12-hour-seconds",
    ]) {
      expect(generalSectionSource).toMatch(new RegExp(
        `\\.addOption\\(\\s*"${value}"`,
      ));
    }
    expect(generalSectionSource).toContain("isValidPropertyDateFormat");
    expect(generalSectionSource).toContain("isValidPropertyTimeFormat");
    expect(generalSectionSource).toContain("PROPERTY_FORMAT_PREVIEW_VALUE");
    expect(generalSectionSource).toContain(
      'setting.settingEl.addClass("chrono-notes-property-custom-format-setting")',
    );
    expect(
      generalSectionSource.match(
        /settingEl\.addClass\("chrono-notes-property-format-settings"\)/g,
      ),
    ).toHaveLength(2);
  });

  it("does not repeat active tab labels as panel headings", () => {
    expect(generalSectionSource).not.toContain('t("settings.general.title")');
    expect(rangeSectionSource).not.toContain('t("settings.ranges.title")');
  });

  it("debounces text persistence while serializing at the shared persistence boundary", () => {
    const textSettingsSource = [
      appearanceSectionSource,
      generalSectionSource,
      periodicSectionSource,
      rangeSectionSource,
      templateSectionSource,
      extensionsAndIntegrationsSectionSource,
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
    const wideInputSettingsSource =
      `${rangeSectionSource}\n${extensionsAndIntegrationsSectionSource}`;
    expect(wideInputSettingsSource.match(/chrono-notes-wide-input-setting/g)).toHaveLength(3);
    expect(rangeSectionSource.indexOf('setName(t("settings.ranges.list"))'))
      .toBeLessThan(rangeSectionSource.indexOf('setName(t("settings.ranges.confirmBeforeCreating"))'));
  });

  it("keeps the setting tab focused on navigation and section orchestration", () => {
    expect(settingsTabSource).toContain("renderGeneralSettingsSection(panelEl, sectionContext)");
    expect(settingsTabSource).toContain("renderAppearanceSettingsSection(panelEl, sectionContext)");
    expect(settingsTabSource).toContain("renderPeriodicSettingsSection(panelEl, sectionContext)");
    expect(settingsTabSource).toContain("renderRangeSettingsSection(panelEl, sectionContext)");
    expect(settingsTabSource).toContain("renderExtensionsAndIntegrationsSettingsSection(panelEl, sectionContext)");
    expect(settingsTabSource).not.toContain("renderTemplateSettingsSection");
    expect(settingsTabSource).not.toContain("new Setting(");
  });

  it("keeps extensions out of appearance and orders built-in before external data", () => {
    expect(appearanceSectionSource).not.toContain("addCalendarExtensionSlot");
    expect(appearanceSectionSource).not.toContain("addHolidayRegionSlot");
    expect(extensionsAndIntegrationsSectionSource.indexOf(
      't("settings.extensions.calendarExtensions")',
    )).toBeLessThan(extensionsAndIntegrationsSectionSource.indexOf(
      't("settings.extensions.holidayExtensions")',
    ));
    expect(extensionsAndIntegrationsSectionSource.indexOf(
      't("settings.extensions.holidayExtensions")',
    )).toBeLessThan(extensionsAndIntegrationsSectionSource.indexOf(
      't("settings.ics.title")',
    ));
  });

  it("isolates post-save consumers behind the shared listener boundary", () => {
    expect(pluginSource).toContain("notifyListeners(viewRefreshListeners)");
    expect(pluginSource).toContain("notifyListeners(this.settingsListeners)");
    expect(pluginSource).toContain("notifyListeners([() => this.runtime?.noteNavbar.update()])");
  });
});
