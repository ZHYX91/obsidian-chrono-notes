import type { PeriodicNoteType } from "../core/periodic/periodic-date";
import type { IcsEventIndexSnapshot } from "../features/calendar/ics-event-index";
import type { TaskCommandResult } from "../features/tasks/task-commands";
import type { Translator } from "../shared/i18n";

export interface PluginCommandMessages {
  readonly ribbonCalendar: string;
  readonly openCalendar: string;
  readonly openRangeList: string;
  readonly openMiniCalendar: string;
  readonly jumpToDate: string;
  readonly openPeriodic: (noteType: PeriodicNoteType) => string;
}

export function getPluginCommandMessages(t: Translator["t"]): PluginCommandMessages {
  return Object.freeze({
    ribbonCalendar: t("pluginCommand.ribbonCalendar"),
    openCalendar: t("pluginCommand.openCalendar"),
    openRangeList: t("pluginCommand.openRangeList"),
    openMiniCalendar: t("pluginCommand.openMiniCalendar"),
    jumpToDate: t("pluginCommand.jumpToDate"),
    openPeriodic: (noteType: PeriodicNoteType) => t("pluginCommand.openPeriodic", {
      period: formatPeriodicType(noteType, t),
    }),
  });
}

export function formatPeriodicNotConfiguredNotice(
  noteType: PeriodicNoteType,
  t: Translator["t"],
): string {
  return t("pluginNotice.periodicNotConfigured", {
    period: formatPeriodicType(noteType, t),
  });
}

export function getRangeNotConfiguredNotice(t: Translator["t"]): string {
  return t("pluginNotice.rangeNotConfigured");
}

export function getInvalidRangeNotice(t: Translator["t"]): string {
  return t("pluginNotice.invalidRange");
}

export function formatPluginErrorNotice(
  message: string,
  t: Translator["t"],
): string {
  return t("pluginNotice.error", { message });
}

export function getTaskCommandNotice(
  status: TaskCommandResult["status"],
  t: Translator["t"],
): string | null {
  switch (status) {
    case "no-due":
      return t("pluginNotice.taskNoDue");
    case "invalid-date":
      return t("pluginNotice.taskInvalidDate");
    case "line-missing":
    case "stale":
      return t("pluginNotice.taskStale");
    default:
      return null;
  }
}

export function formatIcsRefreshNotice(
  snapshot: IcsEventIndexSnapshot,
  t: Translator["t"],
): string {
  if (!snapshot.enabled) return t("pluginNotice.icsDisabled");
  if (snapshot.totalSources === 0) return t("pluginNotice.icsNoSources");
  if (snapshot.errors.length > 0) {
    return t("pluginNotice.icsPartial", {
      ratio: t("pluginNotice.sourceRatio", {
        loaded: snapshot.loadedSources,
        total: snapshot.totalSources,
      }),
      events: t("pluginNotice.events", { count: snapshot.eventCount }),
      errors: t("pluginNotice.errors", { count: snapshot.errors.length }),
    });
  }
  const base = t("pluginNotice.icsRefreshed", {
    sources: t("pluginNotice.sources", { count: snapshot.loadedSources }),
    events: t("pluginNotice.events", { count: snapshot.eventCount }),
  });
  const skipped = [
    ...(snapshot.skippedRecurring === 0
      ? []
      : [t("pluginNotice.skippedRecurring", { count: snapshot.skippedRecurring })]),
    ...(snapshot.skippedInvalid === 0
      ? []
      : [t("pluginNotice.skippedInvalid", { count: snapshot.skippedInvalid })]),
  ];
  return skipped.length === 0 ? base : `${base} ${skipped.join(" ")}`;
}

function formatPeriodicType(
  noteType: PeriodicNoteType,
  t: Translator["t"],
): string {
  return t(`pluginCommand.period.${noteType}`);
}
