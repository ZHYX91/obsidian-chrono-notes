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

/** Render the intentionally small built-in template language. */
export function renderBuiltinTemplate(
  content: string,
  context: BuiltinTemplateContext,
): string {
  const targetDate = toDateTime(context.date).setLocale(context.locale);
  const currentTime = DateTime.fromJSDate(context.now, {
    zone: context.timeZone ?? "local",
  }).setLocale(context.locale);
  if (!currentTime.isValid) throw new RangeError("Invalid template render time");

  return content
    .replace(/\{\{date:(.*?)\}\}/g, (match, format: string) =>
      renderMomentFormat(match, format, targetDate))
    .replace(/\{\{date\}\}/g, targetDate.toFormat("yyyy-MM-dd"))
    .replace(/\{\{time:(.*?)\}\}/g, (match, format: string) =>
      renderMomentFormat(match, format, currentTime))
    .replace(/\{\{time\}\}/g, currentTime.toFormat("HH:mm"))
    .replace(/\{\{title\}\}/g, context.title);
}

function renderMomentFormat(
  fallback: string,
  format: string,
  value: DateTime,
): string {
  const compiled = compileMomentFormat(format, "date-time");
  return compiled === null ? fallback : value.toFormat(compiled);
}
