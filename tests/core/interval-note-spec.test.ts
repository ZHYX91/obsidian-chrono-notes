import { describe, expect, it } from "vitest";

import {
  buildIntervalNoteContent,
  buildIntervalNoteSpec,
  normalizeIntervalNoteDates,
} from "../../src/core/note/interval-note-spec";

describe("interval note spec", () => {
  it("normalizes reversed dates and builds a deterministic inclusive spec", () => {
    const normalized = normalizeIntervalNoteDates(
      { year: 2026, month: 5, day: 9 },
      { year: 2026, month: 5, day: 6 },
    );
    expect(normalized).toEqual({
      start: { year: 2026, month: 5, day: 6 },
      end: { year: 2026, month: 5, day: 9 },
    });

    const spec = buildIntervalNoteSpec(
      normalized.start,
      normalized.end,
      " /Calendar\\Range Notes// ",
    );
    expect(spec).toEqual({
      start: { year: 2026, month: 5, day: 6 },
      end: { year: 2026, month: 5, day: 9 },
      dayCount: 4,
      title: "2026-05-06 - 2026-05-09",
      path: "Calendar/Range Notes/2026-05-06 - 2026-05-09.md",
    });
    expect(Object.isFrozen(spec)).toBe(true);
    expect(Object.isFrozen(spec.start)).toBe(true);
  });

  it("emits minimal start/end frontmatter and rejects an empty folder", () => {
    const spec = buildIntervalNoteSpec(
      { year: 2026, month: 12, day: 31 },
      { year: 2027, month: 1, day: 2 },
      "Ranges",
    );
    expect(buildIntervalNoteContent(spec)).toBe([
      "---",
      "start: 2026-12-31",
      "end: 2027-01-02",
      "---",
      "",
      "# 2026-12-31 - 2027-01-02",
      "",
    ].join("\n"));
    expect(() => buildIntervalNoteSpec(spec.start, spec.end, " / ")).toThrow(
      "Range note folder must not be empty",
    );
  });
});
