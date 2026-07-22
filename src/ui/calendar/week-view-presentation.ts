import type {
  WeekTaskDateKind,
  WeekTaskOverdue,
} from "../../features/calendar/week-calendar-query";
import {
  toUtcDate,
  type LocalDate,
} from "../../core/periodic/periodic-date";
import type { Translator } from "../../shared/i18n";

export interface WeekViewMessages {
  readonly overview: string;
  readonly weeklyNote: string;
  readonly rangeNotes: string;
  readonly createRange: string;
  readonly datedTasks: string;
  readonly emptyDatedTasks: string;
  readonly datedTaskScope: string;
}

export interface WeekPickerLabels {
  readonly trigger: string;
  readonly item: string;
  readonly range: string;
  readonly accessible: string;
  readonly selectAccessible: string;
}

export type WeekPickerLabelFormatter = (
  start: LocalDate,
  end: LocalDate,
  weekNumber: number,
  weekYear: number,
) => WeekPickerLabels;

export interface WeekDayVisualLabels {
  readonly full: string;
  readonly compact: string;
}

export function formatWeekPickerLabels(
  start: LocalDate,
  end: LocalDate,
  weekNumber: number,
  weekYear: number,
  translator: Translator,
): WeekPickerLabels {
  return createWeekPickerLabelFormatter(translator)(
    start,
    end,
    weekNumber,
    weekYear,
  );
}

export function createWeekPickerLabelFormatter(
  translator: Translator,
): WeekPickerLabelFormatter {
  const dateFormatter = new Intl.DateTimeFormat(translator.locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  return (start, end, weekNumber, weekYear) => {
    const paddedWeek = String(weekNumber).padStart(2, "0");
    const range = formatCompactWeekRange(start, end);
    const details = `${dateFormatter.format(toUtcDate(start))}–${dateFormatter.format(
      toUtcDate(end),
    )}`;
    return Object.freeze({
      trigger: translator.t("calendar.weekPicker.trigger", { week: weekNumber }),
      item: translator.t("calendar.weekPicker.item", { week: paddedWeek }),
      range,
      accessible: translator.t("calendar.weekLabel", {
        week: weekNumber,
        weekYear,
        details,
      }),
      selectAccessible: translator.t("calendar.selectWeek", {
        week: weekNumber,
        weekYear,
        details,
      }),
    });
  };
}

export function formatCompactWeekRange(
  start: LocalDate,
  end: LocalDate,
): string {
  if (start.year === end.year && start.month === end.month) {
    return `${start.month}/${start.day}–${end.day}`;
  }
  return `${start.month}/${start.day}–${end.month}/${end.day}`;
}

export function formatWeekDayVisualLabels(
  date: LocalDate,
  _locale: string,
): WeekDayVisualLabels {
  const full = `${date.month}/${date.day}`;
  return Object.freeze({
    full,
    compact: date.day === 1 ? full : String(date.day),
  });
}

export function getWeekViewMessages(t: Translator["t"]): WeekViewMessages {
  return Object.freeze({
    overview: t("weekView.overview"),
    weeklyNote: t("weekView.weeklyNote"),
    rangeNotes: t("weekView.rangeNotes"),
    createRange: t("weekView.createRange"),
    datedTasks: t("weekView.datedTasks"),
    emptyDatedTasks: t("weekView.emptyDatedTasks"),
    datedTaskScope: t("weekView.datedTaskScope"),
  });
}

export function formatDatedTaskCount(
  count: number,
  t: Translator["t"],
): string {
  return t("weekView.datedTaskCount", { count });
}

export function formatWeekTaskDateKinds(
  kinds: readonly WeekTaskDateKind[],
  t: Translator["t"],
): string {
  return kinds.map((kind) => t(`weekView.taskDate.${kind}`)).join(
    t("weekView.dateKindSeparator"),
  );
}

export function formatWeekTaskOverdue(
  overdue: WeekTaskOverdue,
  t: Translator["t"],
): string | null {
  return overdue === "none" ? null : t(`weekView.overdue.${overdue}`);
}

export function formatWeekTaskToggleLabel(
  task: string,
  kinds: readonly WeekTaskDateKind[],
  overdue: WeekTaskOverdue,
  t: Translator["t"],
): string {
  const overdueLabel = formatWeekTaskOverdue(overdue, t);
  const status = [
    formatWeekTaskDateKinds(kinds, t),
    ...(overdueLabel === null ? [] : [overdueLabel]),
  ].join(t("calendar.itemSeparator"));
  return t("weekView.toggleTask", { task, status });
}

export function formatWeekTaskRescheduleLabel(
  task: string,
  t: Translator["t"],
): string {
  return t("weekView.rescheduleTask", { task });
}

export function formatWeekRangeDuration(
  dayCount: number,
  t: Translator["t"],
): string {
  return t("weekView.rangeDuration", { count: dayCount });
}
