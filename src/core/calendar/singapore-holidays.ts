import {
  formatLocalDateKey,
  type LocalDate,
} from "../periodic/periodic-date";
import {
  resolveRegionalHolidayLocale,
  type HolidayDataCoverage,
  type RegionalHoliday,
  type RegionalHolidayLocale,
} from "./regional-holidays";

export interface SingaporeHolidayDay {
  readonly coverage: HolidayDataCoverage;
  readonly holidays: readonly RegionalHoliday[];
}

interface SingaporeHolidayEntry {
  readonly date: string;
  readonly names: Readonly<Record<RegionalHolidayLocale, string>>;
}

const EMPTY_HOLIDAYS: readonly RegionalHoliday[] = Object.freeze([]);

const HOLIDAYS_BY_YEAR: ReadonlyMap<number, readonly SingaporeHolidayEntry[]> = new Map([
  // Ministry of Manpower, 16 June 2025:
  // https://www.mom.gov.sg/newsroom/press-releases/2025/0616-public-holidays-for-2026
  [2026, [
    holiday("2026-01-01", "New Year's Day", "元旦", "元旦"),
    holiday("2026-02-17", "Chinese New Year", "农历新年", "農曆新年"),
    holiday("2026-02-18", "Chinese New Year", "农历新年", "農曆新年"),
    holiday("2026-03-21", "Hari Raya Puasa", "开斋节", "開齋節"),
    holiday("2026-04-03", "Good Friday", "耶稣受难日", "耶穌受難日"),
    holiday("2026-05-01", "Labour Day", "劳动节", "勞動節"),
    holiday("2026-05-27", "Hari Raya Haji", "哈芝节", "哈芝節"),
    holiday("2026-05-31", "Vesak Day", "卫塞节", "衛塞節"),
    holiday("2026-06-01", "Vesak Day Holiday", "卫塞节补假", "衛塞節補假"),
    holiday("2026-08-09", "National Day", "国庆日", "國慶日"),
    holiday("2026-08-10", "National Day Holiday", "国庆日补假", "國慶日補假"),
    holiday("2026-11-08", "Deepavali", "屠妖节", "屠妖節"),
    holiday("2026-11-09", "Deepavali Holiday", "屠妖节补假", "屠妖節補假"),
    holiday("2026-12-25", "Christmas Day", "圣诞节", "聖誕節"),
  ]],
  // Ministry of Manpower, 18 June 2026:
  // https://www.mom.gov.sg/newsroom/press-releases/2026/0618-public-holidays-for-2027
  [2027, [
    holiday("2027-01-01", "New Year's Day", "元旦", "元旦"),
    holiday("2027-02-06", "Chinese New Year", "农历新年", "農曆新年"),
    holiday("2027-02-07", "Chinese New Year", "农历新年", "農曆新年"),
    holiday(
      "2027-02-08",
      "Chinese New Year Holiday",
      "农历新年补假",
      "農曆新年補假",
    ),
    holiday("2027-03-10", "Hari Raya Puasa", "开斋节", "開齋節"),
    holiday("2027-03-26", "Good Friday", "耶稣受难日", "耶穌受難日"),
    holiday("2027-05-01", "Labour Day", "劳动节", "勞動節"),
    holiday("2027-05-17", "Hari Raya Haji", "哈芝节", "哈芝節"),
    holiday("2027-05-20", "Vesak Day", "卫塞节", "衛塞節"),
    holiday("2027-08-09", "National Day", "国庆日", "國慶日"),
    holiday("2027-10-28", "Deepavali", "屠妖节", "屠妖節"),
    holiday("2027-12-25", "Christmas Day", "圣诞节", "聖誕節"),
  ]],
]);

export function getSingaporeHolidayDay(
  date: LocalDate,
  locale: string,
): SingaporeHolidayDay {
  const entries = HOLIDAYS_BY_YEAR.get(date.year);
  if (entries === undefined) {
    return Object.freeze({ coverage: "unavailable", holidays: EMPTY_HOLIDAYS });
  }

  const dateKey = formatLocalDateKey(date);
  const resolvedLocale = resolveRegionalHolidayLocale(locale);
  const holidays = entries
    .filter((entry) => entry.date === dateKey)
    .map((entry) => Object.freeze({
      region: "sg" as const,
      name: entry.names[resolvedLocale],
    }));

  return Object.freeze({
    coverage: "available",
    holidays: holidays.length === 0 ? EMPTY_HOLIDAYS : Object.freeze(holidays),
  });
}

export function getSingaporeHolidayYearCoverage(year: number): HolidayDataCoverage {
  return HOLIDAYS_BY_YEAR.has(year) ? "available" : "unavailable";
}

function holiday(
  date: string,
  en: string,
  zhCN: string,
  zhTW: string,
): SingaporeHolidayEntry {
  return Object.freeze({
    date,
    names: Object.freeze({ en, "zh-CN": zhCN, "zh-TW": zhTW }),
  });
}
