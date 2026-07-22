import type { HolidayDataCoverage } from "../../core/calendar/regional-holidays";
import type { HolidayRegion } from "../../shared/settings";
import { HOLIDAY_REGION_DEFINITIONS } from "./holiday-region-registry";

export type HolidayOfficialPublicationStatus =
  | "published"
  | "not-published"
  | "unverified";

export type HolidayCoverageDisposition = "available" | "warning" | "blocking";

export interface HolidayPublicationVerification {
  readonly status: Exclude<HolidayOfficialPublicationStatus, "unverified">;
  readonly verifiedOn: string;
  readonly sourceUrl: string;
}

export interface HolidayRegionYearCoverage {
  readonly region: HolidayRegion;
  readonly year: number;
  readonly coverage: HolidayDataCoverage;
  readonly publication: HolidayPublicationVerification | null;
  readonly disposition: HolidayCoverageDisposition;
}

export interface HolidayCoverageReport {
  readonly currentYear: number;
  readonly years: readonly [number, number];
  readonly entries: readonly HolidayRegionYearCoverage[];
  readonly missing: readonly HolidayRegionYearCoverage[];
  readonly blocking: readonly HolidayRegionYearCoverage[];
  readonly warnings: readonly HolidayRegionYearCoverage[];
  readonly complete: boolean;
  readonly releaseReady: boolean;
}

const HOLIDAY_PUBLICATION_RECORDS: Readonly<
  Record<HolidayRegion, Readonly<Partial<Record<number, HolidayPublicationVerification>>>>
> = Object.freeze({
  cn: Object.freeze({
    2026: publicationVerification(
      "published",
      "https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm",
    ),
    2027: publicationVerification(
      "not-published",
      "https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm",
    ),
  }),
  sg: Object.freeze({
    2026: publicationVerification(
      "published",
      "https://www.mom.gov.sg/newsroom/press-releases/2025/0616-public-holidays-for-2026",
    ),
    2027: publicationVerification(
      "published",
      "https://www.mom.gov.sg/newsroom/press-releases/2026/0618-public-holidays-for-2027",
    ),
  }),
});

/**
 * Builds the release diagnostic for the current and following calendar years.
 * It is intentionally separate from visible calendar presentation: unavailable
 * data must remain diagnosable without introducing an implicit holiday result.
 */
export function createHolidayCoverageReport(currentYear: number): HolidayCoverageReport {
  if (!Number.isInteger(currentYear) || currentYear < 1) {
    throw new RangeError("Holiday coverage year must be a positive integer");
  }

  const years = Object.freeze([currentYear, currentYear + 1]) as readonly [number, number];
  const entries = Object.freeze(years.flatMap((year) => (
    HOLIDAY_REGION_DEFINITIONS.map((definition) => {
      const coverage = definition.getYearCoverage(year);
      const publication = findPublicationVerification(definition.id, year);
      return Object.freeze({
        region: definition.id,
        year,
        coverage,
        publication,
        disposition: classifyHolidayCoverage(
          currentYear,
          year,
          coverage,
          publication?.status ?? "unverified",
        ),
      });
    })
  )));
  const missing = Object.freeze(entries.filter((entry) => entry.coverage === "unavailable"));
  const blocking = Object.freeze(entries.filter((entry) => entry.disposition === "blocking"));
  const warnings = Object.freeze(entries.filter((entry) => entry.disposition === "warning"));

  return Object.freeze({
    currentYear,
    years,
    entries,
    missing,
    blocking,
    warnings,
    complete: missing.length === 0,
    releaseReady: blocking.length === 0,
  });
}

export function classifyHolidayCoverage(
  currentYear: number,
  year: number,
  coverage: HolidayDataCoverage,
  officialStatus: HolidayOfficialPublicationStatus,
): HolidayCoverageDisposition {
  if (officialStatus === "unverified") return "blocking";
  if (coverage === "available") {
    return officialStatus === "published" ? "available" : "blocking";
  }
  if (year === currentYear + 1 && officialStatus === "not-published") return "warning";
  return "blocking";
}

function findPublicationVerification(
  region: HolidayRegion,
  year: number,
): HolidayPublicationVerification | null {
  return HOLIDAY_PUBLICATION_RECORDS[region][year] ?? null;
}

function publicationVerification(
  status: HolidayPublicationVerification["status"],
  sourceUrl: string,
): HolidayPublicationVerification {
  return Object.freeze({
    status,
    verifiedOn: "2026-07-20",
    sourceUrl,
  });
}
