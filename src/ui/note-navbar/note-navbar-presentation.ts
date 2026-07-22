import type { PeriodicNoteType } from "../../core/periodic/periodic-date";
import type { Translator } from "../../shared/i18n";

export interface NoteNavbarMessages {
  readonly previousPeriod: string;
  readonly nextPeriod: string;
  readonly chooseDate: string;
  readonly openCalendar: string;
  readonly relatedRangeNotes: string;
}

export function getNoteNavbarMessages(t: Translator["t"]): NoteNavbarMessages {
  return Object.freeze({
    previousPeriod: t("navbar.previousPeriod"),
    nextPeriod: t("navbar.nextPeriod"),
    chooseDate: t("navbar.chooseDate"),
    openCalendar: t("navbar.openCalendar"),
    relatedRangeNotes: t("navbar.relatedRangeNotes"),
  });
}

export function formatHigherNoteLabel(
  noteType: PeriodicNoteType,
  t: Translator["t"],
): string {
  return t("navbar.openHigher", { period: formatPeriodicNoteName(noteType, t) });
}

export function formatPeriodicNoteName(
  noteType: PeriodicNoteType,
  t: Translator["t"],
): string {
  switch (noteType) {
    case "daily":
      return t("navbar.period.daily");
    case "weekly":
      return t("navbar.period.weekly");
    case "monthly":
      return t("navbar.period.monthly");
    case "quarterly":
      return t("navbar.period.quarterly");
    case "yearly":
      return t("navbar.period.yearly");
  }
}
