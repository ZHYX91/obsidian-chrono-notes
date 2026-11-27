import { expect, it, vi } from "vitest";
import type { HolidaySchedule } from "../../src/core/calendar/holiday-data/schedule";
import { getPublishedHolidayDay, getPublishedHolidayYearCoverage } from "../../src/core/calendar/published-holidays";

vi.mock("../../src/core/calendar/holiday-data/americas", () => ({
  AMERICAS: {
    us: {
      sources: {
        2025: { status: "not-published", sourceUrl: "https://example.com", verifiedOn: "2024-01-01" },
        2027: { status: "published", sourceUrl: "https://example.com", verifiedOn: "2024-01-01" },
      },
      entries: [{
        dates: ["2025-12-31", "2026-12-31"], en: "Substitute holiday", names: { "zh-CN": "补假", "zh-TW": "補假" },
      }],
    } satisfies HolidaySchedule,
  },
}));

it("keeps individual dates queryable without treating them as a full civil-year schedule", () => {
  for (const year of [2025, 2026]) {
    expect(getPublishedHolidayDay("us", { year, month: 12, day: 31 }, "en").holidays)
      .toEqual([{ region: "us", name: "Substitute holiday" }]);
    expect(getPublishedHolidayYearCoverage("us", year)).toBe("unavailable");
  }
  expect(getPublishedHolidayYearCoverage("us", 2027)).toBe("unavailable");
});
