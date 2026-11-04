import type { PluginLocale } from "../settings";
import { MESSAGE_CATALOGS } from "./catalogs";
import type { MessageValue } from "./message-value";
import type {
  MessageCatalogs,
  MessageKey,
  MessageParameters,
  SupportedLocale,
} from "./types";

export interface Translator {
  readonly locale: SupportedLocale;
  readonly direction: "ltr" | "rtl";
  readonly t: (key: MessageKey, parameters?: MessageParameters) => string;
}

export function resolvePluginLocale(
  configuredLocale: PluginLocale,
  hostLocale: string,
): SupportedLocale {
  if (configuredLocale !== "auto") return configuredLocale;
  const normalized = hostLocale.trim().replaceAll("_", "-").toLowerCase();
  const [language = "", ...allSubtags] = normalized.split("-");
  const extensionIndex = allSubtags.findIndex((part) => part.length === 1);
  const subtags = extensionIndex < 0 ? allSubtags : allSubtags.slice(0, extensionIndex);
  if (language === "ar") return "ar";
  if (language === "fa") return "fa";
  if (language === "he" || language === "iw") return "he";
  if (language === "am") return "am";
  if (language === "hi") return "hi";
  // Use a documented regional variant even when Obsidian reports only the base language.
  const additionalLocales: Readonly<Record<string, SupportedLocale>> = {
    de: "de-DE", fr: "fr-FR", es: "es-ES", pt: "pt-BR",
    ru: "ru-RU", ja: "ja-JP", ko: "ko-KR", vi: "vi-VN",
  };
  const matchedLocale = Object.prototype.hasOwnProperty.call(additionalLocales, language)
    ? additionalLocales[language]
    : undefined;
  if (matchedLocale !== undefined) return matchedLocale;
  if (language !== "zh") return "en";
  if (subtags.includes("hant")) return "zh-TW";
  if (subtags.includes("hans")) return "zh-CN";
  if (
    subtags.includes("tw") ||
    subtags.includes("hk") ||
    subtags.includes("mo")
  ) return "zh-TW";
  return "zh-CN";
}

export function createTranslator(
  configuredLocale: PluginLocale,
  hostLocale: string,
  catalogs: MessageCatalogs = MESSAGE_CATALOGS,
): Translator {
  const locale = resolvePluginLocale(configuredLocale, hostLocale);
  return Object.freeze({
    locale,
    direction: locale === "ar" || locale === "fa" || locale === "he" ? "rtl" : "ltr",
    t: (key: MessageKey, parameters: MessageParameters = {}) => {
      const message = catalogs[locale][key];
      return interpolate(selectMessage(message, locale, parameters.count), parameters);
    },
  });
}

function selectMessage(
  message: MessageValue,
  locale: SupportedLocale,
  count: string | number | undefined,
): string {
  if (typeof message === "string") return message;
  if (typeof count !== "number") return message.other;
  const category = new Intl.PluralRules(locale).select(count);
  return message[category] ?? message.other;
}

function interpolate(message: string, parameters: MessageParameters): string {
  return message.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (placeholder, name: string) =>
    parameters[name] === undefined ? placeholder : String(parameters[name]));
}
