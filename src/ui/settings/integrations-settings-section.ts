import { Setting } from "obsidian";

import {
  formatIcsSourceStatus,
  formatIcsStatus,
} from "./settings-presentation";
import { preparePathInput } from "./path-input";
import type { SettingsSectionContext } from "./settings-section-context";

export function renderIntegrationsSettingsSection(
  containerEl: HTMLElement,
  context: SettingsSectionContext,
): void {
  const { t } = context.translator;
  const settings = context.host.settings.ics;
  const snapshot = context.host.getIcsSnapshot();
  containerEl.createEl("h3", { text: t("settings.ics.title") });
  new Setting(containerEl)
    .setName(t("settings.ics.showEvents"))
    .setDesc(t("settings.ics.showEventsDesc"))
    .addToggle((toggle) => {
      toggle.setValue(settings.enabled).onChange(async (enabled) => {
        settings.enabled = enabled;
        await context.persistSettings();
        context.display();
      });
    });
  const sourcesSetting = new Setting(containerEl)
    .setName(t("settings.ics.sources"))
    .setDesc(t("settings.ics.sourcesDesc"));
  sourcesSetting.settingEl.addClass("chrono-notes-wide-input-setting");
  sourcesSetting.addTextArea((text) => {
    text
      .setPlaceholder("Calendars/team.ics")
      .setValue(settings.sources.join("\n"))
      .onChange((value) => {
        settings.sources = normalizeSourceInput(value);
        context.scheduleSettingsSave();
      });
    text.inputEl.rows = 4;
    preparePathInput(text.inputEl);
    context.flushSettingsSaveOnBlur(text.inputEl);
  });
  new Setting(containerEl)
    .setName(t("settings.ics.refresh"))
    .setDesc(formatIcsStatus(snapshot, t))
    .addButton((button) => {
      button
        .setButtonText(snapshot?.state === "refreshing"
          ? t("settings.ics.refreshingButton")
          : t("settings.ics.refreshNow"))
        .setDisabled(snapshot?.state === "refreshing")
        .onClick(async () => {
          await context.host.refreshIcs(true);
          context.display();
        });
    });

  if (snapshot !== null && snapshot.sourceStatuses.length > 0) {
    const statusList = containerEl.createDiv({ cls: "chrono-notes-ics-status" });
    for (const status of snapshot.sourceStatuses) {
      statusList.createDiv({
        cls: status.error === null
          ? "chrono-notes-ics-source"
          : "chrono-notes-ics-source is-error",
        text: formatIcsSourceStatus(status, t),
      });
    }
  }
}

function normalizeSourceInput(value: string): string[] {
  return Array.from(new Set(value
    .split(/\r\n|\r|\n/)
    .map((source) => source.trim())
    .filter((source) => source.length > 0)));
}
