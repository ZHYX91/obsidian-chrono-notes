import { describe, expect, it } from "vitest";
import { buildCenturyGroups, selectCenturyCalendar } from "../../src/features/calendar/century-calendar-query";
import { createParsedNoteIndexSnapshot } from "../support/note-index-snapshot";

export const LONG_PERIOD_OPTIONS = {
  locale: "en", weekStartDay: "monday",
  yearly: { enabled: true, pattern: "[diary]/YYYY" },
  decadal: { enabled: true, pattern: "[diary]/DEC[s]" },
  century: { enabled: true, pattern: "[diary]/[C]CEN" },
} as const;

describe("century calendar query", () => {
  it("shows exactly 100 years and keeps the edge decade notes whole", () => {
    const query = selectCenturyCalendar(2026, createParsedNoteIndexSnapshot({
      "diary/C21.md": "century", "diary/2000s.md": "whole decade", "diary/2001.md": "year",
    }, 1), LONG_PERIOD_OPTIONS);
    expect(query.summary.noteState).toBe("has-body");
    expect(query.groups).toHaveLength(11);
    expect(query.groups.flatMap((group) => group.years).map((note) => note.date.year))
      .toEqual(Array.from({ length: 100 }, (_, index) => 2001 + index));
    expect(query.groups[0]).toMatchObject({ partial: true, summary: {
      date: { year: 2000, month: 1, day: 1 }, notePath: "diary/2000s.md", noteState: "has-body",
    } });
    expect(query.groups.at(-1)?.years).toHaveLength(1);
    expect(query.groups.at(-1)?.partial).toBe(true);
  });

  it("handles supported date edges", () => {
    expect(buildCenturyGroups(1).groups.flatMap((group) => group.years)[0]?.year).toBe(1);
    expect(buildCenturyGroups(9999).groups.flatMap((group) => group.years).at(-1)?.year).toBe(9999);
  });
});
