import type { PluginLocale } from "../settings";
import type { ZH_CN_MESSAGES } from "./catalogs/zh-cn";
import type { MessageValue } from "./message-value";

export type { MessageValue, PluralMessage } from "./message-value";

export type SupportedLocale = Exclude<PluginLocale, "auto">;
export type MessageParameters = Readonly<Record<string, string | number>>;

// Simplified Chinese is the source catalog; every translated catalog must cover its keys.
export type MessageKey = keyof typeof ZH_CN_MESSAGES;
export type MessageCatalog = Readonly<Record<MessageKey, MessageValue>>;
export type MessageCatalogs = Readonly<Record<SupportedLocale, MessageCatalog>>;
