import { describe, expect, it } from "vitest";

import {
  getSupplementaryCalendarDay,
  isSupplementaryCalendarDateSupported,
  isSupplementaryCalendarSupported,
} from "../../src/core/calendar/supplementary-calendars";
import type { LocalDate } from "../../src/core/periodic/periodic-date";

function local(iso: string): LocalDate {
  const day = new Date(iso);
  return { year: day.getUTCFullYear(), month: day.getUTCMonth() + 1, day: day.getUTCDate() };
}

describe("Japanese era-year display", () => {
  // https://www.ndl.go.jp/koyomi/e/history/calendar.html
  // https://github.com/unicode-org/cldr/blob/main/common/supplemental/supplementalData.xml
  it.each([
    ["1873-01-01", "明治6年", "year-month"],
    ["1912-07-29", "明治45年", null],
    ["1912-07-30", "大正元年", "year-month"],
    ["1926-12-25", "昭和元年", "year-month"],
    ["1989-01-08", "平成元年", "year-month"],
    ["2019-04-30", "平成31年", null],
    ["2019-05-01", "令和元年", "year-month"],
    ["2019-05-02", "令和元年", null],
    ["2020-01-01", "令和2年", "year-month"],
    ["2020-02-01", "令和2年", "month"],
  ] as const)("renders the era and year on %s", (iso, expected, transition) => {
    const info = getSupplementaryCalendarDay(local(iso), "ja", "japanese-era");
    expect(info.dateText).toBe(expected);
    expect(info.accessibilityText).toContain(expected);
    expect(info.transition).toBe(transition);
  });

  it("localizes the era and skips unsupported locale or historical inputs", () => {
    expect(isSupplementaryCalendarSupported("japanese-era", "ja")).toBe(true);
    expect(isSupplementaryCalendarSupported("japanese-era", "bad_locale")).toBe(false);
    expect(() => getSupplementaryCalendarDay(local("2019-05-01"), "bad_locale", "japanese-era")).toThrow(RangeError);
    const info = getSupplementaryCalendarDay(local("2019-05-02"), "en", "japanese-era");
    expect(info.dateText).toMatch(/1.*Reiwa|Reiwa.*1/);
    expect(info.accessibilityText).toContain("May");
    expect(isSupplementaryCalendarDateSupported(local("1872-12-31"), "japanese-era")).toBe(false);
  });
});

describe("historical French Republican calendar", () => {
  // Archives départementales du Gard, complete historical concordance:
  // https://archives.gard.fr/fileadmin/mediatheque-satellite/archives/documents/02_RECHERCHER/01_Boite-a-outils/Calendrier-republicain/Archives-dep-Gard_Calendrier-republicain_Tableau-complet.pdf
  it.each([
    ["1792-09-22", "1er vendémiaire an I"],
    ["1793-09-21", "5e jour complémentaire an I"],
    ["1793-09-22", "1er vendémiaire an II"],
    ["1794-07-27", "9 thermidor an II"],
    ["1795-09-22", "6e jour complémentaire an III"],
    ["1795-09-23", "1er vendémiaire an IV"],
    ["1799-09-22", "6e jour complémentaire an VII"],
    ["1799-11-09", "18 brumaire an VIII"],
    ["1803-09-23", "6e jour complémentaire an XI"],
    ["1805-12-31", "10 nivôse an XIV"],
  ])("matches the archival concordance on %s", (iso, full) => {
    expect(getSupplementaryCalendarDay(local(iso), "fr", "french-republican").accessibilityText).toBe(full);
  });

  it.each(["1792-09-22", "1793-09-21"])("localizes regular and complementary dates on %s", (iso) => {
    const day = (locale: string) => getSupplementaryCalendarDay(local(iso), locale, "french-republican");
    const english = day("en");
    expect(english.accessibilityText).toMatch(/year/i);
    expect(day("ja-JP")).toEqual(english);
    expect(day("fr-CA").accessibilityText).toBe(day("fr").accessibilityText);
    for (const locale of ["zh-Hans", "zh-Hant"]) {
      expect(day(locale).dateText).toMatch(/\p{Script=Han}/u);
      expect(day(locale).accessibilityText).toMatch(/\p{Script=Han}/u);
      expect(day(locale).transition).toBe(english.transition);
    }
  });

  it("keeps the primary national period bounded and handles the end of an ordinary month", () => {
    for (const iso of ["1792-09-21", "1806-01-01", "1871-05-16"]) {
      expect(isSupplementaryCalendarDateSupported(local(iso), "french-republican")).toBe(false);
      expect(() => getSupplementaryCalendarDay(local(iso), "fr", "french-republican")).toThrow(RangeError);
    }
    const first = getSupplementaryCalendarDay(local("1792-10-22"), "fr", "french-republican");
    expect(first.dateText).toBe("1er brumaire");
    expect(first.transition).toBe("month");
  });
});

describe("K’iche’ Chol Q’ij", () => {
  // Guatemala, Armonización de los calendarios mayas (table 1 and dated observations):
  // https://www.sicultura.gob.gt/wp-content/uploads/2021/06/Armonizacion-de-los-Calendarios-Mayas-1.pdf
  // 4 Ajpu’ anchor: Guatemala's National Development Plan K’atun, 2032.
  // https://faolex.fao.org/docs/pdf/gua143736.pdf
  it.each([
    ["1722-05-03", "9 Kej"],
    ["1927-06-10", "2 Kawoq"],
    ["1977-03-02", "4 Iq’"],
    ["2012-12-12", "8 B’atz’"],
    ["2012-12-20", "3 Kawoq"],
    ["2012-12-21", "4 Ajpu’"],
    ["2012-12-22", "5 Imox"],
    ["2020-10-11", "8 B’atz’"],
  ])("matches recorded counts on %s", (iso, expected) => {
    expect(getSupplementaryCalendarDay(local(iso), "quc-GT", "chol-qij").dateText).toBe(expected);
  });

  it("retains the K’iche’ day name while localizing the surrounding text", () => {
    const day = (locale: string) => getSupplementaryCalendarDay(local("2012-12-21"), locale, "chol-qij");
    expect(day("quc-GT").dateText).toBe("4 Ajpu’");
    expect(day("en").accessibilityText).toContain("Ajpu’");
    expect(day("ja")).toEqual(day("en"));
    for (const locale of ["zh-Hans", "zh-Hant"]) {
      const result = day(locale);
      for (const label of [result.dateText, result.accessibilityText]) {
        expect(label).toContain("Ajpu’");
        expect(label).toMatch(/\p{Script=Han}/u);
      }
    }
  });

  it("returns each of the 260 day names and numbers once before the cycle repeats", () => {
    const seen = new Set<string>();
    const start = Date.UTC(2012, 11, 21);
    for (let n = 0; n < 260; n++) {
      const iso = new Date(start + n * 86_400_000).toISOString();
      seen.add(getSupplementaryCalendarDay(local(iso), "quc-GT", "chol-qij").dateText);
    }
    expect(seen.size).toBe(260);
    expect(getSupplementaryCalendarDay(local(new Date(start + 260 * 86_400_000).toISOString()), "quc-GT", "chol-qij").dateText)
      .toBe("4 Ajpu’");
  });
});
