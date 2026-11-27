import { isInteractiveCalendarYear } from "../../features/calendar/date-picker";
import { getHolidayRegionDefinition } from "../../features/calendar/holiday-region-registry";
import type { MonthCalendarQuery } from "../../features/calendar/month-calendar-query";
import type { WeekCalendarQuery } from "../../features/calendar/week-calendar-query";
import type { Translator } from "../../shared/i18n";
import type { HolidayRegion } from "../../shared/settings";

interface HolidayCoverageProps {
  readonly query: MonthCalendarQuery | WeekCalendarQuery;
  readonly heatmap: boolean;
  readonly regions: readonly HolidayRegion[];
  readonly translator: Translator;
}

export function CalendarHolidayCoverage({ query, heatmap, regions, translator }: HolidayCoverageProps) {
  if (regions.length === 0) return null;
  let firstYear: number;
  let lastYear: number;
  if ("weeks" in query) {
    firstYear = heatmap ? query.year : query.weeks[0]?.weekStart.year ?? query.year;
    lastYear = heatmap ? query.year : query.weeks.at(-1)?.days.at(-1)?.date.year ?? query.year;
  } else {
    firstYear = query.weekStart.year;
    lastYear = query.weekEnd.year;
  }

  const notices = [];
  const { t, locale } = translator;
  for (let year = firstYear; year <= lastYear; year++) {
    if (!isInteractiveCalendarYear(year)) continue;
    const missing = regions.map(getHolidayRegionDefinition)
      .filter(region => region.getYearCoverage(year) !== "available");
    if (missing.length > 0) {
      notices.push(t("holiday.coverage.incomplete", {
        year: year.toLocaleString(locale, { useGrouping: false }),
        regions: missing.map(region => t(region.labelKey)).join(t("monthView.nameSeparator")),
      }));
    }
  }
  return notices.length > 0 ? (
    <div className="chrono-notes-holiday-coverage" role="note">
      {notices.map(notice => <div key={notice}>{notice}</div>)}
    </div>
  ) : null;
}
