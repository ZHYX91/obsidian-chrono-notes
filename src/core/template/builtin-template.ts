import { DateTime } from "luxon";

import { toDateTime, type LocalDate } from "../periodic/periodic-date";

export interface BuiltinTemplateContext {
  readonly date: LocalDate;
  readonly title: string;
  readonly now: Date;
  readonly timeZone?: string;
}

/** Render the intentionally small built-in template language. */
export function renderBuiltinTemplate(
  content: string,
  context: BuiltinTemplateContext,
): string {
  const targetDate = toDateTime(context.date);
  const currentTime = DateTime.fromJSDate(context.now, {
    zone: context.timeZone ?? "local",
  });
  if (!currentTime.isValid) throw new RangeError("Invalid template render time");

  return content
    .replace(/\{\{date:(.*?)\}\}/g, (_match, format: string) =>
      targetDate.toFormat(convertMomentTokens(format)),
    )
    .replace(/\{\{date\}\}/g, targetDate.toFormat("yyyy-MM-dd"))
    .replace(/\{\{time:(.*?)\}\}/g, (_match, format: string) =>
      currentTime.toFormat(convertMomentTokens(format)),
    )
    .replace(/\{\{time\}\}/g, currentTime.toFormat("HH:mm"))
    .replace(/\{\{title\}\}/g, context.title);
}

function convertMomentTokens(format: string): string {
  return format
    .replace(/YYYY/g, "yyyy")
    .replace(/YY/g, "yy")
    .replace(/DD/g, "dd");
}
