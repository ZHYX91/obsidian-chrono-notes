import type {
  IntervalListSetup,
  IntervalListSetupIssue,
} from "../../features/intervals/interval-list-setup";
import type { Translator } from "../../shared/i18n";

export interface IntervalListMessages {
  readonly title: string;
  readonly searchPlaceholder: string;
  readonly searchAria: string;
  readonly scopeAria: string;
  readonly sortAria: string;
  readonly allDates: string;
  readonly currentMonth: string;
  readonly currentYear: string;
  readonly startAscending: string;
  readonly startDescending: string;
  readonly createRange: string;
  readonly creationNotConfigured: string;
  readonly scanNotConfigured: string;
  readonly scanFolderMissing: string;
  readonly creationOutsideScope: string;
  readonly openRangeSettings: string;
  readonly resetFilters: string;
  readonly emptyScope: string;
  readonly emptyFilters: string;
}

export interface IntervalListEmptyState {
  readonly kind: IntervalListSetupIssue
  | "empty-scope"
  | "empty-filters";
  readonly action: "create" | "settings" | "reset";
}

export function getIntervalListMessages(t: Translator["t"]): IntervalListMessages {
  return Object.freeze({
    title: t("intervalList.title"),
    searchPlaceholder: t("intervalList.searchPlaceholder"),
    searchAria: t("intervalList.searchAria"),
    scopeAria: t("intervalList.scopeAria"),
    sortAria: t("intervalList.sortAria"),
    allDates: t("intervalList.allDates"),
    currentMonth: t("intervalList.currentMonth"),
    currentYear: t("intervalList.currentYear"),
    startAscending: t("intervalList.startAscending"),
    startDescending: t("intervalList.startDescending"),
    createRange: t("intervalList.createRange"),
    creationNotConfigured: t("intervalList.creationNotConfigured"),
    scanNotConfigured: t("intervalList.scanNotConfigured"),
    scanFolderMissing: t("intervalList.scanFolderMissing"),
    creationOutsideScope: t("intervalList.creationOutsideScope"),
    openRangeSettings: t("intervalList.openRangeSettings"),
    resetFilters: t("intervalList.resetFilters"),
    emptyScope: t("intervalList.emptyScope"),
    emptyFilters: t("intervalList.emptyFilters"),
  });
}

export function formatIntervalListCount(count: number, t: Translator["t"]): string {
  return t("intervalList.count", { count });
}

export function formatIntervalListDuration(count: number, t: Translator["t"]): string {
  return t("intervalList.duration", { count });
}

export function getIntervalListEmptyState(
  allItemCount: number,
  visibleItemCount: number,
  setup: IntervalListSetup,
): IntervalListEmptyState | null {
  if (visibleItemCount > 0) return null;
  if (allItemCount > 0) {
    return Object.freeze({ kind: "empty-filters", action: "reset" });
  }
  if (setup.issue !== null) {
    return Object.freeze({
      kind: setup.issue,
      action: setup.canCreateVisibleItem ? "create" : "settings",
    });
  }
  return Object.freeze({ kind: "empty-scope", action: "create" });
}
