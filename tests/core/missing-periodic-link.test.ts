import { describe, expect, it } from "vitest";

import {
  matchMissingPeriodicLink,
  type PeriodicNotePathRule,
} from "../../src/core/periodic/periodic-note-path";

const options = { locale: "en", weekStartDay: "monday" } as const;
const daily = {
  enabled: true,
  noteType: "daily",
  pattern: "日记/YYYY/YYYY-MM/YYYY-MM-DD/YYYY-MM-DD",
} as const;
const date = { year: 2026, month: 11, day: 19 };
const fullPath = "日记/2026/2026-11/2026-11-19/2026-11-19.md";

describe("missing periodic link targets", () => {
  it.each([
    "2026-11-19", "2026-11-19.md", "2026-11-19/2026-11-19",
    "2026-11/2026-11-19/2026-11-19", fullPath,
  ])("accepts a complete canonical suffix %s", (link) => {
    expect(matchMissingPeriodicLink(link, [daily], options))
      .toEqual({ noteType: "daily", date, path: fullPath });
  });

  it.each([
    "会议/2026-11-19", "2026-11/2026-11-19", "2026-11-18/2026-11-19", "11-19", "19",
    "2026-02-30", "2026-11-19.png", "", "/2026-11-19", "../2026-11-19",
    "2026-11-19//2026-11-19", "日记/2025/2026-11/2026-11-19/2026-11-19",
  ])("rejects a mismatched, invalid or incomplete target %s", (link) => {
    expect(matchMissingPeriodicLink(link, [daily], options)).toBeNull();
  });

  it("requires enough identity in the supplied segments themselves", () => {
    const rule = { ...daily, pattern: "[Journal]/YYYY/YYYY-MM/DD" };
    expect(matchMissingPeriodicLink("19", [rule], options)).toBeNull();
    expect(matchMissingPeriodicLink("2026-11/19", [rule], options))
      .toEqual({ noteType: "daily", date, path: "Journal/2026/2026-11/19.md" });
  });

  it("uses enabled rules only and declines ambiguous dates even across different folders", () => {
    const monthly = { enabled: true, noteType: "monthly", pattern: "[Months]/YYYY-MM-DD" } as const;
    const link = "2026-11-01";
    expect(matchMissingPeriodicLink(link, [daily, monthly], options)).toBeNull();
    expect(matchMissingPeriodicLink(link, [monthly, daily], options)).toBeNull();
    expect(matchMissingPeriodicLink(link, [{ ...daily, enabled: false }, monthly], options))
      .toEqual({ noteType: "monthly", date: { ...date, day: 1 }, path: "Months/2026-11-01.md" });
    expect(matchMissingPeriodicLink(link, [{ ...monthly, enabled: false }], options)).toBeNull();
  });

  it.each<PeriodicNotePathRule & { link: string; path: string }>([
    { noteType: "weekly", pattern: "[Weeks]/GGGG-[W]WW", link: "2025-W01", path: "Weeks/2025-W01.md" },
    { noteType: "monthly", pattern: "[Archive/Months]/YYYY-MMMM", pathLocale: "fr",
      link: "Months/2026-novembre", path: "Archive/Months/2026-novembre.md" },
    { noteType: "quarterly", pattern: "日记/YYYY-[Q]Q", link: "2026-Q4", path: "日记/2026-Q4.md" },
    { noteType: "yearly", pattern: "日记/YYYY", link: "2026", path: "日记/2026.md" },
    { noteType: "decadal", pattern: "日记/DEC[s]", link: "2020s", path: "日记/2020s.md" },
    { noteType: "century", pattern: "日记/[C]CEN", link: "C21", path: "日记/C21.md" },
  ])("uses the configured $noteType path, language and period boundaries", (rule) => {
    const match = matchMissingPeriodicLink(rule.link, [{ ...rule, enabled: true }], {
      ...options, weekStartDay: "sunday",
    });
    expect(match?.path).toBe(rule.path);
    if (rule.noteType === "weekly") expect(match?.date).toEqual({ year: 2024, month: 12, day: 29 });
  });
});
