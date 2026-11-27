import type { ObservanceGroup } from "../../core/calendar/observance-groups";
import type {
  CalendarExtensionDay,
  CalendarExtensionEvent,
} from "../../core/calendar/calendar-extension";
import type { IcsEventOccurrence } from "../../core/calendar/ics-calendar";
import type {
  RegionalHoliday,
  RegionalWorkday,
} from "../../core/calendar/regional-holidays";
import {
  formatLocalDateKey,
  type LocalDate,
  type WeekStartDay,
} from "../../core/periodic/periodic-date";
import {
  getHeatmapMetric,
  type HeatmapMetric,
  type StatisticDisplayDimension,
} from "../../core/statistics/heatmap";
import type { CalendarExtension, HolidayRegion } from "../../shared/settings";
import type { NoteIndexSnapshot } from "../notes/note-index";
import {
  selectCalendarDecorations,
  type CalendarDecorationCache,
} from "./calendar-decoration-cache";
import type { IcsEventIndexSnapshot } from "./ics-event-index";
import {
  selectIndexedPeriodicNote,
  type IndexedPeriodicNote,
  type PeriodicNoteRule,
} from "./indexed-periodic-note";
import type { RegionalHolidayProviderDay, RegionalMarker } from "./holiday-region-registry";

export interface CalendarDayQueryOptions {
  readonly locale: string;
  readonly weekStartDay: WeekStartDay;
  readonly calendarExtensions: readonly CalendarExtension[];
  readonly holidayRegions: readonly HolidayRegion[];
  readonly observances?: readonly ObservanceGroup[];
  readonly heatmap: Readonly<{
    dimension: StatisticDisplayDimension;
    valueStep: number;
  }> | null;
  readonly daily: PeriodicNoteRule;
  readonly decorationCache?: CalendarDecorationCache;
}

export interface CalendarDay extends IndexedPeriodicNote {
  readonly regionalDays: readonly RegionalHolidayProviderDay[];
  readonly calendarExtensions: readonly CalendarExtensionDay[];
  readonly calendarEvents: readonly CalendarExtensionEvent[];
  readonly holidays: readonly RegionalHoliday[];
  readonly workday: RegionalWorkday | null;
  readonly regionalMarker: RegionalMarker | null;
  readonly icsEvents: readonly IcsEventOccurrence[];
  readonly heatmap: HeatmapMetric | null;
}

export function selectCalendarDay(
  date: LocalDate,
  noteSnapshot: NoteIndexSnapshot,
  icsSnapshot: IcsEventIndexSnapshot,
  options: CalendarDayQueryOptions,
): CalendarDay {
  const indexed = selectIndexedPeriodicNote(
    date,
    "daily",
    noteSnapshot,
    options,
    options.daily,
  );
  const decorations = options.decorationCache?.get(
    date,
    options.locale,
    options.calendarExtensions,
    options.holidayRegions,
    options.observances,
  ) ?? selectCalendarDecorations(
    date,
    options.locale,
    options.calendarExtensions,
    options.holidayRegions,
    options.observances,
  );
  const icsEvents = icsSnapshot.enabled
    ? (icsSnapshot.eventsByDate[formatLocalDateKey(date)] ?? EMPTY_ICS_EVENTS)
    : EMPTY_ICS_EVENTS;

  return Object.freeze({
    ...indexed,
    calendarExtensions: decorations.calendarExtensions,
    calendarEvents: decorations.calendarEvents,
    regionalDays: decorations.regionalDays,
    holidays: decorations.holidays,
    workday: decorations.workday,
    regionalMarker: decorations.regionalMarker,
    icsEvents,
    heatmap:
      options.heatmap === null
        ? null
        : getHeatmapMetric(
            indexed.statistics,
            options.heatmap.dimension,
            options.heatmap.valueStep,
          ),
  });
}

const EMPTY_ICS_EVENTS = Object.freeze([]) as readonly IcsEventOccurrence[];
