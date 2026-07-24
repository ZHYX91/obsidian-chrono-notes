import type { IcsEventOccurrence } from "../../core/calendar/ics-calendar";
import type { CalendarDay } from "../../features/calendar/calendar-day-query";
import type { Translator } from "../../shared/i18n";
import { CalendarNoteIndicator } from "./calendar-note-indicator";
import { formatRegionalMarkerLabel } from "./calendar-day-presentation";
import { formatCalendarIcsEventLabel } from "./calendar-ics-presentation";

export interface CalendarDayStatusRowProps {
  readonly day: CalendarDay;
  readonly showNoteIndicators: boolean;
  readonly showTaskProgress: boolean;
  readonly translator: Translator;
}

export function CalendarDayStatusRow({
  day,
  showNoteIndicators,
  showTaskProgress,
  translator,
}: CalendarDayStatusRowProps) {
  const regionalMarker =
    day.regionalMarker === null
      ? null
      : formatRegionalMarkerLabel(day.regionalMarker.kind, translator.t);
  const hasNoteIndicator =
    showNoteIndicators && day.noteState !== "not-configured";
  return (
    <span
      className="chrono-notes-day-accessories"
      data-has-note-indicator={String(hasNoteIndicator)}
      data-has-regional-marker={String(regionalMarker !== null)}
      dir="ltr"
    >
      <span className="chrono-notes-day-status">
        <CalendarNoteIndicator
          show={showNoteIndicators}
          noteState={day.noteState}
          statistics={day.statistics}
          showTaskProgress={showTaskProgress}
        />
      </span>
      {regionalMarker === null ? null : (
        <span
          className="chrono-notes-regional-marker"
          aria-hidden="true"
          dir={translator.direction}
        >
          {regionalMarker}
        </span>
      )}
    </span>
  );
}

export function CalendarDayCalendarDetails({
  day,
  translator,
}: Readonly<{
  day: CalendarDay;
  translator: Translator;
}>) {
  const groups = groupHolidayNames(day);
  return (
    <>
      {day.calendarExtensions.length === 0 ? null : (
        <span
          className="chrono-notes-calendar-extensions"
          data-count={day.calendarExtensions.length}
          aria-hidden="true"
        >
          {day.calendarExtensions.map((extension) => (
            <span
              className="chrono-notes-calendar-extension"
              data-calendar-extension-id={extension.id}
              data-transition={extension.transition ?? "none"}
              key={extension.id}
            >
              <span className="chrono-notes-calendar-extension-date">
                {extension.dateText}
              </span>
            </span>
          ))}
        </span>
      )}
      {day.calendarEvents.length === 0 ? null : (
        <span
          className="chrono-notes-calendar-extension-events"
          aria-hidden="true"
        >
          {day.calendarEvents.map((event) => (
            <span
              className="chrono-notes-calendar-extension-event"
              data-calendar-event-id={event.id}
              data-event-kind={event.kind}
              key={event.id}
            >
              {event.text}
            </span>
          ))}
        </span>
      )}
      {groups.length === 0 ? null : (
        <span className="chrono-notes-holiday-footer" aria-hidden="true">
          {groups.map((group) => (
            <span key={group.region}>
              {group.names.join(translator.t("monthView.nameSeparator"))}
            </span>
          ))}
        </span>
      )}
    </>
  );
}

export function CalendarDayEvents({
  events,
  translator,
  responsive = false,
}: Readonly<{
  events: readonly IcsEventOccurrence[];
  translator: Translator;
  responsive?: boolean;
}>) {
  if (events.length === 0) return null;
  const visibleEvents = events.slice(0, 3);
  const wideHiddenCount = Math.max(0, events.length - visibleEvents.length);
  const mediumHiddenCount = Math.max(0, events.length - 1);
  const { t } = translator;
  return (
    <span
      className="chrono-notes-ics-list"
      data-responsive={String(responsive)}
      data-has-overflow={String(
        responsive ? mediumHiddenCount > 0 : wideHiddenCount > 0,
      )}
      data-wide-overflow={String(wideHiddenCount > 0)}
      aria-hidden="true"
    >
      {visibleEvents.map((event, index) => (
        <span
          className={`chrono-notes-ics-event${event.continuesBefore || event.continuesAfter ? " is-continued" : ""}`}
          data-event-index={index}
          key={`${event.id}:${index}`}
        >
          <span className="chrono-notes-ics-dot" />
          <span className="chrono-notes-ics-event-text">
            {formatCalendarIcsEventLabel(event, t)}
          </span>
        </span>
      ))}
      {responsive && mediumHiddenCount > 0 ? (
        <CalendarEventOverflow
          count={mediumHiddenCount}
          variant="medium"
        />
      ) : null}
      {wideHiddenCount > 0 ? (
        <CalendarEventOverflow
          count={wideHiddenCount}
          variant={responsive ? "wide" : "fixed"}
        />
      ) : null}
    </span>
  );
}

function CalendarEventOverflow({
  count,
  variant,
}: Readonly<{
  count: number;
  variant: "fixed" | "medium" | "wide";
}>) {
  return (
    <span
      className={`chrono-notes-ics-more is-${variant}`}
    >
      +{count}
    </span>
  );
}

function groupHolidayNames(
  day: Pick<CalendarDay, "holidays">,
): readonly Readonly<{ region: string; names: readonly string[] }>[] {
  const groups = new Map<string, string[]>();
  for (const holiday of day.holidays) {
    const names = groups.get(holiday.region);
    if (names === undefined) groups.set(holiday.region, [holiday.name]);
    else names.push(holiday.name);
  }
  return Array.from(groups, ([region, names]) =>
    Object.freeze({
      region,
      names: Object.freeze(names),
    }),
  );
}
