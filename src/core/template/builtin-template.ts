import { DateTime } from "luxon";

import { compileMomentFormat } from "../periodic/moment-format";
import { toDateTime, type LocalDate } from "../periodic/periodic-date";

export interface BuiltinTemplateContext {
  readonly date: LocalDate;
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

  return content
    .replace(/\{\{date:(.*?)\}\}/g, (match, format: string) =>
      renderMomentFormat(match, format, targetDate))
    .replace(/\{\{date\}\}/g, targetDate.toFormat("yyyy-MM-dd"))
    .replace(/\{\{time:(.*?)\}\}/g, (match, format: string) =>
      renderMomentFormat(match, format, currentTime))
    .replace(/\{\{time\}\}/g, currentTime.toFormat("HH:mm"))
    .replace(/\{\{title\}\}/g, context.title);
}

export function renderBuiltinIntervalTemplate(
  content: string,
  context: BuiltinIntervalTemplateContext,
): string {
  const start = toDateTime(context.start).setLocale(context.locale);
  const end = toDateTime(context.end).setLocale(context.locale);
  const currentTime = getCurrentTime(context);

  return content
    .replace(/\{\{start:(.*?)\}\}/g, (match, format: string) =>
      renderMomentFormat(match, format, start))
    .replace(/\{\{start\}\}/g, start.toFormat("yyyy-MM-dd"))
    .replace(/\{\{end:(.*?)\}\}/g, (match, format: string) =>
      renderMomentFormat(match, format, end))
    .replace(/\{\{end\}\}/g, end.toFormat("yyyy-MM-dd"))
    .replace(/\{\{days\}\}/g, String(context.dayCount))
    .replace(/\{\{time:(.*?)\}\}/g, (match, format: string) =>
      renderMomentFormat(match, format, currentTime))
    .replace(/\{\{time\}\}/g, currentTime.toFormat("HH:mm"))
    .replace(/\{\{title\}\}/g, context.title);
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

function renderMomentFormat(
  fallback: string,
  format: string,
  value: DateTime,
): string {
  const compiled = compileMomentFormat(format, "date-time");
  return compiled === null ? fallback : value.toFormat(compiled);
}
