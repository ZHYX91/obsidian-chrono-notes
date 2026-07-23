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
  systemLocale: string,
): SupportedLocale {
  if (configuredLocale !== "auto") return configuredLocale;
  const normalized = systemLocale.trim().replaceAll("_", "-").toLowerCase();
  const language = normalized.split("-")[0];
  if (language === "ar") return "ar";
  if (language === "fa") return "fa";
  if (language === "he" || language === "iw") return "he";
  if (language === "am") return "am";
  if (language === "hi") return "hi";
  if (!normalized.startsWith("zh")) return "en";
  const parts = normalized.split("-");
  if (
    parts.includes("hant") ||
    parts.includes("tw") ||
    parts.includes("hk") ||
    parts.includes("mo")
  ) return "zh-TW";
  return "zh-CN";
}

export function createTranslator(
  configuredLocale: PluginLocale,
  systemLocale: string,
  catalogs: MessageCatalogs = MESSAGE_CATALOGS,
): Translator {
  const locale = resolvePluginLocale(configuredLocale, systemLocale);
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
  return new Intl.PluralRules(locale).select(count) === "one" ? message.one : message.other;
}

function interpolate(message: string, parameters: MessageParameters): string {
  return message.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (placeholder, name: string) =>
    parameters[name] === undefined ? placeholder : String(parameters[name]));
}
