import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("obsidian", async () => {
  const { createRequire } = await import("node:module");
  const workspaceRequire = createRequire(import.meta.url);
  const obsidianRequire = createRequire(workspaceRequire.resolve("obsidian/package.json"));
  return { moment: obsidianRequire("moment") };
});

import { OBSIDIAN_PROPERTY_DATE_VALUE_FORMATTER } from
  "../../src/adapters/obsidian/obsidian-property-date-value-formatter";

const originalTimeZone = process.env.TZ;

afterEach(() => {
  if (originalTimeZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimeZone;
});

describe("Obsidian property date value formatter", () => {
  it("preserves a datetime-local value inside a New York DST gap", () => {
    process.env.TZ = "America/New_York";
    const value = "2026-03-08T02:30";

    expect(OBSIDIAN_PROPERTY_DATE_VALUE_FORMATTER.formatMoment(
      value,
      "YYYY-MM-DD HH:mm",
      "en",
    )).toBe("2026-03-08 02:30");
    expect(OBSIDIAN_PROPERTY_DATE_VALUE_FORMATTER.formatSystemDate(value)).toBe(
      formatSystemDate(2026, 3, 8),
    );
    expect(OBSIDIAN_PROPERTY_DATE_VALUE_FORMATTER.formatSystemTime(value, false)).toBe(
      formatSystemTime(2026, 3, 8, 2, 30, 0, false),
    );
    expect(OBSIDIAN_PROPERTY_DATE_VALUE_FORMATTER.formatSystemTime(
      "2026-03-08T02:30:05",
      true,
    )).toBe(
      formatSystemTime(2026, 3, 8, 2, 30, 5, true),
    );
  });

  it("preserves a civil date skipped by Pacific/Apia", () => {
    process.env.TZ = "Pacific/Apia";
    const value = "2011-12-30";

    expect(OBSIDIAN_PROPERTY_DATE_VALUE_FORMATTER.formatMoment(
      value,
      "dddd, YYYY-MM-DD",
      "en",
    )).toBe("Friday, 2011-12-30");
    expect(OBSIDIAN_PROPERTY_DATE_VALUE_FORMATTER.formatSystemDate(value)).toBe(
      formatSystemDate(2011, 12, 30),
    );
  });

  it("formats custom Moment date and time tokens from their literal fields", () => {
    process.env.TZ = "America/New_York";

    expect(OBSIDIAN_PROPERTY_DATE_VALUE_FORMATTER.formatMoment(
      "2026-03-08T02:30",
      "YYYY年M月D日 HH时mm分",
      "zh-cn",
    )).toBe("2026年3月8日 02时30分");
    expect(OBSIDIAN_PROPERTY_DATE_VALUE_FORMATTER.formatMoment(
      "2026-03-08T02:30",
      "YYYY-MM-ddd",
      "en",
    )).toBe("2026-03-Sun");
  });

  it("formats localized month, weekday, clock, and fractional-second tokens", () => {
    expect(OBSIDIAN_PROPERTY_DATE_VALUE_FORMATTER.formatMoment(
      "2026-07-31T14:05:06.123",
      "dddd, MMMM D, YYYY [at] kk:mm:ss.SSS",
      "en",
    )).toBe("Friday, July 31, 2026 at 14:05:06.123");
    expect(OBSIDIAN_PROPERTY_DATE_VALUE_FORMATTER.formatMoment(
      "2026-07-31T14:05:06",
      "LTS",
      "en",
    )).toBe("2:05:06 PM");
    expect(OBSIDIAN_PROPERTY_DATE_VALUE_FORMATTER.formatMoment(
      "2026-07-31T00:05:06.123",
      "k kk S SS SSS",
      "en",
    )).toBe("24 24 1 12 123");
    expect(OBSIDIAN_PROPERTY_DATE_VALUE_FORMATTER.formatMoment(
      "2026-07-31T14:05:06",
      "LT",
      "zh-CN",
    )).toBe("14:05");
  });

  it("accepts normalized one- to three-digit fractions without losing civil fields", () => {
    for (const [value, expected] of [
      ["2026-07-31T14:05:06.1", "14:05:06.100"],
      ["2026-07-31T14:05:06.12", "14:05:06.120"],
      ["2026-07-31T14:05:06.123", "14:05:06.123"],
    ] as const) {
      expect(OBSIDIAN_PROPERTY_DATE_VALUE_FORMATTER.formatMoment(
        value,
        "HH:mm:ss.SSS",
        "en",
      )).toBe(expected);
    }
  });

  it("falls back deterministically for localized tokens missing from Moment", () => {
    expect(OBSIDIAN_PROPERTY_DATE_VALUE_FORMATTER.formatMoment(
      "2026-07-31T14:05:06",
      "dddd, MMMM D, YYYY LTS",
      "am",
    )).toBe("Friday, July 31, 2026 2:05:06 PM");
  });

  it("preserves four-digit civil years below 0100", () => {
    const value = "0099-01-02T03:04:05";
    const expectedDate = formatSystemDate(99, 1, 2);
    const incorrectlyShiftedDate = formatSystemDate(1999, 1, 2);

    expect(OBSIDIAN_PROPERTY_DATE_VALUE_FORMATTER.formatMoment(
      value,
      "YYYY-MM-DD HH:mm:ss",
      "en",
    )).toBe("0099-01-02 03:04:05");
    expect(OBSIDIAN_PROPERTY_DATE_VALUE_FORMATTER.formatSystemDate(value)).toBe(
      expectedDate,
    );
    expect(expectedDate).not.toBe(incorrectlyShiftedDate);
    expect(OBSIDIAN_PROPERTY_DATE_VALUE_FORMATTER.formatSystemTime(value, true)).toBe(
      formatSystemTime(99, 1, 2, 3, 4, 5, true),
    );
  });

  it("rejects normalized invalid civil fields", () => {
    expect(OBSIDIAN_PROPERTY_DATE_VALUE_FORMATTER.formatSystemDate("2026-02-30")).toBeNull();
    expect(OBSIDIAN_PROPERTY_DATE_VALUE_FORMATTER.formatSystemTime(
      "2026-01-01T25:00",
      false,
    )).toBeNull();
    expect(OBSIDIAN_PROPERTY_DATE_VALUE_FORMATTER.formatMoment(
      "2026-01-01T24:00",
      "YYYY-MM-DD HH:mm",
      "en",
    )).toBeNull();
    expect(OBSIDIAN_PROPERTY_DATE_VALUE_FORMATTER.formatMoment(
      "2026-02-30T14:00",
      "YYYY-MM-DD HH:mm",
      "en",
    )).toBeNull();
    expect(OBSIDIAN_PROPERTY_DATE_VALUE_FORMATTER.formatMoment(
      "2026-01-01T14:00:00.1234",
      "YYYY-MM-DD HH:mm:ss.SSS",
      "en",
    )).toBeNull();
  });
});

function formatSystemDate(year: number, month: number, day: number): string {
  return new Intl.DateTimeFormat(undefined, {
    calendar: "gregory",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  }).format(createExpectedCivilDate(year, month, day));
}

function formatSystemTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  includeSeconds: boolean,
): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    ...(includeSeconds ? { second: "2-digit" } : {}),
    timeZone: "UTC",
  }).format(createExpectedCivilDate(year, month, day, hour, minute, second));
}

function createExpectedCivilDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  const result = new Date(0);
  result.setUTCHours(0, 0, 0, 0);
  result.setUTCFullYear(year, month - 1, day);
  result.setUTCHours(hour, minute, second, 0);
  return result;
}
