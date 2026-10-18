import {
  getCenturyNumber,
  toUtcDate,
  type LocalDate,
  type PeriodicNoteType,
  type WeekStartDay,
} from "../../core/periodic/periodic-date";
import { getCalendarWeekIdentity } from "../../core/periodic/calendar-week";
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
    case "decadal":
      return t("navbar.period.decadal");
    case "century":
      return t("navbar.period.century");
    case "yearly":
      return t("navbar.period.yearly");
  }
}

export function formatNoteNavbarLabel(
  date: LocalDate,
  noteType: PeriodicNoteType,
  translator: Translator,
  weekStartDay: WeekStartDay,
): string {
  const { locale, t } = translator;
  const number = new Intl.NumberFormat(locale, { useGrouping: false });
  switch (noteType) {
    case "daily": {
      const padded = (value: number, digits: number) => new Intl.NumberFormat(locale, {
        useGrouping: false, minimumIntegerDigits: digits,
      }).format(value);
      return `${padded(date.year, 4)}-${padded(date.month, 2)}-${padded(date.day, 2)}`;
    }
    case "weekly":
      return t("navbar.weekLabel", {
        week: number.format(getCalendarWeekIdentity(date, weekStartDay).weekNumber),
      });
    case "monthly":
      return new Intl.DateTimeFormat(locale, {
        calendar: "gregory", month: "short", timeZone: "UTC",
      }).format(toUtcDate(date));
    case "yearly":
      return new Intl.DateTimeFormat(locale, {
        calendar: "gregory", year: "numeric", timeZone: "UTC",
      }).format(toUtcDate(date));
    case "quarterly":
      return `Q${Math.ceil(date.month / 3)}`;
    case "decadal":
      return `${String(date.year).padStart(4, "0")}s`;
    case "century":
      return `C${getCenturyNumber(date.year)}`;
  }
}
