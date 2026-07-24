import { Setting } from "obsidian";

import {
  CALENDAR_OVERLAY_DEFINITIONS,
  isCalendarOverlaySupported,
  updateCalendarOverlaySlot,
} from "../../features/calendar/calendar-overlay-registry";
import {
  HOLIDAY_REGION_DEFINITIONS,
  updateHolidayRegionSlot,
} from "../../features/calendar/holiday-region-registry";
import {
  isCalendarOverlay,
  isHolidayRegion,
  type CalendarOverlay,
  type HolidayRegion,
} from "../../shared/settings";
import {
  formatIcsSourceStatus,
  formatIcsStatus,
} from "./settings-presentation";
import { preparePathInput } from "./path-input";
import type { SettingsSectionContext } from "./settings-section-context";

export function renderExtensionsAndIntegrationsSettingsSection(
  containerEl: HTMLElement,
  context: SettingsSectionContext,
): void {
  const { t } = context.translator;

  containerEl.createEl("h3", {
    text: t("settings.extensions.calendarExtensions"),
  });
  containerEl.createEl("p", {
    cls: "setting-item-description",
    text: t("settings.extensions.calendarExtensionsDesc"),
  });
  addCalendarOverlaySlot(containerEl, 0, context);
  addCalendarOverlaySlot(containerEl, 1, context);

  containerEl.createEl("h3", {
    text: t("settings.extensions.holidayExtensions"),
  });
  containerEl.createEl("p", {
    cls: "setting-item-description",
    text: t("settings.extensions.holidayExtensionsDesc"),
  });
  addHolidayRegionSlot(containerEl, 0, context);
  addHolidayRegionSlot(containerEl, 1, context);
  addHolidayRegionSlot(containerEl, 2, context);

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

function addCalendarOverlaySlot(
  containerEl: HTMLElement,
  slot: 0 | 1,
  context: SettingsSectionContext,
): void {
  const { t } = context.translator;
  const selected = context.host.settings.calendarOverlays;
  const current = selected[slot] ?? null;
  const usedByOtherSlot = selected[slot === 0 ? 1 : 0] ?? null;
  const definition = current === null
    ? null
    : CALENDAR_OVERLAY_DEFINITIONS.find(({ id }) => id === current) ?? null;
  const currentSupported = current === null ||
    isCalendarOverlaySupported(current, context.translator.locale);

  const setting = new Setting(containerEl)
    .setName(t(slot === 0
      ? "settings.extensions.calendarExtensionFirst"
      : "settings.extensions.calendarExtensionSecond"));
  if (definition !== null) {
    setting.setDesc(currentSupported
      ? t(definition.descriptionKey)
      : t("settings.extensions.calendarExtensionUnavailable", {
        calendar: t(definition.labelKey),
      }));
  }
  setting.addDropdown((dropdown) => {
    dropdown.addOption("", t("settings.extensions.calendarExtensionNone"));
    for (const overlay of CALENDAR_OVERLAY_DEFINITIONS) {
      if (
        overlay.id !== usedByOtherSlot &&
        (overlay.id === current ||
          isCalendarOverlaySupported(overlay.id, context.translator.locale))
      ) {
        dropdown.addOption(overlay.id, t(overlay.labelKey));
      }
    }
    dropdown.setValue(current ?? "").onChange(async (value) => {
      const next: CalendarOverlay | null = value.length === 0
        ? null
        : isCalendarOverlay(value) ? value : null;
      context.host.settings.calendarOverlays = [
        ...updateCalendarOverlaySlot(context.host.settings.calendarOverlays, slot, next),
      ];
      await context.persistSettings();
      context.display();
    });
  });
}

function addHolidayRegionSlot(
  containerEl: HTMLElement,
  slot: 0 | 1 | 2,
  context: SettingsSectionContext,
): void {
  const { t } = context.translator;
  const selected = context.host.settings.holidayRegions;
  const current = selected[slot] ?? null;
  const usedByOtherSlots = new Set(selected.filter((_, index) => index !== slot));
  const slotKeys = [
    "settings.extensions.holidayRegionSlot1",
    "settings.extensions.holidayRegionSlot2",
    "settings.extensions.holidayRegionSlot3",
  ] as const;

  new Setting(containerEl).setName(t(slotKeys[slot])).addDropdown((dropdown) => {
    dropdown.addOption("", t("settings.extensions.holidayRegionNone"));
    for (const definition of HOLIDAY_REGION_DEFINITIONS) {
      if (!usedByOtherSlots.has(definition.id)) {
        dropdown.addOption(definition.id, t(definition.labelKey));
      }
    }
    dropdown.setValue(current ?? "").onChange(async (value) => {
      const next: HolidayRegion | null = value.length === 0
        ? null
        : isHolidayRegion(value) ? value : null;
      context.host.settings.holidayRegions = [
        ...updateHolidayRegionSlot(context.host.settings.holidayRegions, slot, next),
      ];
      await context.persistSettings();
      context.display();
    });
  });
}

function normalizeSourceInput(value: string): string[] {
  return Array.from(new Set(value
    .split(/\r\n|\r|\n/)
    .map((source) => source.trim())
    .filter((source) => source.length > 0)));
}
