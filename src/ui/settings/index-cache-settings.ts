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
  setting.settingEl.classList.add("chrono-notes-index-status-setting");
  const details = setting.settingEl.createEl("details", {
    cls: "chrono-notes-index-details",
  });
  details.createEl("summary", { text: t("settings.index.details.title") });
  const metrics = details.createEl("dl", { cls: "chrono-notes-index-metrics" });
  const values = {
    notes: appendMetric(metrics, t("settings.index.details.notes")),
    errors: appendMetric(metrics, t("settings.index.details.errors")),
    pending: appendMetric(metrics, t("settings.index.details.pending")),
    fullIndex: appendMetric(metrics, t("settings.index.details.fullIndex")),
    incremental: appendMetric(metrics, t("settings.index.details.incremental")),
  };
  const render = (): void => {
    const status = context.host.getNoteIndexStatus();
    const diagnostics = context.host.getNoteIndexDiagnostics();
    setting.setDesc(formatNoteIndexStatus(status, t));
    values.notes.textContent = formatInteger(status?.noteCount ?? 0, context.translator.locale);
    values.errors.textContent = formatInteger(status?.errorCount ?? 0, context.translator.locale);
    values.pending.textContent = formatInteger(
      diagnostics?.pendingUpdateCount ?? 0,
      context.translator.locale,
    );
    values.fullIndex.textContent = formatOperation(
      diagnostics?.lastFullIndex ?? null,
      context,
    );
    values.incremental.textContent = formatOperation(
      diagnostics?.lastIncrementalUpdate ?? null,
      context,
    );
  };
  setting.setName(t("settings.index.noteIndex"));
  render();
  return combineSettingsCleanups([
    context.host.subscribeNoteIndex(render),
    context.host.subscribeNoteIndexDiagnostics(render),
  ]);
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
      buttonDisabled = context.host.isSettingsReadOnly()
        || rebuilding
        || status === null
        || !status.active
        || !status.cacheConfigured;
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

function appendMetric(container: HTMLDListElement, label: string): HTMLElement {
  const row = container.createDiv();
  row.createEl("dt", { text: label });
  return row.createEl("dd");
}

function formatOperation(
  operation: {
    readonly completedAt: number;
    readonly durationMs: number;
    readonly affectedPathCount: number;
  } | null,
  context: SettingsSectionContext,
): string {
  if (operation === null) return context.translator.t("settings.index.details.never");
  return context.translator.t("settings.index.details.operationValue", {
    time: new Intl.DateTimeFormat(context.translator.locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(operation.completedAt),
    paths: formatInteger(operation.affectedPathCount, context.translator.locale),
    duration: formatDuration(operation.durationMs, context.translator.locale),
  });
}

function formatInteger(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

function formatDuration(value: number, locale: string): string {
  if (value < 1_000) return `${formatInteger(Math.round(value), locale)} ms`;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value / 1_000)} s`;
}
