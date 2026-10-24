import type { MonthCalendarDay } from "../../features/calendar/month-calendar-query";
import { formatLocalDateKey } from "../../core/periodic/periodic-date";
import type { Translator } from "../../shared/i18n";
import { formatCalendarExtensionEventLabel } from "./calendar-day-presentation";
import { formatCalendarIcsDayLabel } from "./calendar-ics-presentation";
import { formatCalendarNoteState } from "./calendar-note-presentation";
import { formatCalendarPreviewRegional, formatCalendarPreviewTaskProgress } from "./calendar-preview-presentation";

/** A persistent touch/keyboard-readable projection of the selected, already queried day. */
export function MonthSelectedDayDetails({ day, translator }: Readonly<{
  day: MonthCalendarDay;
  translator: Translator;
}>) {
  const { t } = translator;
  const regional = formatCalendarPreviewRegional(day, t);
  const title = t("calendar.selectedDayDetails", { date: formatLocalDateKey(day.date) });
  return (
    <section className="chrono-notes-selected-day-details" aria-label={title}>
      <h3>{title}</h3>
      <p>{formatCalendarNoteState(day.noteState, day.errorMessage, t)}</p>
      {day.statistics.taskTotal > 0 ? <p>{formatCalendarPreviewTaskProgress({
        completed: day.statistics.taskCompleted, total: day.statistics.taskTotal,
      }, t)}</p> : null}
      {day.calendarExtensions.map((extension) => <p key={extension.id}>{extension.accessibilityText}</p>)}
      {regional === null ? null : <p>{regional}</p>}
      {day.calendarEvents.length > 0 ? <ul>{day.calendarEvents.map((event) => (
        <li key={event.id}>{formatCalendarExtensionEventLabel(event, t)}</li>
      ))}</ul> : null}
      {day.icsEvents.length > 0 ? <ul>{day.icsEvents.map((event, index) => (
        <li key={index}>{formatCalendarIcsDayLabel([event], t)}</li>
      ))}</ul> : null}
    </section>
  );
}
