import { compareLocalDate, toUtcDate, type LocalDate } from "../periodic/periodic-date";
import { calendarLanguageKey } from "./content-locale";
import type { CalendarExtensionResult } from "./calendar-extension";

export type SupplementaryCalendarId = "japanese-era" | "french-republican" | "chol-qij";

const DAY_MILLIS = 86_400_000;
const NO_EVENTS = Object.freeze([]);
const REPUBLIC_START = { year: 1792, month: 9, day: 22 };
const REPUBLIC_END = { year: 1805, month: 12, day: 31 };

// Archives départementales du Gard: Table de concordance détaillée du calendrier républicain.
// 1 vendémiaire fell in September in each of the fourteen historical years. No leap rule is extrapolated.
const REPUBLICAN_SEPTEMBER_STARTS = [22, 22, 22, 23, 22, 22, 22, 23, 23, 23, 23, 24, 23, 23] as const;
const REPUBLICAN_YEARS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV"] as const;
const REPUBLICAN_MONTHS = [
  "vendémiaire", "brumaire", "frimaire", "nivôse", "pluviôse", "ventôse",
  "germinal", "floréal", "prairial", "messidor", "thermidor", "fructidor",
] as const;

const REPUBLICAN_MONTHS_ZH = {
  "zh-CN": ["葡月", "雾月", "霜月", "雪月", "雨月", "风月", "芽月", "花月", "牧月", "获月", "热月", "果月"],
  "zh-TW": ["葡月", "霧月", "霜月", "雪月", "雨月", "風月", "芽月", "花月", "牧月", "獲月", "熱月", "果月"],
} as const;

// Contemporary K’iche’ spellings from Guatemala's Ministry of Culture,
// Armonización de los calendarios mayas, cuadro 1. Keep the original day names.
const CHOL_QIJ_DAYS = [
  "Imox", "Iq’", "Aq’ab’al", "K’at", "Kan", "Kame", "Kej", "Q’anil", "Toj", "Tz’i’",
  "B’atz’", "E’", "Aj", "Ix", "Tz’ikin", "Ajmaq", "No’j", "Tijax", "Kawoq", "Ajpu’",
] as const;
const FOUR_AJPU = Date.UTC(2012, 11, 21);

interface JapaneseEraFormatters {
  readonly year: Intl.DateTimeFormat;
  readonly full: Intl.DateTimeFormat;
}
const eraFormats = new Map<string, JapaneseEraFormatters | null>();

function japaneseEraFormatters(locale: string): JapaneseEraFormatters | null {
  const cached = eraFormats.get(locale);
  if (cached !== undefined) return cached;
  let result: JapaneseEraFormatters | null = null;
  try {
    const options = { calendar: "japanese", timeZone: "UTC", year: "numeric", era: "short" } as const;
    const year = new Intl.DateTimeFormat(locale, options);
    const before = year.formatToParts(Date.UTC(2019, 3, 30)).find((p) => p.type === "era")?.value;
    const after = year.formatToParts(Date.UTC(2019, 4, 1)).find((p) => p.type === "era")?.value;
    if (year.resolvedOptions().calendar === "japanese" && before && after && before !== after) {
      result = { year, full: new Intl.DateTimeFormat(locale, { ...options, month: "long", day: "numeric" }) };
    }
  } catch {
    // A reduced ICU build can lack the calendar or reject the locale.
  }
  if (eraFormats.size >= 32) eraFormats.clear();
  eraFormats.set(locale, result);
  return result;
}

export function isSupplementaryCalendarSupported(id: SupplementaryCalendarId, locale: string): boolean {
  return id !== "japanese-era" || japaneseEraFormatters(locale) !== null;
}

export function isSupplementaryCalendarDateSupported(date: LocalDate, id: SupplementaryCalendarId): boolean {
  if (id === "japanese-era") return date.year >= 1873 && date.year <= 9999;
  if (id === "french-republican") {
    return compareLocalDate(date, REPUBLIC_START) >= 0 && compareLocalDate(date, REPUBLIC_END) <= 0;
  }
  return date.year >= 0 && date.year <= 9999;
}

