export type ChineseContentLocale = "zh-CN" | "zh-TW";

/** Content follows the interface language, with an explicit choice of Chinese script. */
export function calendarLanguageKey(locale: string): string {
  if (locale === "zh-CN" || locale === "zh-TW" || locale === "en") return locale;
  const [language = "", ...parts] = locale.trim().toLowerCase().replaceAll("_", "-").split("-");
  if (language === "iw") return "he";
  if (language !== "zh") return language;
  const extension = parts.findIndex((part) => part.length === 1);
  const subtags = extension < 0 ? parts : parts.slice(0, extension);
  if (subtags.includes("hant")) return "zh-TW";
  if (subtags.includes("hans")) return "zh-CN";
  return subtags.some((part) => part === "tw" || part === "hk" || part === "mo") ? "zh-TW" : "zh-CN";
}

export function resolveContentLocale<T extends string>(
  locale: string,
  localLanguages: readonly T[],
): ChineseContentLocale | T | "en" {
  const language = calendarLanguageKey(locale);
  if (language === "zh-CN" || language === "zh-TW") return language;
  return localLanguages.find((local) => local === language) ?? "en";
}
