import { HolidayUtil } from "lunar-typescript";

import { formatLocalDateKey, type LocalDate } from "../periodic/periodic-date";
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

// State Council General Office notice, 5 November 2026 (国办发明电〔2026〕10号).
// https://www.forestry.gov.cn/lyj/1/szxx/20261105/695102.html
const CHINA_2027_HOLIDAYS = [
  ["2027-01-01", "2027-01-03", "元旦节"],
  ["2027-02-05", "2027-02-13", "春节"],
  ["2027-04-03", "2027-04-05", "清明节"],
  ["2027-05-01", "2027-05-05", "劳动节"],
  ["2027-06-09", "2027-06-09", "端午节"],
  ["2027-09-15", "2027-09-15", "中秋节"],
  ["2027-10-01", "2027-10-07", "国庆节"],
] as const;

const CHINA_2027_ADJUSTED_WORKDAYS: ReadonlyMap<string, string> = new Map([
  ["2027-01-31", "春节"],
  ["2027-02-14", "春节"],
  ["2027-05-08", "劳动节"],
  ["2027-09-26", "国庆节"],
  ["2027-10-09", "国庆节"],
]);

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
  const holiday = getChinaHoliday(date);
  if (holiday === null) {
    return Object.freeze({
      coverage: getChinaHolidayYearCoverage(date.year),
      holidays: EMPTY_HOLIDAYS,
      workday: null,
    });
  }

  const name = localizeHolidayName(holiday.name, locale);
  const workday = Object.freeze({
    region: "cn" as const,
    name,
    isWorkday: holiday.isWorkday,
  });
  const holidays = holiday.isWorkday
    ? EMPTY_HOLIDAYS
    : Object.freeze([Object.freeze({ region: "cn" as const, name })]);

  return Object.freeze({ coverage: "available", holidays, workday });
}

export function getChinaHolidayYearCoverage(year: number): HolidayDataCoverage {
  if (year === 2027) return "available";
  const cached = yearCoverage.get(year);
  if (cached !== undefined) return cached;

  const coverage = HolidayUtil.getHolidays(year).length > 0 ? "available" : "unavailable";
  yearCoverage.set(year, coverage);
  return coverage;
}

function getChinaHoliday(date: LocalDate): { name: string; isWorkday: boolean } | null {
  if (date.year === 2027) {
    const key = formatLocalDateKey(date);
    const adjustedWorkday = CHINA_2027_ADJUSTED_WORKDAYS.get(key);
    if (adjustedWorkday !== undefined) return { name: adjustedWorkday, isWorkday: true };
    const holiday = CHINA_2027_HOLIDAYS.find(([start, end]) => start <= key && key <= end);
    return holiday === undefined ? null : { name: holiday[2], isWorkday: false };
  }

  const holiday = HolidayUtil.getHoliday(date.year, date.month, date.day);
  return holiday === null ? null : { name: holiday.getName(), isWorkday: holiday.isWork() };
}

function localizeHolidayName(name: string, locale: string): string {
  const resolvedLocale = resolveRegionalHolidayLocale(locale);
  if (resolvedLocale === "zh-TW") return TRADITIONAL_CHINESE_HOLIDAY_NAMES[name] ?? name;
  if (resolvedLocale === "en") return ENGLISH_HOLIDAY_NAMES[name] ?? name;
  return name;
}
