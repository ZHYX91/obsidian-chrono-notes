import { compareLocalDate, toUtcDate, type LocalDate } from "../periodic/periodic-date";
import type { CalendarExtensionResult } from "./calendar-extension";
import { calendarLanguageKey } from "./content-locale";
import { SUNRISE_TITHIS } from "./indian-panchanga-data";

// IMD Rashtriya Panchang, 1948 Saka: tithi at sunrise at the adopted Central Station
// (23°11′N, 82°30′E). https://packolkata.imd.gov.in/panchang/en/explanation
const FIRST_DATE = { year: 2026, month: 3, day: 22 };
const LAST_DATE = { year: 2027, month: 3, day: 21 };
const FIRST_MIDNIGHT = Date.UTC(FIRST_DATE.year, FIRST_DATE.month - 1, FIRST_DATE.day);
const EMPTY_EVENTS = Object.freeze([]);
const LABELS = {
  en: {
    waxing: "Shukla", waning: "Krishna", paksha: "Paksha",
    days: [
      "Pratipada", "Dvitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi", "Saptami",
      "Ashtami", "Navami", "Dashami", "Ekadashi", "Dvadashi", "Trayodashi", "Chaturdashi",
      "Purnima", "Amavasya",
    ],
  },
  hi: {
    waxing: "शुक्ल", waning: "कृष्ण", paksha: "पक्ष",
    days: [
      "प्रतिपदा", "द्वितीया", "तृतीया", "चतुर्थी", "पंचमी", "षष्ठी", "सप्तमी",
      "अष्टमी", "नवमी", "दशमी", "एकादशी", "द्वादशी", "त्रयोदशी", "चतुर्दशी",
      "पूर्णिमा", "अमावस्या",
    ],
  },
};

export function isIndianPanchangaDateSupported(date: LocalDate): boolean {
  return compareLocalDate(date, FIRST_DATE) >= 0 && compareLocalDate(date, LAST_DATE) <= 0;
}

export function getIndianPanchangaDay(date: LocalDate, locale: string): CalendarExtensionResult {
  if (!isIndianPanchangaDateSupported(date)) throw new RangeError("Date outside the published IMD Panchanga");
  const index = (toUtcDate(date).getTime() - FIRST_MIDNIGHT) / 86_400_000;
  const tithi = SUNRISE_TITHIS[index];
  if (tithi === undefined) throw new Error("Missing published tithi");

  const language = calendarLanguageKey(locale);
  const waxing = tithi <= 15;
  const day = waxing ? tithi : tithi - 15;
  if (language === "zh-CN" || language === "zh-TW") {
    const half = waxing ? "白分" : "黑分";
    const phase = waxing ? "望" : "朔";
    const dateText = day === 15 ? `${half}十五（${phase}）` : `${half}第${day}日`;
    const accessibilityText = language === "zh-TW" ? `日出時的太陰日：${dateText}` : `日出时的太阴日：${dateText}`;
    return Object.freeze({ dateText, accessibilityText, events: EMPTY_EVENTS, transition: null });
  }
  const labels = language === "hi" ? LABELS.hi : LABELS.en;
  const name = labels.days[tithi === 30 ? 15 : (tithi - 1) % 15];
  if (name === undefined) throw new RangeError("Invalid published tithi");
  const half = tithi > 15 ? labels.waning : labels.waxing;
  if (language !== "hi") {
    const fortnight = waxing ? "Waxing" : "Waning";
    return Object.freeze({
      dateText: `${fortnight} ${day}`, accessibilityText: `${fortnight} fortnight, day ${day} (${half} ${name})`,
      events: EMPTY_EVENTS, transition: null,
    });
  }
  return Object.freeze({
    dateText: tithi === 15 || tithi === 30 ? name : `${half} ${name}`,
    accessibilityText: `${half} ${labels.paksha} ${name}`,
    events: EMPTY_EVENTS,
    transition: null,
  });
}
