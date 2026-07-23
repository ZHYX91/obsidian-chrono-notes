import { describe, expect, it } from "vitest";

import { PLUGIN_LANGUAGE_OPTIONS } from "../../src/shared/plugin-languages";

describe("general settings language options", () => {
  it("uses stable autonyms instead of translating language names into the active locale", () => {
    expect(PLUGIN_LANGUAGE_OPTIONS).toEqual([
      { value: "en", label: "English" },
      { value: "zh-CN", label: "简体中文" },
      { value: "zh-TW", label: "繁體中文" },
      { value: "ar", label: "العربية" },
      { value: "fa", label: "فارسی" },
      { value: "he", label: "עברית" },
      { value: "am", label: "አማርኛ" },
      { value: "hi", label: "हिन्दी" },
    ]);
  });
});
