import { HolidayUtil } from "lunar-typescript";

import type { LocalDate } from "../periodic/periodic-date";
import type {
  HolidayDataCoverage,
  RegionalHoliday,
  RegionalWorkday,
} from "./regional-holidays";
import { resolveRegionalHolidayLocale } from "./regional-holidays";

export interface ChinaHolidayDay {
  readonly coverage: HolidayDataCoverage;
  readonly holidays: readonly RegionalHoliday[];
  readonly workday: RegionalWorkday | null;
}

const EMPTY_HOLIDAYS: readonly RegionalHoliday[] = Object.freeze([]);
const yearCoverage = new Map<number, HolidayDataCoverage>();

const TRADITIONAL_CHINESE_HOLIDAY_NAMES: Readonly<Record<string, string>> = Object.freeze({
  元旦节: "元旦節",
  春节: "春節",
  清明节: "清明節",
  劳动节: "勞動節",
  端午节: "端午節",
  中秋节: "中秋節",
  国庆节: "國慶節",
  国庆中秋: "國慶中秋",
  抗战胜利日: "抗戰勝利日",
});

const ENGLISH_HOLIDAY_NAMES: Readonly<Record<string, string>> = Object.freeze({
  元旦节: "New Year's Day",
  春节: "Spring Festival",
  清明节: "Qingming Festival",
  劳动节: "Labour Day",
  端午节: "Dragon Boat Festival",
  中秋节: "Mid-Autumn Festival",
  国庆节: "National Day",
  国庆中秋: "National Day / Mid-Autumn Festival",
  抗战胜利日: "Victory Day",
});

export function getChinaHolidayDay(date: LocalDate, locale: string): ChinaHolidayDay {
  const holiday = HolidayUtil.getHoliday(date.year, date.month, date.day);
  const coverage = holiday === null
    ? getChinaHolidayYearCoverage(date.year)
    : "available";
  if (holiday === null) {
    return Object.freeze({ coverage, holidays: EMPTY_HOLIDAYS, workday: null });
  }

  const name = localizeHolidayName(holiday.getName(), locale);
  const workday = Object.freeze({
    region: "cn" as const,
    name,
    isWorkday: holiday.isWork(),
  });
  const holidays = holiday.isWork()
    ? EMPTY_HOLIDAYS
    : Object.freeze([Object.freeze({ region: "cn" as const, name })]);

  return Object.freeze({ coverage, holidays, workday });
}

export function getChinaHolidayYearCoverage(year: number): HolidayDataCoverage {
  const cached = yearCoverage.get(year);
  if (cached !== undefined) return cached;

  const coverage = HolidayUtil.getHolidays(year).length > 0 ? "available" : "unavailable";
  yearCoverage.set(year, coverage);
  return coverage;
}

function localizeHolidayName(name: string, locale: string): string {
  const resolvedLocale = resolveRegionalHolidayLocale(locale);
  if (resolvedLocale === "zh-TW") return TRADITIONAL_CHINESE_HOLIDAY_NAMES[name] ?? name;
  if (resolvedLocale === "en") return ENGLISH_HOLIDAY_NAMES[name] ?? name;
  return name;
}
