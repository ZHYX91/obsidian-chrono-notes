import type { RegionalHoliday, RegionalWorkday } from "../../core/calendar/regional-holidays";
import {
  getHolidayRegionDefinition,
  type RegionalHolidayProviderDay,
} from "../../features/calendar/holiday-region-registry";
import type { Translator } from "../../shared/i18n";

export interface RegionalDayPresentation {
  readonly regionalDays?: readonly RegionalHolidayProviderDay[];
  readonly holidays?: readonly RegionalHoliday[];
  readonly workday?: RegionalWorkday | null;
}

export function formatRegionalDayDetails(
  cell: RegionalDayPresentation,
  context: "monthView" | "calendarPreview",
  t: Translator["t"],
): string | null {
  const areas = cell.regionalDays;
  if (areas && areas.length > 0) {
    const descriptions: string[] = [];
    for (const area of areas) {
      const detail = describeRegionDay(area.holidays, area.workday, context, t);
      if (detail) {
        descriptions.push(`${t(getHolidayRegionDefinition(area.region).labelKey)} · ${detail}`);
      }
    }
    return descriptions.join(t("calendar.itemSeparator")) || null;
  }
  return describeRegionDay(cell.holidays ?? [], cell.workday ?? null, context, t);
}

function describeRegionDay(
  holidays: readonly RegionalHoliday[],
  workday: RegionalWorkday | null,
  context: "monthView" | "calendarPreview",
  t: Translator["t"],
): string | null {
  if (holidays.length === 0 && workday === null) return null;
  const confirmed: string[] = [];
  const conditional: string[] = [];
  for (const holiday of holidays) {
    (holiday.conditional ? conditional : confirmed).push(holiday.name);
  }
  if (workday?.isWorkday === false && !confirmed.includes(workday.name)) {
    confirmed.push(workday.name);
  }
  const labels: string[] = [];
  const separator = t(`${context}.nameSeparator`);
  if (confirmed.length > 0) labels.push(t(`${context}.publicHoliday`, { names: confirmed.join(separator) }));
  if (conditional.length > 0) labels.push(t("holiday.conditional", { names: conditional.join(separator) }));
  if (workday?.isWorkday) labels.push(t(`${context}.adjustedWorkday`, { name: workday.name }));
  return labels.join(t("calendar.itemSeparator")) || null;
}
