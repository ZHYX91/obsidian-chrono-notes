import type { IcsEventOccurrence } from "../../core/calendar/ics-calendar";
import type { CalendarDay } from "../../features/calendar/calendar-day-query";
import type { Translator } from "../../shared/i18n";
import type { TodoAnnotationMode } from "../../shared/settings";
import { CalendarNoteIndicator } from "./calendar-note-indicator";
import { formatRegionalMarkerLabel } from "./calendar-day-presentation";
import { formatCalendarIcsEventLabel } from "./calendar-ics-presentation";

export interface CalendarDayStatusRowProps {
  readonly day: CalendarDay;
  readonly showNoteIndicators: boolean;
  readonly taskAnnotationMode: TodoAnnotationMode;
  readonly translator: Translator;
}

export function CalendarDayStatusRow({
  day,
  showNoteIndicators,
  taskAnnotationMode,
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
          taskAnnotationMode={taskAnnotationMode}
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
      {day.calendarOverlays.length === 0 ? null : (
        <span
          className="chrono-notes-calendar-overlays"
          data-count={day.calendarOverlays.length}
          aria-hidden="true"
        >
          {day.calendarOverlays.map((overlay) => (
            <span
              className="chrono-notes-calendar-overlay"
              data-overlay-id={overlay.id}
              data-transition={overlay.transition ?? "none"}
              title={overlay.accessibilityText}
              key={overlay.id}
            >
              <span className="chrono-notes-calendar-overlay-date">
                {overlay.dateText}
              </span>
              {overlay.eventText === null ? null : (
                <span
                  className="chrono-notes-calendar-overlay-event"
                  data-event-kind={overlay.eventKind ?? "none"}
                >
                  {overlay.eventText}
                </span>
              )}
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
          t={t}
        />
      ) : null}
      {wideHiddenCount > 0 ? (
        <CalendarEventOverflow
          count={wideHiddenCount}
          variant={responsive ? "wide" : "fixed"}
          t={t}
        />
      ) : null}
    </span>
  );
}

function CalendarEventOverflow({
  count,
  variant,
  t,
}: Readonly<{
  count: number;
  variant: "fixed" | "medium" | "wide";
  t: Translator["t"];
}>) {
  return (
    <span
      className={`chrono-notes-ics-more is-${variant}`}
      title={t("calendar.ics.moreEvents", { count })}
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
