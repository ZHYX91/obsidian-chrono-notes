import type { WeekStartDay } from "../core/periodic/periodic-date";

const DAY_IN_MILLISECONDS = 86_400_000;
const MONDAY_UTC = Date.UTC(2024, 0, 1);

export function formatNarrowWeekdayLabels(
  locale: string,
  weekStartDay: WeekStartDay,
): readonly string[] {
  const formatter = new Intl.DateTimeFormat(locale, {
    weekday: "narrow",
    timeZone: "UTC",
  });
  const mondayFirst = Array.from({ length: 7 }, (_, index) =>
    formatter.format(new Date(MONDAY_UTC + index * DAY_IN_MILLISECONDS)),
  );
  return Object.freeze(
    weekStartDay === "sunday"
      ? [mondayFirst[6] ?? "", ...mondayFirst.slice(0, 6)]
      : mondayFirst,
  );
}

export function formatShortMonthLabel(
  year: number,
  month: number,
  locale: string,
): string {
  return createShortMonthFormatter(locale).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

export function formatShortMonthLabels(
  year: number,
  locale: string,
): readonly string[] {
  const formatter = createShortMonthFormatter(locale);
  return Object.freeze(
    Array.from({ length: 12 }, (_, index) =>
      formatter.format(new Date(Date.UTC(year, index, 1))),
    ),
  );
}

function createShortMonthFormatter(locale: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    timeZone: "UTC",
  });
}
