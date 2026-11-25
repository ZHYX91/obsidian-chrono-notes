import { toUtcDate, type LocalDate } from "../periodic/periodic-date";
import { toJulianDate } from "./julian";

export const OBSERVANCE_GROUPS = [
  "western", "orthodox", "nowruz", "hebrew-feasts", "ethiopian-new-year",
] as const;
export type ObservanceGroup = typeof OBSERVANCE_GROUPS[number];
export type ObservanceName = "goodFriday" | "easter" | "pentecost" | "christmas" |
  "advent" | "nowruz" | "roshHashanah" | "yomKippur" | "passover" | "enkutatash";

export function isObservanceGroup(value: unknown): value is ObservanceGroup {
  return OBSERVANCE_GROUPS.some(group => group === value);
}

const DAY_MS = 86_400_000;
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function lunarOrSolarParts(date: LocalDate, calendar: string): Intl.DateTimeFormatPart[] {
  let formatter = dateFormatters.get(calendar);
  if (formatter === undefined) {
    try {
      formatter = new Intl.DateTimeFormat("en-u-nu-latn", {
        calendar, timeZone: "UTC", day: "numeric", month: calendar === "hebrew" ? "long" : "numeric",
      });
      if (formatter.resolvedOptions().calendar !== calendar) return [];
      dateFormatters.set(calendar, formatter);
    } catch {
      return [];
    }
  }
  return formatter.formatToParts(toUtcDate(date));
}

/** Gregorian ecclesiastical tables, Oudin's algorithm (US Naval Observatory).
 * Orthodox Pascha uses the Julian tables. Both return UTC civil midnight.
 * https://aa.usno.navy.mil/faq/easter
 */
function easter(year: number, orthodox: boolean): number {
  const goldenIndex = year % 19;
  if (orthodox) {
    const moon = (19 * goldenIndex + 15) % 30;
    const weekday = (2 * (year % 4) + 4 * (year % 7) - moon + 34) % 7;
    const marchDay = 22 + moon + weekday;
    const offset = Math.floor(year / 100) - Math.floor(year / 400) - 2;
    return Date.UTC(year, 2, marchDay + offset);
  }
  const century = Math.floor(year / 100);
  const lunarCorrection = Math.floor((century - 17) / 25);
  let moon = century - Math.floor(century / 4) -
    Math.floor((century - lunarCorrection) / 3) + 19 * goldenIndex + 15;
  moon %= 30;
  moon -= Math.floor(moon / 28) * (1 - Math.floor(moon / 28) *
    Math.floor(29 / (moon + 1)) * Math.floor((21 - goldenIndex) / 11));
  const weekday = (year + Math.floor(year / 4) + moon + 2 - century + Math.floor(century / 4)) % 7;
  return Date.UTC(year, 2, 28 + moon - weekday);
}

export function getObservance(date: LocalDate, group: ObservanceGroup): ObservanceName | null {
  if (group === "western" || group === "orthodox") {
    // Scope of the modern church conventions. Historical jurisdictions can differ.
    if (date.year < 1583 || date.year > 4099) return null;
    const orthodox = group === "orthodox";
    const fixed = orthodox ? toJulianDate(date) : date;
    if (fixed.month === 12 && fixed.day === 25) return "christmas";
    const civil = toUtcDate(date);
    if (!orthodox && civil.getUTCDay() === 0 && (
      (date.month === 11 && date.day >= 27) || (date.month === 12 && date.day <= 3)
    )) return "advent";
    const delta = (civil.getTime() - easter(date.year, orthodox)) / DAY_MS;
    if (delta === -2) return "goodFriday";
    if (delta === 0) return "easter";
    return delta === 49 ? "pentecost" : null;
  }
  const calendar = group === "nowruz" ? "persian" :
    group === "ethiopian-new-year" ? "ethiopic" : "hebrew";
  const parts = lunarOrSolarParts(date, calendar);
  const month = parts.find(part => part.type === "month")?.value;
  const day = Number(parts.find(part => part.type === "day")?.value);
  if (group === "nowruz") return month === "1" && day === 1 ? "nowruz" : null;
  if (group === "ethiopian-new-year") return month === "1" && day === 1 ? "enkutatash" : null;
  if (month === "Tishri" || month === "Tishrei") {
    if (day === 1) return "roshHashanah";
    if (day === 10) return "yomKippur";
  }
  return month === "Nisan" && day === 15 ? "passover" : null;
}
