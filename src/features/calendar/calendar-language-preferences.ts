import { createDefaultSettings, type ChronoNotesSettings } from "../../shared/settings";
import { CALENDAR_EXTENSION_DEFINITIONS } from "./calendar-extension-registry";
import { HOLIDAY_REGION_DEFINITIONS } from "./holiday-region-registry";

interface CalendarPreferences {
  readonly calendars?: readonly string[];
  readonly regions?: readonly string[];
  readonly enableFirstCalendar?: true;
  readonly enableFirstRegion?: true;
}

const UK_REGIONS = ["gb-eng-wls", "gb-sct", "gb-nir"];
const CHINESE_CALENDARS = ["chinese-lunar", "ganzhi"];
const LANGUAGE_PREFERENCES = new Map<string, CalendarPreferences>([
  ["en", { regions: ["us", ...UK_REGIONS, "sg"] }],
  ["ja", { calendars: ["japanese-lunisolar"], regions: ["jp"], enableFirstCalendar: true, enableFirstRegion: true }],
  ["ko", { calendars: ["korean-lunar"], regions: ["kr"], enableFirstCalendar: true }],
  ["vi", { calendars: ["vietnamese-lunar"], regions: ["vn"], enableFirstCalendar: true }],
  ["de", { regions: ["de", "at"] }],
  ["fr", { regions: ["fr", "ca-qc"] }],
  ["es", { regions: ["es", "mx"] }],
  ["ru", { calendars: ["julian"], regions: ["ru"] }],
  ["ar", { calendars: ["islamic-civil", "islamic-umalqura"] }],
  ["fa", { calendars: ["persian"], enableFirstCalendar: true }],
  ["he", { calendars: ["hebrew"], enableFirstCalendar: true }],
  ["am", { calendars: ["ethiopic"], enableFirstCalendar: true }],
  ["hi", { calendars: ["indian", "indian-panchanga"], regions: ["in"] }],
]);

// Use the actual language tag, before it is mapped to a supported UI translation.
// Never expand a bare language to its "likely" country.
function getPreferences(languageTag: string): CalendarPreferences {
  let locale: Intl.Locale;
  try {
    locale = new Intl.Locale(languageTag.trim().replaceAll("_", "-"));
  } catch {
    return {};
  }

  if (locale.language === "zh") {
    const traditional = locale.script === "Hant" ||
      (locale.script !== "Hans" && ["TW", "HK", "MO"].includes(locale.region ?? ""));
    const regions = traditional ? ["tw", "hk", "mo"] : ["cn", "sg"];
    return { calendars: CHINESE_CALENDARS, enableFirstCalendar: true, regions: preferRegion(regions, locale.region) };
  }
  if (locale.language === "pt") {
    if (locale.region === "BR") return { regions: ["br"] };
    return { regions: locale.region === undefined || locale.region === "PT" ? ["pt"] : [] };
  }
  if (locale.language === "ar" && locale.region === "EG") {
    return { calendars: ["coptic", "islamic-civil", "islamic-umalqura"] };
  }
  const preferences = LANGUAGE_PREFERENCES.get(locale.language) ?? {};
  if (preferences.regions === undefined) return preferences;
  return { ...preferences, regions: preferRegion(preferences.regions, locale.region) };
}

function preferRegion(regions: readonly string[], country: string | undefined): readonly string[] {
  if (country === undefined) return regions;
  const code = country.toLowerCase();
  const matches = (id: string) => id === code || id.startsWith(code + "-");
  return [...regions.filter(matches), ...regions.filter((id) => !matches(id))];
}

function orderDefinitions<T extends { readonly id: string }>(
  definitions: readonly T[],
  preferred: readonly string[] = [],
): readonly T[] {
  const ranks = new Map(preferred.map((id, index) => [id, index]));
  const rank = (definition: T) => ranks.get(definition.id) ?? ranks.size;
  return [...definitions].sort((a, b) => rank(a) - rank(b));
}

export function getCalendarOptionsForLanguage(languageTag: string) {
  const preferences = getPreferences(languageTag);
  return {
    calendars: orderDefinitions(CALENDAR_EXTENSION_DEFINITIONS, preferences.calendars),
    regions: orderDefinitions(HOLIDAY_REGION_DEFINITIONS, preferences.regions),
  };
}

export function createFirstInstallSettings(languageTag: string): ChronoNotesSettings {
  const settings = createDefaultSettings();
  const preferences = getPreferences(languageTag);
  const calendar = preferences.enableFirstCalendar && CALENDAR_EXTENSION_DEFINITIONS.find(
    ({ id }) => id === preferences.calendars?.[0],
  );
  if (calendar && calendar.isSupported(languageTag)) settings.calendarExtensions.push(calendar.id);
  const region = preferences.enableFirstRegion && HOLIDAY_REGION_DEFINITIONS.find(
    ({ id }) => id === preferences.regions?.[0],
  );
  if (region) settings.holidayRegions.push(region.id);
  return settings;
}
