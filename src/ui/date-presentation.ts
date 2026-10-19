import { toUtcDate, type LocalDate, type WeekStartDay } from "../core/periodic/periodic-date";

const DAY_IN_MILLISECONDS = 86_400_000;
const MONDAY_UTC = Date.UTC(2024, 0, 1);

export function formatNarrowWeekdayLabels(
  locale: string,
  weekStartDay: WeekStartDay,
): readonly string[] {
  const formatter = createGregorianDateFormatter(locale, {
    weekday: "narrow",
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
    toUtcDate({ year, month, day: 1 }),
  );
}

export function formatShortMonthLabels(
  year: number,
  locale: string,
): readonly string[] {
  const formatter = createShortMonthFormatter(locale);
  return Object.freeze(
    Array.from({ length: 12 }, (_, index) =>
      formatter.format(toUtcDate({ year, month: index + 1, day: 1 })),
    ),
  );
}

function createShortMonthFormatter(locale: string): Intl.DateTimeFormat {
  return createGregorianDateFormatter(locale, {
    month: "short",
  });
}

/** The primary UI calendar is Gregorian; locale changes its language and digits. */
export function createGregorianDateFormatter(
  locale: string,
  options: Omit<Intl.DateTimeFormatOptions, "calendar" | "timeZone">,
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, {
    ...options,
    calendar: "gregory",
    timeZone: "UTC",
  });
}

export function formatMonthLabel(
  month: Pick<LocalDate, "year" | "month">,
  locale: string,
): string {
  return createGregorianDateFormatter(locale, {
    month: "long",
    year: "numeric",
  }).format(toUtcDate({ ...month, day: 1 }));
}
