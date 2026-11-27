import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseLocalDateKey } from "../../src/core/periodic/periodic-date";
import { AMERICAS } from "../../src/core/calendar/holiday-data/americas";
import { EAST_ASIA } from "../../src/core/calendar/holiday-data/east-asia";
import { EUROPE } from "../../src/core/calendar/holiday-data/europe";
import { SOUTH_AND_SOUTHEAST_ASIA } from "../../src/core/calendar/holiday-data/south-and-southeast-asia";
import type { HolidaySchedule } from "../../src/core/calendar/holiday-data/schedule";
import {
  getHolidayPublicationSource,
  getPublishedHolidayDay,
  getPublishedHolidayYearCoverage,
  PUBLISHED_HOLIDAY_REGIONS,
  type PublishedHolidayRegion,
} from "../../src/core/calendar/published-holidays";

function day(region: PublishedHolidayRegion, key: string, locale = "en") {
  const date = parseLocalDateKey(key);
  if (date === null) throw new Error(`Invalid test date: ${key}`);
  return getPublishedHolidayDay(region, date, locale);
}

const counts: Record<PublishedHolidayRegion, readonly [number, number]> = {
  tw: [22, 24], hk: [17, 17], mo: [20, 20], jp: [18, 17], kr: [22, 24],
  us: [11, 12], br: [9, 9], "gb-eng-wls": [8, 8], "gb-sct": [10, 9],
  "gb-nir": [10, 10], de: [9, 9], fr: [11, 11], es: [8, 9], ru: [18, 21],
  in: [18, 17], vn: [17, 16], at: [13, 13], pt: [13, 13], mx: [7, 8], "ca-qc": [9, 9],
};

const verified2028Counts: Partial<Record<PublishedHolidayRegion, number>> = {
  us: 10, "gb-eng-wls": 8, "gb-sct": 9, "gb-nir": 10, fr: 11, at: 13, br: 9, "ca-qc": 9, pt: 13, de: 9,
};

