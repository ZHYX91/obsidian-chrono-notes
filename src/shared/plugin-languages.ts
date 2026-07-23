import type { PluginLocale } from "./settings";

export const PLUGIN_LANGUAGE_OPTIONS: ReadonlyArray<{
  label: string;
  value: Exclude<PluginLocale, "auto">;
}> = [
  { value: "en", label: "English" },
  { value: "zh-CN", label: "简体中文" },
  { value: "zh-TW", label: "繁體中文" },
  { value: "ar", label: "العربية" },
  { value: "fa", label: "فارسی" },
  { value: "he", label: "עברית" },
  { value: "am", label: "አማርኛ" },
  { value: "hi", label: "हिन्दी" },
];
