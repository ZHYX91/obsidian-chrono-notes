import { describe, expect, it } from "vitest";

import {
  SETTINGS_SCHEMA_VERSION,
  migrateSettings,
  normalizeSettings,
} from "../../src/shared/settings";

describe("periodic path locale settings", () => {
  it("pins an explicit legacy interface locale when migrating schema 18", () => {
    const migrated = normalizeSettings(migrateSettings({
      schemaVersion: 18,
      locale: "zh-TW",
      periodicNotes: {
        daily: {
          enabled: true,
          pattern: "[日記]/MMMM/YYYY-MM-DD",
          templatePath: "",
        },
      },
    }));

    expect(migrated.schemaVersion).toBe(SETTINGS_SCHEMA_VERSION);
    expect(migrated.periodicNotes.daily.pathLocale).toBe("zh-TW");
  });

  it("pins the effective host locale when migrating legacy auto-language settings", () => {
    const migrated = normalizeSettings(migrateSettings({
      schemaVersion: 18,
      locale: "auto",
      periodicNotes: {
        daily: {
          enabled: true,
          pattern: "[Journal]/MMMM/YYYY-MM-DD",
          templatePath: "",
        },
      },
    }, "zh-CN"));

    expect(migrated.periodicNotes.daily.pathLocale).toBe("zh-CN");
  });

  it("keeps English as the deterministic non-host fallback for pure migration callers", () => {
    const migrated = normalizeSettings(migrateSettings({
      schemaVersion: 18,
      locale: "auto",
      periodicNotes: {
        daily: {
          enabled: true,
          pattern: "[Journal]/MMMM/YYYY-MM-DD",
          templatePath: "",
        },
      },
    }));

    expect(migrated.periodicNotes.daily.pathLocale).toBe("en");
  });

  it("preserves an explicitly persisted path locale independently of interface locale", () => {
    const settings = normalizeSettings({
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      locale: "zh-CN",
      periodicNotes: {
        daily: {
          enabled: true,
          pattern: "[Journal]/MMMM/YYYY-MM-DD",
          templatePath: "",
          pathLocale: "en",
        },
      },
    });

    expect(settings.locale).toBe("zh-CN");
    expect(settings.periodicNotes.daily.pathLocale).toBe("en");
  });
});
