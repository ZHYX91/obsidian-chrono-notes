import { describe, expect, it } from "vitest";

import { getPeriodAnchor, type LocalDate } from "../../src/core/periodic/periodic-date";
import {
  findPeriodicNotePathMatch,
  formatPeriodicNotePath,
  parsePeriodicNotePath,
  type PeriodicNotePathRule,
} from "../../src/core/periodic/periodic-note-path";

describe("periodic note paths", () => {
  const selectedDate: LocalDate = { year: 2026, month: 5, day: 18 };

  it.each<PeriodicNotePathRule & { expectedPath: string }>([
    { noteType: "daily", pattern: "[Daily]/YYYY-MM-DD", expectedPath: "Daily/2026-05-18.md" },
    { noteType: "monthly", pattern: "[Monthly]/YYYY-MM", expectedPath: "Monthly/2026-05.md" },
    {
      noteType: "quarterly",
      pattern: "[Quarterly]/YYYY-[Q]Q",
      expectedPath: "Quarterly/2026-Q2.md",
    },
    { noteType: "yearly", pattern: "[Yearly]/YYYY", expectedPath: "Yearly/2026.md" },
  ])("formats and reverses $noteType paths", (rule) => {
    const path = formatPeriodicNotePath(selectedDate, rule, {
      locale: "en-US",
      weekStartDay: "monday",
    });
    expect(path).toBe(rule.expectedPath);
    expect(
      parsePeriodicNotePath(rule.expectedPath, rule, {
        locale: "en-US",
        weekStartDay: "monday",
      }),
    ).toEqual(getPeriodAnchor(selectedDate, rule.noteType, "monday"));
  });

  it.each([
    {
      weekStartDay: "monday" as const,
      selected: { year: 2024, month: 12, day: 31 },
      expectedAnchor: { year: 2024, month: 12, day: 30 },
      expectedPath: "Weekly/2025-W01.md",
    },
    {
      weekStartDay: "sunday" as const,
      selected: { year: 2023, month: 12, day: 31 },
      expectedAnchor: { year: 2023, month: 12, day: 31 },
      expectedPath: "Weekly/2024-W01.md",
    },
  ])(
    "round-trips ISO week-year paths for $weekStartDay-start weeks",
    ({ weekStartDay, selected, expectedAnchor, expectedPath }) => {
      const rule: PeriodicNotePathRule = {
        noteType: "weekly",
        pattern: "[Weekly]/GGGG-[W]WW",
      };
      expect(formatPeriodicNotePath(selected, rule, { locale: "en-US", weekStartDay })).toBe(
        expectedPath,
      );
      expect(parsePeriodicNotePath(expectedPath, rule, { locale: "en-US", weekStartDay })).toEqual(
        expectedAnchor,
      );
    },
  );

  it("does not recognize a path unless the entire configured pattern matches", () => {
    const rule: PeriodicNotePathRule = {
      noteType: "daily",
      pattern: "[Daily]/YYYY-MM-DD",
    };
    expect(
      parsePeriodicNotePath("Archive/Daily/2026-05-18.md", rule, {
        locale: "en-US",
        weekStartDay: "monday",
      }),
    ).toBeNull();
    expect(
      parsePeriodicNotePath("Daily/2026-05-18.txt", rule, {
        locale: "en-US",
        weekStartDay: "monday",
      }),
    ).toBeNull();
  });

  it("skips under-specified rules before applying the configured priority", () => {
    const options = { locale: "en-US", weekStartDay: "monday" as const };
    const match = findPeriodicNotePathMatch(
      "Notes/2026.md",
      [
        { noteType: "monthly", pattern: "[Notes]/YYYY" },
        { noteType: "yearly", pattern: "[Notes]/YYYY" },
      ],
      options,
    );

    expect(match).toEqual({
      noteType: "yearly",
      date: { year: 2026, month: 1, day: 1 },
    });
    expect(Object.isFrozen(match)).toBe(true);
  });

  it("preserves explicit priority when multiple complete rules match", () => {
    const options = { locale: "en-US", weekStartDay: "monday" as const };
    const daily = { noteType: "daily", pattern: "[Notes]/YYYY-MM-DD" } as const;
    const monthly = { noteType: "monthly", pattern: "[Notes]/YYYY-MM-DD" } as const;
    expect(findPeriodicNotePathMatch("Notes/2026-05-01.md", [daily, monthly], options)
      ?.noteType).toBe("daily");
    expect(findPeriodicNotePathMatch("Notes/2026-05-01.md", [monthly, daily], options)
      ?.noteType).toBe("monthly");
  });

  it.each<PeriodicNotePathRule>([
    { noteType: "daily", pattern: "[Daily]/YYYY-MM" },
    { noteType: "daily", pattern: "[Daily]/MM-DD" },
    { noteType: "daily", pattern: "[YYYY-MM-DD]" },
    { noteType: "weekly", pattern: "[Weekly]/GGGG" },
    { noteType: "weekly", pattern: "[Weekly]/YYYY-[W]WW" },
    { noteType: "monthly", pattern: "[Monthly]/YYYY" },
    { noteType: "quarterly", pattern: "[Quarterly]/YYYY" },
    { noteType: "yearly", pattern: "[Yearly]/MM" },
    { noteType: "decadal", pattern: "[Decades]/CEN" },
    { noteType: "century", pattern: "[Century]" },
  ])("rejects incomplete $noteType identity in $pattern", (rule) => {
    const options = { locale: "en-US", weekStartDay: "monday" as const };
    expect(formatPeriodicNotePath(selectedDate, rule, options)).toBeNull();
    expect(parsePeriodicNotePath("Daily/2026-05.md", rule, options)).toBeNull();
  });

  it.each(["monday", "sunday"] as const)(
    "keeps neighboring daily notes distinct across month and year boundaries (%s)",
    (weekStartDay) => {
      const dates = [
        { year: 2024, month: 2, day: 28 },
        { year: 2024, month: 2, day: 29 },
        { year: 2024, month: 3, day: 1 },
        { year: 2024, month: 12, day: 31 },
        { year: 2025, month: 1, day: 1 },
      ];
      const rule = { noteType: "daily", pattern: "[Daily]/YYYY-MM-DD" } as const;
      const options = { locale: "en-US", weekStartDay };
      const paths = dates.map((date) => formatPeriodicNotePath(date, rule, options));
      expect(new Set(paths).size).toBe(dates.length);
      for (const [index, path] of paths.entries()) {
        expect(path).not.toBeNull();
        expect(parsePeriodicNotePath(path ?? "", rule, options)).toEqual(dates[index]);
      }
    },
  );

  it("returns null for empty or invalid patterns", () => {
    expect(
      formatPeriodicNotePath(
        selectedDate,
        { noteType: "daily", pattern: "" },
        { locale: "en-US", weekStartDay: "monday" },
      ),
    ).toBeNull();
    expect(
      parsePeriodicNotePath(
        "Daily/2026-05-18.md",
        { noteType: "daily", pattern: "YYYY-MM-DD HH" },
        { locale: "en-US", weekStartDay: "monday" },
      ),
    ).toBeNull();
  });
});
