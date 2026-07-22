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
    { noteType: "daily", pattern: "'Daily'/yyyy-MM-dd", expectedPath: "Daily/2026-05-18.md" },
    { noteType: "monthly", pattern: "'Monthly'/yyyy-MM", expectedPath: "Monthly/2026-05.md" },
    {
      noteType: "quarterly",
      pattern: "'Quarterly'/yyyy-'Q'q",
      expectedPath: "Quarterly/2026-Q2.md",
    },
    { noteType: "yearly", pattern: "'Yearly'/yyyy", expectedPath: "Yearly/2026.md" },
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
        pattern: "'Weekly'/kkkk-'W'WW",
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
      pattern: "'Daily'/yyyy-MM-dd",
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

  it("recognizes configured note types in explicit priority order", () => {
    const options = { locale: "en-US", weekStartDay: "monday" as const };
    const match = findPeriodicNotePathMatch(
      "Notes/2026.md",
      [
        { noteType: "monthly", pattern: "'Notes'/yyyy" },
        { noteType: "yearly", pattern: "'Notes'/yyyy" },
      ],
      options,
    );

    expect(match).toEqual({
      noteType: "monthly",
      date: { year: 2026, month: 1, day: 1 },
    });
    expect(Object.isFrozen(match)).toBe(true);
  });

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
        { noteType: "daily", pattern: "yyyy-MM-dd HH a" },
        { locale: "en-US", weekStartDay: "monday" },
      ),
    ).toBeNull();
  });
});
