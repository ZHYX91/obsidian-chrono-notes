import { describe, expect, it } from "vitest";

import { PLUGIN_LANGUAGE_OPTIONS } from "../../src/shared/plugin-languages";

describe("general settings language options", () => {
  it("uses stable autonyms instead of translating language names into the active locale", () => {
    expect(PLUGIN_LANGUAGE_OPTIONS).toEqual([
      { value: "en", label: "English" },
      { value: "zh-CN", label: "简体中文" },
      { value: "zh-TW", label: "繁體中文" },
      { value: "ja-JP", label: "日本語" },
      { value: "ko-KR", label: "한국어" },
      { value: "de-DE", label: "Deutsch" },
      { value: "fr-FR", label: "Français" },
      { value: "es-ES", label: "Español" },
      { value: "pt-BR", label: "Português (Brasil)" },
      { value: "ru-RU", label: "Русский" },
      { value: "vi-VN", label: "Tiếng Việt" },
      { value: "ar", label: "العربية" },
      { value: "fa", label: "فارسی" },
      { value: "he", label: "עברית" },
      { value: "am", label: "አማርኛ" },
      { value: "hi", label: "हिन्दी" },
    ]);
  });
});
