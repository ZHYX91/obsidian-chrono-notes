import type { IcsEventOccurrence } from "../../core/calendar/ics-calendar";
import type { Translator } from "../../shared/i18n";

export function formatCalendarIcsEventLabel(
  event: IcsEventOccurrence,
  t: Translator["t"],
): string {
  const prefix = event.continuesBefore
    ? "... "
    : event.isAllDay
      ? `${t("calendar.ics.allDay")} `
      : event.timeLabel === null ? "" : `${event.timeLabel} `;
  const suffix = event.continuesAfter ? " ..." : "";
  return `${prefix}${event.title}${suffix}`;
}

export function formatCalendarIcsDayLabel(
  events: readonly IcsEventOccurrence[],
  t: Translator["t"],
): string {
  if (events.length === 0) return "";
  return t("calendar.ics.cellLabel", {
    events: events
      .map((event) => formatAccessibleEvent(event, t))
      .join(t("calendar.ics.eventSeparator")),
  });
}

function formatAccessibleEvent(event: IcsEventOccurrence, t: Translator["t"]): string {
  const timing = event.continuesBefore
    ? event.continuesAfter
      ? t("calendar.ics.continuingFromPreviousAndIntoNext")
      : t("calendar.ics.continuingFromPreviousDay")
    : event.isAllDay
      ? event.continuesAfter
        ? t("calendar.ics.timingWithContinuation", {
            timing: t("calendar.ics.allDayAccessible"),
            continuation: t("calendar.ics.continuingIntoNextDay"),
          })
        : t("calendar.ics.allDayAccessible")
      : event.timeLabel === null
        ? event.continuesAfter
          ? t("calendar.ics.timingWithContinuation", {
              timing: t("calendar.ics.timed"),
              continuation: t("calendar.ics.continuingIntoNextDay"),
            })
          : t("calendar.ics.timed")
        : event.continuesAfter
          ? t("calendar.ics.timingWithContinuation", {
              timing: event.timeLabel,
              continuation: t("calendar.ics.continuingIntoNextDay"),
            })
          : event.timeLabel;
  return t("calendar.ics.accessibleEvent", {
    title: event.title,
    timing,
    source: t("calendar.ics.source", { source: event.sourceLabel }),
  });
}