function japaneseEraDay(date: LocalDate, formats: JapaneseEraFormatters, stamp: number): CalendarExtensionResult {
  const dateText = formats.year.format(stamp);
  const yearChanged = (date.month === 1 && date.day === 1) || dateText !== formats.year.format(stamp - DAY_MILLIS);
  return {
    dateText,
    accessibilityText: formats.full.format(stamp),
    transition: yearChanged ? "year-month" : date.day === 1 ? "month" : null,
    events: NO_EVENTS,
  };
}

function republicanDay(date: LocalDate, stamp: number, locale: string): CalendarExtensionResult {
  let year = date.year - REPUBLIC_START.year;
  const yearStart = (index: number) => Date.UTC(
    REPUBLIC_START.year + index, 8, REPUBLICAN_SEPTEMBER_STARTS[index],
  );
  if (stamp < yearStart(year)) year--;
  const daysSinceNewYear = (stamp - yearStart(year)) / DAY_MILLIS;
  const month = Math.floor(daysSinceNewYear / 30);
  const day = daysSinceNewYear % 30 + 1;
  const language = calendarLanguageKey(locale);
  const label = REPUBLICAN_MONTHS[month];
  const transition = day === 1 ? month === 0 ? "year-month" : "month" : null;
  let dateText: string;
  let accessibilityText: string;
  if (language === "zh-CN" || language === "zh-TW") {
    const monthName = REPUBLICAN_MONTHS_ZH[language][month];
    const dayAndMonth = monthName === undefined
      ? `${language === "zh-TW" ? "補充日" : "补充日"}第${day}日` : `${monthName}${day}日`;
    accessibilityText = `共和${year === 0 ? "元" : year + 1}年${dayAndMonth}`;
    dateText = day === 1 || monthName === undefined ? dayAndMonth : `${day}日`;
  } else if (language === "fr") {
    const ordinal = day === 1 ? "1er" : String(day);
    const complementaryOrdinal = day === 1 ? "1er" : `${day}e`;
    const dayAndMonth = label === undefined ? `${complementaryOrdinal} jour complémentaire` : `${ordinal} ${label}`;
    accessibilityText = `${dayAndMonth} an ${REPUBLICAN_YEARS[year]}`;
    dateText = label === undefined ? `${complementaryOrdinal} compl.` : day === 1 ? dayAndMonth : ordinal;
  } else {
    const dayAndMonth = label === undefined
      ? `Complementary day ${day}` : `${day} ${label.charAt(0).toUpperCase()}${label.slice(1)}`;
    accessibilityText = `${dayAndMonth}, Year ${REPUBLICAN_YEARS[year]}`;
    dateText = day === 1 || label === undefined ? dayAndMonth : String(day);
  }
  return {
    dateText: transition === "year-month" ? accessibilityText : dateText,
    accessibilityText, transition, events: NO_EVENTS,
  };
}

function modulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

export function getSupplementaryCalendarDay(
  date: LocalDate,
  locale: string,
  id: SupplementaryCalendarId,
): CalendarExtensionResult {
  if (!isSupplementaryCalendarDateSupported(date, id)) throw new RangeError(`Unsupported date for ${id}`);
  const stamp = toUtcDate(date).getTime();
  if (id === "japanese-era") {
    const formats = japaneseEraFormatters(locale);
    if (!formats) throw new RangeError("Japanese era calendar unavailable");
    return japaneseEraDay(date, formats, stamp);
  }
  if (id === "french-republican") return republicanDay(date, stamp, locale);
  // Relative civil-day number, not elapsed time in the host time zone. The
  // continuous 13-by-20 count is anchored to Guatemala's 4 Ajpu’ on 2012-12-21.
  const offset = (stamp - FOUR_AJPU) / DAY_MILLIS;
  const number = 1 + modulo(3 + offset, 13);
  const name = CHOL_QIJ_DAYS[modulo(19 + offset, 20)];
  const language = calendarLanguageKey(locale);
  const chinese = language === "zh-CN" || language === "zh-TW";
  const dateText = chinese ? `${number} · ${name}日` : `${number} ${name}`;
  let accessibilityText = dateText;
  if (chinese) accessibilityText = `日名 ${name}，${language === "zh-TW" ? "曆數" : "历数"} ${number}`;
  else if (language === "es") accessibilityText = `Signo del día ${name}, número ${number}`;
  else if (language !== "quc") accessibilityText = `Day sign ${name}, number ${number}`;
  return { dateText, accessibilityText, transition: null, events: NO_EVENTS };
}
