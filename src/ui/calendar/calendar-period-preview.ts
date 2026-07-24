import {
  formatLocalDateKey,
  getPeriodAnchor,
  shiftPeriod,
  type LocalDate,
  type PeriodicNoteType,
  type WeekStartDay,
} from "../../core/periodic/periodic-date";
import { getCalendarWeekIdentity } from "../../core/periodic/calendar-week";
import type { IndexedPeriodicNote } from "../../features/calendar/indexed-periodic-note";
import type { CalendarPreviewCell } from "./calendar-preview-tooltip";

export interface PeriodicCalendarPreviewCell extends CalendarPreviewCell {
  readonly periodicNoteType: PeriodicNoteType;
  readonly previewTitle: string;
  readonly previewSubtitle: string | null;
}

export function createDailyCalendarPreview(
  note: IndexedPeriodicNote,
): PeriodicCalendarPreviewCell {
  return createPeriodicCalendarPreview(note, "daily", "monday");
}

export function createPeriodicCalendarPreview(
  note: IndexedPeriodicNote,
  noteType: PeriodicNoteType,
  weekStartDay: WeekStartDay,
): PeriodicCalendarPreviewCell {
  const anchor = getPeriodAnchor(note.date, noteType, weekStartDay);
  return Object.freeze({
    ...note,
    periodicNoteType: noteType,
    previewTitle: formatPeriodTitle(anchor, noteType, weekStartDay),
    previewSubtitle: formatPeriodRange(anchor, noteType, weekStartDay),
  });
}

function formatPeriodTitle(
  anchor: LocalDate,
  noteType: PeriodicNoteType,
  weekStartDay: WeekStartDay,
): string {
  switch (noteType) {
    case "daily":
      return formatLocalDateKey(anchor);
    case "weekly": {
      const week = getCalendarWeekIdentity(anchor, weekStartDay);
      return `${week.weekYear}-W${String(week.weekNumber).padStart(2, "0")}`;
    }
    case "monthly":
      return `${anchor.year}-${String(anchor.month).padStart(2, "0")}`;
    case "quarterly":
      return `${anchor.year}-Q${Math.floor((anchor.month - 1) / 3) + 1}`;
    case "yearly":
      return String(anchor.year);
  }
}

function formatPeriodRange(
  anchor: LocalDate,
  noteType: PeriodicNoteType,
  weekStartDay: WeekStartDay,
): string | null {
  if (noteType === "daily") return null;
  const end = shiftPeriod(
    shiftPeriod(anchor, noteType, 1, weekStartDay),
    "daily",
    -1,
    weekStartDay,
  );
  return `${formatLocalDateKey(anchor)} – ${formatLocalDateKey(end)}`;
}
