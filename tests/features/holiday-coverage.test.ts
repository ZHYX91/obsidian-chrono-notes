import { describe, expect, it } from "vitest";

import {
  classifyHolidayCoverage,
  createHolidayCoverageReport,
} from "../../src/features/calendar/holiday-coverage";

describe("holiday coverage release diagnostics", () => {
  it("reports current and next year coverage without treating gaps as ordinary days", () => {
    const report = createHolidayCoverageReport(2026);

    expect(report).toEqual({
      currentYear: 2026,
      years: [2026, 2027],
      entries: [
        {
          region: "cn",
          year: 2026,
          coverage: "available",
          publication: {
            status: "published",
            verifiedOn: "2026-07-20",
            sourceUrl: "https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm",
          },
          disposition: "available",
        },
        {
          region: "sg",
          year: 2026,
          coverage: "available",
          publication: {
            status: "published",
            verifiedOn: "2026-07-20",
            sourceUrl: "https://www.mom.gov.sg/newsroom/press-releases/2025/0616-public-holidays-for-2026",
          },
          disposition: "available",
        },
        {
          region: "cn",
          year: 2027,
          coverage: "unavailable",
          publication: {
            status: "not-published",
            verifiedOn: "2026-07-20",
            sourceUrl: "https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm",
          },
          disposition: "warning",
        },
        {
          region: "sg",
          year: 2027,
          coverage: "available",
          publication: {
            status: "published",
            verifiedOn: "2026-07-20",
            sourceUrl: "https://www.mom.gov.sg/newsroom/press-releases/2026/0618-public-holidays-for-2027",
          },
          disposition: "available",
        },
      ],
      missing: [expect.objectContaining({ region: "cn", year: 2027 })],
      blocking: [],
      warnings: [expect.objectContaining({ region: "cn", year: 2027 })],
      complete: false,
      releaseReady: true,
    });
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.years)).toBe(true);
    expect(Object.isFrozen(report.entries)).toBe(true);
    expect(Object.isFrozen(report.entries[0])).toBe(true);
    expect(Object.isFrozen(report.entries[0]?.publication)).toBe(true);
    expect(Object.isFrozen(report.missing)).toBe(true);
    expect(Object.isFrozen(report.blocking)).toBe(true);
    expect(Object.isFrozen(report.warnings)).toBe(true);
    expect(report.missing[0]).toBe(report.entries[2]);
    expect(report.warnings[0]).toBe(report.entries[2]);
  });

  it("derives release severity from year role, coverage, and official publication", () => {
    expect(classifyHolidayCoverage(2026, 2026, "unavailable", "not-published"))
      .toBe("blocking");
    expect(classifyHolidayCoverage(2026, 2027, "unavailable", "not-published"))
      .toBe("warning");
    expect(classifyHolidayCoverage(2026, 2027, "unavailable", "published"))
      .toBe("blocking");
    expect(classifyHolidayCoverage(2026, 2027, "unavailable", "unverified"))
      .toBe("blocking");
    expect(classifyHolidayCoverage(2026, 2027, "available", "unverified"))
      .toBe("blocking");
    expect(classifyHolidayCoverage(2026, 2027, "available", "not-published"))
      .toBe("blocking");
    expect(classifyHolidayCoverage(2026, 2027, "available", "published"))
      .toBe("available");
  });

  it("requires every provider to cover the actual current year", () => {
    const currentYear = new Date().getFullYear();
    const currentEntries = createHolidayCoverageReport(currentYear).entries
      .filter((entry) => entry.year === currentYear);

    expect(currentEntries.filter((entry) => entry.coverage === "unavailable")).toEqual([]);
  });

  it.runIf(process.env.CHRONO_HOLIDAY_RELEASE_CHECK === "1")(
    "blocks only on release-critical coverage gaps",
    () => {
      const requestedYear = Number(process.env.CHRONO_HOLIDAY_BASE_YEAR);
      const currentYear = Number.isInteger(requestedYear) && requestedYear > 0
        ? requestedYear
        : new Date().getFullYear();
      const report = createHolidayCoverageReport(currentYear);

      if (report.warnings.length > 0) {
        console.warn(formatCoverageWarnings(report.warnings));
      }
      expect(report.blocking, formatReleaseBlockers(report.blocking)).toEqual([]);
    },
  );

  it("still blocks when an unavailable year becomes current", () => {
    const report = createHolidayCoverageReport(2027);

    expect(report.releaseReady).toBe(false);
    expect(report.blocking).toContainEqual(expect.objectContaining({
      region: "cn",
      year: 2027,
      disposition: "blocking",
    }));
  });

  it("rejects invalid report years", () => {
    expect(() => createHolidayCoverageReport(0)).toThrow(RangeError);
    expect(() => createHolidayCoverageReport(2026.5)).toThrow(RangeError);
  });
});

function formatReleaseBlockers(
  blockers: ReturnType<typeof createHolidayCoverageReport>["blocking"],
): string {
  return blockers.length === 0
    ? "Holiday release coverage is ready"
    : `Holiday release blockers: ${blockers.map((entry) => (
      `${entry.region}:${entry.year} coverage=${entry.coverage} publication=${entry.publication?.status ?? "unverified"}`
    )).join(", ")}`;
}

function formatCoverageWarnings(
  warnings: ReturnType<typeof createHolidayCoverageReport>["warnings"],
): string {
  return `Holiday coverage warning: ${warnings
    .map((entry) => (
      `${entry.region}:${entry.year} official data is not published ` +
      `(verified ${entry.publication?.verifiedOn ?? "never"}; ` +
      `source ${entry.publication?.sourceUrl ?? "unverified"})`
    ))
    .join(", ")}`;
}
