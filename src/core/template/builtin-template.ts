import { DateTime } from "luxon";

import { formatPeriodDate } from "../periodic/period-format";
import { toDateTime, type LocalDate, type PeriodRange } from "../periodic/periodic-date";

export interface BuiltinTemplateContext {
  readonly date: LocalDate;
  readonly range: PeriodRange;
  readonly title: string;
  readonly now: Date;
  readonly locale: string;
  readonly timeZone?: string;
}

export interface BuiltinIntervalTemplateContext {
  readonly start: LocalDate;
  readonly end: LocalDate;
  readonly dayCount: number;
  readonly title: string;
  readonly now: Date;
  readonly locale: string;
  readonly timeZone?: string;
}

/** Render the intentionally small built-in template language. */
export function renderBuiltinTemplate(
  content: string,
  context: BuiltinTemplateContext,
): string {
  const targetDate = toDateTime(context.date).setLocale(context.locale);
  const currentTime = getCurrentTime(context);

  return renderTemplate(content, {
    date: targetDate,
    start: toDateTime(context.range.start).setLocale(context.locale),
    end: toDateTime(context.range.end).setLocale(context.locale),
    days: String(context.range.dayCount),
    time: currentTime,
    title: context.title,
  });
}

export function renderBuiltinIntervalTemplate(
  content: string,
  context: BuiltinIntervalTemplateContext,
): string {
  const start = toDateTime(context.start).setLocale(context.locale);
  const end = toDateTime(context.end).setLocale(context.locale);
  const currentTime = getCurrentTime(context);

  return renderTemplate(content, {
    start, end, days: String(context.dayCount), time: currentTime, title: context.title,
  });
}

function getCurrentTime(
  context: Pick<BuiltinTemplateContext, "now" | "locale" | "timeZone">,
): DateTime {
  const currentTime = DateTime.fromJSDate(context.now, {
    zone: context.timeZone ?? "local",
  }).setLocale(context.locale);
  if (!currentTime.isValid) throw new RangeError("Invalid template render time");
  return currentTime;
}

/** One pass prevents rendered titles or literals from becoming template instructions. */
function renderTemplate(content: string, values: Readonly<Record<string, DateTime | string>>): string {
  return content.replace(/\{\{([a-z]+)(?::(.*?))?\}\}/g, (match, key: string, format?: string) => {
    const value = values[key];
    if (value === undefined) return match;
    if (typeof value === "string") return format === undefined ? value : match;
    return formatPeriodDate(value, format ?? (key === "time" ? "HH:mm" : "YYYY-MM-DD")) ?? match;
  });
}
