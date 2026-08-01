import { Setting } from "obsidian";

import {
  combineSettingsCleanups,
  type SettingsCleanup,
} from "./settings-cleanup";
import {
  formatNoteIndexCacheStatus,
  formatNoteIndexStatus,
} from "./settings-presentation";
import type { SettingsSectionContext } from "./settings-section-context";

export function renderIndexCacheSettingsSection(
  containerEl: HTMLElement,
  context: SettingsSectionContext,
): SettingsCleanup {
  containerEl.createEl("h3", { text: context.translator.t("settings.index.title") });
  return combineSettingsCleanups([
    configureNoteIndexStatusSetting(new Setting(containerEl), context),
    configureNoteIndexCacheSetting(new Setting(containerEl), context),
  ]);
}

export function configureNoteIndexStatusSetting(
  setting: Setting,
  context: SettingsSectionContext,
): SettingsCleanup {
  const { t } = context.translator;
  const render = (): void => {
    setting.setDesc(formatNoteIndexStatus(context.host.getNoteIndexStatus(), t));
  };
  setting.setName(t("settings.index.noteIndex"));
  render();
  return context.host.subscribeNoteIndex(render);
}

export function configureNoteIndexCacheSetting(
  setting: Setting,
  context: SettingsSectionContext,
): SettingsCleanup {
  const { t } = context.translator;
  let disposed = false;
  let rebuilding = false;
  let buttonDisabled = true;
  const cleanups: SettingsCleanup[] = [];
  const setDescription = (text: string): void => {
    setting.setDesc(text);
    setting.descEl.createDiv({
      cls: "chrono-notes-settings-hint",
      text: t("settings.index.rebuildDesc"),
    });
  };
  setting.setName(t("settings.index.currentVaultCache"));
  setDescription(t("settings.index.cacheChecking"));
  setting.addButton((button) => {
    const refreshButton = (): void => {
      const status = context.host.getNoteIndexStatus();
      buttonDisabled = rebuilding || status === null || !status.active || !status.cacheConfigured;
      button
        .setButtonText(rebuilding
          ? t("settings.index.rebuildingAction")
          : t("settings.index.rebuildAction"))
        .setDisabled(buttonDisabled);
    };
    const unsubscribe = context.host.subscribeNoteIndex(refreshButton);
    button.onClick(async () => {
      if (buttonDisabled) return;
      rebuilding = true;
      setDescription(t("settings.index.cacheRebuilding"));
      refreshButton();
      try {
        await context.host.rebuildNoteIndexCache();
        if (disposed) return;
        const status = await context.host.getNoteIndexCacheStatus();
        if (!disposed) setDescription(formatNoteIndexCacheStatus(status, t));
      } catch {
        if (!disposed) setDescription(t("settings.index.rebuildFailed"));
      } finally {
        rebuilding = false;
        if (!disposed) refreshButton();
      }
    });
    refreshButton();
    cleanups.push(unsubscribe);
  });
  void context.host.getNoteIndexCacheStatus().then((status) => {
    if (!disposed && !rebuilding) {
      setDescription(formatNoteIndexCacheStatus(status, t));
    }
  }).catch(() => {
    if (!disposed && !rebuilding) setDescription(t("settings.index.cacheError"));
  });
  return () => {
    disposed = true;
    for (const cleanup of cleanups) cleanup();
  };
}
