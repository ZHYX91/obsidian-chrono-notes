/** Each published date can have several names or coincide with another holiday. */
export interface HolidayEntry {
  readonly dates: readonly string[];
  readonly en: string;
  readonly names?: Readonly<Record<string, string>>;
  readonly kind?: "rest" | "work" | "conditional";
}

export interface PublishedHolidaySource {
  readonly status: "published" | "not-published";
  readonly sourceUrl: string;
  readonly verifiedOn: string;
}

export interface HolidaySchedule {
  /** The issuing authority's calendar for each reviewed civil year. */
  readonly sources: Readonly<Partial<Record<number, PublishedHolidaySource>>>;
  readonly entries: readonly HolidayEntry[];
}
