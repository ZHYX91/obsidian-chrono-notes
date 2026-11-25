// Run from the repository root after npm ci. Use --check to detect stale data.
// Astronomy: lunar-typescript's ShouXingUtil longitude solvers (lockfile version).
// Vietnamese month rules: https://www.informatik.uni-leipzig.de/~duc/amlich/calrules_en.html
// Japanese month rules and the recommended 2033 leap eleventh month:
// https://www.nao.ac.jp/news/blog/2023/20230829-koyomi.html
import { readFileSync, writeFileSync } from "node:fs";
import { ShouXingUtil } from "lunar-typescript";

const dayMillis = 86_400_000;
const j2000 = Date.UTC(2000, 0, 1, 12) / dayMillis;
const tau = 2 * Math.PI;
const lastYear = 2099;

function civilDay(julianCenturiesTT, zoneHours) {
  const daysTT = julianCenturiesTT * 36525;
  return Math.floor(j2000 + daysTT - ShouXingUtil.dtT(daysTT) + zoneHours / 24);
}

function buildMonthSequence(firstYear, zoneHours, japanese) {
  const moons = [];
  const terms = [];
  // Lunation zero is the 2000-01-06 conjunction; solar longitude zero is
  // the March 1999 equinox for this solver's unwrapped angular convention.
  const firstCycle = Math.floor((firstYear - 2003) * 365.25 / 29.53);
  const lastCycle = Math.ceil((lastYear - 1997) * 365.25 / 29.53);
  for (let k = firstCycle; k <= lastCycle; k++) {
    moons.push(civilDay(ShouXingUtil.msaLonT(k * tau), zoneHours));
  }
  for (let k = (firstYear - 2002) * 12; k <= (lastYear - 1996) * 12; k++) {
    const longitude = (k % 12 + 12) % 12;
    const day = civilDay(ShouXingUtil.saLonT(k * tau / 12), zoneHours);
    terms.push({ day, longitude });
  }

  const lunations = moons.slice(0, -1).map((start, i) => ({
    start,
    days: moons[i + 1] - start,
    terms: [],
  }));
  let termIndex = terms.findIndex((term) => term.day >= moons[0]);
  for (const month of lunations) {
    while (termIndex < terms.length && terms[termIndex].day < month.start + month.days) {
      month.terms.push(terms[termIndex++].longitude);
    }
  }

  const anchors = [];
  for (const [index, month] of lunations.entries()) {
    if (month.terms.includes(9)) anchors.push(index); // 270° winter solstice
  }
  const result = [];
  for (let i = 0; i + 1 < anchors.length; i++) {
    const sequence = lunations.slice(anchors[i], anchors[i + 1]);
    if (sequence.length !== 12 && sequence.length !== 13) throw Error("Invalid solstice span");
    const leap = sequence.length === 13 ? chooseLeapMonth(sequence, japanese) : -1;
    let month = 11;
    for (const [index, lunation] of sequence.entries()) {
      if (index !== 0 && index !== leap) month = month % 12 + 1;
      result.push({ ...lunation, month, isLeap: index === leap });
    }
  }
  return result;
}

function chooseLeapMonth(months, japanese) {
  const candidates = months.flatMap(({ terms }, i) => i > 0 && terms.length === 0 ? [i] : []);
  if (!candidates.length) throw Error("Missing leap month");
  if (!japanese) return candidates[0];

  // Tenpo calendar: favour assignments placing equinoxes in months 2 and 8,
  // and solstices in months 5 and 11. Winter solstice is already the anchor.
  // In the ambiguous 2033/34 span, the recommended convention is leap 11.
  const anchorYear = new Date(months[0].start * dayMillis).getUTCFullYear();
  if (anchorYear === 2033) {
    if (!candidates.includes(1)) throw Error("Expected leap eleventh month in 2033");
    return 1;
  }
  const quarterMonths = new Map([[0, 2], [3, 5], [6, 8], [9, 11]]);
  const matches = candidates.filter((leap) => months.every(({ terms }, index) => {
    const number = (10 + index - Number(index >= leap)) % 12 + 1;
    return terms.every((term) => !quarterMonths.has(term) || quarterMonths.get(term) === number);
  }));
  if (!matches.length) throw Error(`Japanese leap month is ambiguous after ${anchorYear}`);
  return matches[0];
}

function yearRows(firstYear, zoneHours, japanese, endYear = lastYear) {
  const sequence = buildMonthSequence(firstYear, zoneHours, japanese);
  const starts = sequence.flatMap(({ month, isLeap }, i) => month === 1 && !isLeap ? [i] : []);
  const rows = [];
  for (let i = 0; i + 1 < starts.length; i++) {
    const months = sequence.slice(starts[i], starts[i + 1]);
    const year = new Date(months[0].start * dayMillis).getUTCFullYear();
    if (year < firstYear - 1 || year > endYear) continue;
    if (months.some(({ days }) => days !== 29 && days !== 30)) throw Error(`Invalid month in ${year}`);
    const newYearDay = months[0].start - Date.UTC(year, 0, 1) / dayMillis;
    const leapMonth = months.find((month) => month.isLeap)?.month ?? 0;
    const lengths = months.map(({ days }) => days === 30 ? "1" : "0").join("");
    rows.push(`  [${newYearDay}, ${leapMonth}, "${lengths}"], // ${year}`);
  }
  if (rows.length !== endYear - firstYear + 2) throw Error("Incomplete table");
  return rows;
}

// Modern Korean and Japanese months use UTC+9, but their leap-month rules
// are independent. Share storage only after testing every supported year.
const japaneseRows = yearRows(1900, 9, true);
const koreanRows = yearRows(1962, 9, false, 2050);
if (!koreanRows.every((row, i) => row === japaneseRows[1962 - 1900 + i])) {
  throw Error("Korean and Japanese dates diverge: store separate tables in this range");
}

const output = [
  "// Generated by scripts/generate-east-asian-lunar-years.mjs. Do not edit manually.",
  "// Each row is [days from January 1 to lunar new year, leap month or 0,",
  "// successive lunar month lengths (1 = 30 days, 0 = 29 days)].",
  "export type LunarYearRow = readonly [number, number, string];",
  "",
  "export const VIETNAMESE_LUNAR_YEARS: readonly LunarYearRow[] = [",
  ...yearRows(1976, 7, false, 2050), "];", "",
  "export const UTC9_LUNAR_YEARS: readonly LunarYearRow[] = [",
  ...japaneseRows, "];", "",
].join("\n");
const target = new URL("../src/core/calendar/east-asian-lunar-years.ts", import.meta.url);
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== output) throw Error("East Asian lunar year tables are stale");
} else {
  writeFileSync(target, output, "utf8");
}
