import type { PeriodicNoteType } from "../../core/periodic/periodic-date";
import type {
  IcsEventIndexSnapshot,
  IcsSourceStatus,
} from "../../features/calendar/ics-event-index";
import type { NoteIndexStatus } from "../../features/notes/note-index";
import type { NoteIndexCacheStorageStatus } from "../../features/notes/note-index-cache";
import type { Translator } from "../../shared/i18n";
import type { SettingsTabId } from "./settings-tab-navigation";

export interface SettingsTabLabel {
  readonly id: SettingsTabId;
  readonly label: string;
}

export function getSettingsTabLabels(t: Translator["t"]): readonly SettingsTabLabel[] {
  return Object.freeze([
    Object.freeze({ id: "general", label: t("settings.tab.general") }),
    Object.freeze({ id: "appearance", label: t("settings.tab.appearance") }),
    Object.freeze({ id: "periodic", label: t("settings.tab.periodic") }),
    Object.freeze({ id: "ranges", label: t("settings.tab.ranges") }),
    Object.freeze({
      id: "extensions-and-integrations",
      label: t("settings.tab.extensionsAndIntegrations"),
    }),
  ]);
}

export function formatIcsStatus(
  snapshot: IcsEventIndexSnapshot | null,
  t: Translator["t"],
): string {
  if (snapshot === null || !snapshot.enabled) return t("settings.ics.status.disabled");
  if (snapshot.state === "refreshing") return t("settings.ics.status.refreshing");
  if (snapshot.totalSources === 0) return t("settings.ics.status.noSources");
  return t("settings.ics.status.summary", {
    loaded: snapshot.loadedSources,
    total: snapshot.totalSources,
    events: snapshot.eventCount,
    recurring: snapshot.skippedRecurring,
    invalid: snapshot.skippedInvalid,
    errors: snapshot.errors.length,
  });
}

export function formatIcsSourceStatus(
  status: IcsSourceStatus,
  t: Translator["t"],
): string {
  if (status.error !== null) {
    return t("settings.ics.sourceError", {
      source: status.sourceLabel,
      error: status.error,
    });
  }
  return t("settings.ics.sourceSuccess", {
    source: status.sourceLabel,
    events: status.eventCount,
    recurring: status.skippedRecurring,
    invalid: status.skippedInvalid,
  });
}

export function formatNoteIndexStatus(
  status: (NoteIndexStatus & Readonly<{ rebuildingCache: boolean }>) | null,
  t: Translator["t"],
): string {
  if (status === null || (!status.active && !status.rebuildingCache)) {
    return t("settings.index.status.unavailable");
  }
  const parameters = {
    notes: status.noteCount,
    errors: status.errorCount,
  };
  if (status.rebuildingCache) {
    return t("settings.index.status.rebuilding", parameters);
  }
  if (status.readiness === "indexing") {
    return t("settings.index.status.indexing", parameters);
  }
  if (status.backgroundVerificationActive) {
    return t("settings.index.status.verifying", parameters);
  }
  return t("settings.index.status.ready", parameters);
}

export function formatNoteIndexCacheStatus(
  status: NoteIndexCacheStorageStatus,
  t: Translator["t"],
): string {
  switch (status.state) {
    case "stored":
      return t("settings.index.cacheStored", { entries: status.entryCount });
    case "empty":
      return t("settings.index.cacheEmpty");
    case "invalid":
      return t("settings.index.cacheInvalid");
    case "error":
      return t("settings.index.cacheError");
    case "unavailable":
      return t("settings.index.cacheUnavailable");
  }
}

export function periodicNoteLabel(
  noteType: PeriodicNoteType,
  t: Translator["t"],
): string {
  switch (noteType) {
    case "daily":
      return t("settings.periodic.daily");
    case "weekly":
      return t("settings.periodic.weekly");
    case "monthly":
      return t("settings.periodic.monthly");
    case "quarterly":
      return t("settings.periodic.quarterly");
    case "yearly":
      return t("settings.periodic.yearly");
  }
}