describe("published holiday schedules", () => {
  it.each([
    ["mo", "pt"], ["jp", "ja"], ["kr", "ko"], ["br", "pt"], ["mx", "es"], ["ca-qc", "fr"],
    ["de", "de"], ["fr", "fr"], ["es", "es"], ["ru", "ru"], ["at", "de"], ["pt", "pt"],
    ["in", "hi"], ["vn", "vi"],
  ] as const)("returns every local name supplied by %s in %s", (region, language) => {
    const schedules = { ...EAST_ASIA, ...AMERICAS, ...EUROPE, ...SOUTH_AND_SOUTHEAST_ASIA };
    const schedule: HolidaySchedule = schedules[region];
    for (const entry of schedule.entries) {
      const name = entry.names?.[language];
      expect(name, entry.en).toMatch(/\S/u);
      const actual = day(region, entry.dates[0]!, language);
      if (entry.kind === "work") expect(actual.workday?.name).toBe(name);
      else expect(actual.holidays.map(holiday => holiday.name)).toContain(name);
    }
  });

  it.each(PUBLISHED_HOLIDAY_REGIONS)("checks every covered civil year for %s", (region) => {
    const annualCounts: number[] = [];
    const count2028 = verified2028Counts[region];
    for (const year of count2028 === undefined ? [2026, 2027] : [2026, 2027, 2028]) {
      expect(getPublishedHolidayYearCoverage(region, year)).toBe("available");
      expect(getHolidayPublicationSource(region, year)).toMatchObject({
        status: "published", sourceUrl: expect.stringMatching(/^https:\/\//),
      });
      let count = 0;
      for (let month = 1; month <= 12; month++) {
        const length = new Date(Date.UTC(year, month, 0)).getUTCDate();
        for (let date = 1; date <= length; date++) {
          const civilDate = { year, month, day: date };
          const actual = getPublishedHolidayDay(region, civilDate, "en");
          count += actual.holidays.length + Number(actual.workday?.isWorkday === true);
          expect(new Set(actual.holidays.map((holiday) => holiday.name)).size).toBe(actual.holidays.length);
          if (actual.holidays.length > 0 || actual.workday !== null) {
            expect(getPublishedHolidayDay(region, civilDate, "sv-SE")).toEqual(actual);
            for (const locale of ["zh-Hans", "zh-Hant"]) {
              const translated = getPublishedHolidayDay(region, civilDate, locale);
              expect(translated.holidays).toEqual(actual.holidays.map(holiday => ({
                ...holiday, name: expect.stringMatching(/\p{Script=Han}/u),
              })));
              expect(translated.workday).toEqual(actual.workday && {
                ...actual.workday, name: expect.stringMatching(/\p{Script=Han}/u),
              });
            }
          }
        }
      }
      annualCounts.push(count);
    }
    expect(annualCounts).toEqual(count2028 === undefined ? counts[region] : [...counts[region], count2028]);
    if (count2028 === undefined) {
      expect(getPublishedHolidayYearCoverage(region, 2028)).toBe("unavailable");
      const source = getHolidayPublicationSource(region, 2028);
      if (source !== null) expect(source.status).toBe("not-published");
      expect(day(region, "2028-01-01")).toEqual({ holidays: [], workday: null });
    }
  });

  it("retains observed dates and distinct jurisdictions", () => {
    expect(day("us", "2027-12-31").holidays[0]?.name).toBe("New Year’s Day (observed)");
    expect(day("gb-sct", "2026-06-15").holidays[0]?.name).toBe("World Cup bank holiday");
    expect(day("gb-eng-wls", "2026-06-15").holidays).toEqual([]);
    expect(day("gb-nir", "2027-03-17").holidays[0]?.name).toBe("St Patrick’s Day");
    expect(day("gb-eng-wls", "2027-03-17").holidays).toEqual([]);
    expect(day("de", "2027-10-31").holidays).toEqual([]);
    expect(day("es", "2027-03-25").holidays).toEqual([]);
    expect(day("fr", "2027-03-26").holidays).toEqual([]);
    expect(day("br", "2027-02-09").holidays).toEqual([]);
    expect(day("mo", "2027-02-09").holidays).toEqual([]);
    expect(day("mo", "2027-02-05").holidays).toEqual([]);
  });

  it("matches every row of the Japanese Cabinet Office archive through 2027", () => {
    // Independent digest of the official CSV mapped to ISO-date + space + unmodified Japanese name.
    const rows: string[] = [];
    for (let year = 1955; year <= 2027; year++) {
      expect(getPublishedHolidayYearCoverage("jp", year)).toBe("available");
      expect(getHolidayPublicationSource("jp", year)?.status).toBe("published");
      for (let stamp = Date.UTC(year, 0, 1); stamp < Date.UTC(year + 1, 0, 1); stamp += 86_400_000) {
        const key = new Date(stamp).toISOString().slice(0, 10);
        for (const { name } of day("jp", key, "ja").holidays) {
          let csvName = name;
          if (name === "振替休日" || name === "国民の休日") csvName = "休日";
          if (key === "2019-05-01" || key === "2019-10-22") csvName = "休日（祝日扱い）";
          rows.push(key + " " + csvName);
        }
      }
    }
    expect(rows).toHaveLength(1067);
    expect(createHash("sha256").update(rows.join("\n")).digest("hex"))
      .toBe("19d50a4fb1d3becc92b881f32813b844a38dd4106f132e50b79329fd43ed0307");
    expect(getPublishedHolidayYearCoverage("jp", 1954)).toBe("unavailable");
  });

  it("preserves Japan’s historic holiday names, transfers and one-off celebrations", () => {
    expect(day("jp", "1955-01-01", "ja").holidays[0]?.name).toBe("元日");
    expect(day("jp", "1959-04-10", "zh-TW").holidays[0]?.name).toBe("皇太子婚禮");
    expect(day("jp", "1987-05-04", "ja").workday).toEqual({ region: "jp", name: "振替休日", isWorkday: false });
    expect(day("jp", "1988-05-04", "ja").holidays[0]?.name).toBe("国民の休日");
    expect(day("jp", "1989-02-24", "fr").holidays[0]?.name).toBe("State funeral of Emperor Shōwa");
    expect(day("jp", "2019-04-30", "ja").holidays[0]?.name).toBe("国民の休日");
    expect(day("jp", "2019-05-01", "ja").holidays[0]?.name).toBe("天皇の即位の日");
    expect(day("jp", "2019-10-22", "zh-CN").holidays[0]?.name).toBe("即位礼正殿之仪");
    expect(day("jp", "2021-07-23", "ja").holidays[0]?.name).toBe("スポーツの日");
    expect(day("jp", "2021-10-11").holidays).toEqual([]);
    expect(day("jp", "2025-05-05", "ja").holidays[0]?.name).toBe("こどもの日");
  });

  it("includes exactly the nationwide German holidays in 2028", () => {
    for (const [key, name] of [
      ["2028-01-01", "Neujahr"], ["2028-04-14", "Karfreitag"], ["2028-04-17", "Ostermontag"],
      ["2028-05-01", "Tag der Arbeit"], ["2028-05-25", "Christi Himmelfahrt"], ["2028-06-05", "Pfingstmontag"],
      ["2028-10-03", "Tag der Deutschen Einheit"], ["2028-12-25", "Erster Weihnachtsfeiertag"],
      ["2028-12-26", "Zweiter Weihnachtsfeiertag"],
    ] as const) expect(day("de", key, "de-DE").holidays[0]?.name).toBe(name);
    for (const key of ["2028-01-03", "2028-06-15", "2028-06-17", "2028-12-24"]) {
      expect(day("de", key).holidays).toEqual([]);
    }
  });

  it("keeps 2028 substitute days and regional differences distinct", () => {
    expect(day("us", "2028-01-01").holidays).toEqual([]);
    expect(day("us", "2028-11-10").holidays[0]?.name).toBe("Veterans Day (observed)");
    expect(day("us", "2028-11-11").holidays).toEqual([]);
    expect(day("gb-eng-wls", "2028-01-03", "zh-TW").holidays[0]?.name).toBe("元旦（補假）");
    expect(day("gb-eng-wls", "2028-01-04").holidays).toEqual([]);
    expect(day("gb-sct", "2028-01-04").holidays[0]?.name).toBe("2nd January (substitute day)");
    expect(day("gb-sct", "2028-04-17").holidays).toEqual([]);
    expect(day("gb-nir", "2028-04-17").holidays[0]?.name).toBe("Easter Monday");
    expect(day("gb-eng-wls", "2028-12-26").holidays[0]?.name).toBe("Boxing Day");
    expect(day("fr", "2028-06-05", "fr").holidays[0]?.name).toBe("Lundi de Pentecôte");
  });

  it("keeps statutory scope and cross-year substitutes in the 2028 rollover", () => {
    expect(day("br", "2028-11-20", "pt-BR").holidays[0]?.name)
      .toBe("Dia Nacional de Zumbi e da Consciência Negra");
    expect(day("br", "2028-02-29").holidays).toEqual([]);
    expect(day("ca-qc", "2028-04-14").holidays[0]?.conditional).toBe(true);
    expect(day("ca-qc", "2028-04-17").holidays[0]?.conditional).toBe(true);
    expect(day("ca-qc", "2028-07-01", "fr-CA").holidays[0]?.name).toBe("Fête du Canada");
    expect(day("ca-qc", "2028-07-03").holidays).toEqual([]);
    expect(day("pt", "2028-06-15", "pt-PT").holidays[0]?.name).toBe("Corpo de Deus");
    expect(day("pt", "2028-04-14").holidays[0]?.name)
      .toBe("Good Friday (may be observed on another local Easter date)");
    expect(day("tw", "2027-12-31", "zh-TW").holidays[0]?.name).toBe("補假");
    expect(day("tw", "2028-01-01").holidays).toEqual([]);
  });

  it("shows Austria’s nationwide schedule without inventing a weekend substitute", () => {
    expect(day("at", "2028-01-01", "de-AT").holidays[0]?.name).toBe("Neujahr");
    expect(day("at", "2028-01-03").holidays).toEqual([]);
    expect(day("at", "2028-04-17", "de-AT").holidays[0]?.name).toBe("Ostermontag");
    expect(day("at", "2028-06-15", "zh-TW").holidays[0]?.name).toBe("基督聖體節");
  });

  it("separates local and employer-specific alternatives from nationwide dates", () => {
    expect(day("at", "2027-10-26", "de-AT").holidays[0]?.name).toBe("Nationalfeiertag");
    expect(day("de", "2027-10-26").holidays).toEqual([]);
    expect(day("pt", "2027-03-28", "pt-PT").holidays[0]?.name).toBe("Domingo de Páscoa");
    expect(day("pt", "2027-02-09").holidays).toEqual([]);
    expect(day("mx", "2027-06-06", "es-MX").holidays[0]?.name).toBe("Jornada electoral federal");
    expect(day("mx", "2026-06-07").holidays).toEqual([]);
    for (const key of ["2027-03-26", "2027-03-29"]) {
      expect(day("ca-qc", key, "fr-CA")).toEqual({
        holidays: [{ region: "ca-qc", name: expect.stringContaining("au choix de l’employeur"), conditional: true }],
        workday: null,
      });
    }
    expect(day("ca-qc", "2027-06-24", "fr-CA").holidays).toEqual([
      { region: "ca-qc", name: "Fête nationale du Québec" },
    ]);
  });

  it("applies the authorities’ additions, date changes and working-day swaps", () => {
    expect(day("kr", "2026-05-01", "ko-KR").holidays[0]?.name).toBe("노동절");
    expect(day("kr", "2026-07-17", "ko-KR").holidays[0]?.name).toBe("제헌절");
    expect(day("in", "2026-05-27").holidays).toEqual([]);
    expect(day("in", "2026-05-28").holidays[0]?.name).toBe("Eid al-Adha (Bakrid)");
    expect(day("in", "2027-08-15").holidays.map((h) => h.name)).toEqual(["Independence Day", "Eid-e-Milad"]);
    expect(day("in", "2026-04-14").holidays[0]?.name).toContain("Ambedkar");
    expect(day("vn", "2026-11-24", "vi-VN").holidays[0]?.name).toBe("Ngày Văn hóa Việt Nam");
    expect(day("vn", "2026-07-27", "vi-VN").holidays).toEqual([]);
    expect(day("vn", "2027-07-27", "vi-VN").holidays[0]?.name)
      .toBe("Ngày Tổ quốc tri ân – Ngày Thương binh, liệt sĩ");
    expect(day("vn", "2027-07-27", "es-ES").holidays[0]?.name)
      .toBe("National Gratitude Day (War Invalids and Martyrs Day)");
    expect(day("vn", "2027-07-27", "zh-CN").holidays[0]?.name)
      .toBe("国家感恩日（伤残军人与烈士纪念日）");
    expect(day("vn", "2027-07-27", "zh-TW").holidays[0]?.name)
      .toBe("國家感恩日（傷殘軍人與烈士紀念日）");
    for (const [region, date] of [["vn", "2026-01-10"], ["vn", "2026-08-22"], ["ru", "2027-02-20"]] as const) {
      const working = day(region, date);
      expect(working.holidays).toEqual([]);
      expect(working.workday?.isWorkday).toBe(true);
    }
    expect(day("ru", "2027-02-22").workday?.isWorkday).toBe(false);
  });

  it("localizes the published name and preserves regional and legally distinct dates", () => {
    expect(day("hk", "2027-09-15").holidays).toEqual([]);
    expect(day("hk", "2027-09-16", "zh-Hant").holidays[0]?.name).toBe("中秋節翌日");
    expect(day("hk", "2027-09-16", "zh-CN").holidays[0]?.name).toBe("中秋节翌日");
    expect(day("hk", "2027-09-16", "zh_MO").holidays[0]?.name).toBe("中秋節翌日");
    expect(day("hk", "2027-09-16", "zh-Hans-MO").holidays[0]?.name).toBe("中秋节翌日");
    expect(day("hk", "2027-09-16", "en-x-hant")).toEqual(day("hk", "2027-09-16", "en"));
    expect(day("tw", "2027-09-15", "zh-TW").holidays[0]?.name).toBe("中秋節");
    expect(day("tw", "2027-12-31", "zh-Hant").workday).toEqual({ region: "tw", name: "補假", isWorkday: false });
    expect(day("jp", "2026-09-22", "ja-JP").holidays[0]?.name).toBe("国民の休日");
    expect(day("jp", "2026-05-06", "ja-JP").holidays[0]?.name).toBe("振替休日");
    expect(day("jp", "2026-05-06", "ja_JP")).toEqual(day("jp", "2026-05-06", "ja"));
    expect(day("mo", "2027-01-01", "pt-BR").holidays[0]?.name).toBe("Fraternidade Universal");
    expect(day("jp", "2026-05-06", "ar")).toEqual(day("jp", "2026-05-06", "en"));
    const result = day("jp", "2026-05-06");
    for (const value of [result, result.holidays, result.holidays[0], result.workday]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
  });
});
