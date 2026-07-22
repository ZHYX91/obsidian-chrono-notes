import { describe, expect, it } from "vitest";

import { parseNoteInterval } from "../../src/core/note/note-interval";

describe("parseNoteInterval", () => {
  it("returns no interval when neither frontmatter property is present", () => {
    expect(parseNoteInterval(null)).toEqual({ value: null, error: null });
    expect(parseNoteInterval({ tags: ["project"] })).toEqual({ value: null, error: null });
  });

  it("parses date and datetime strings into one inclusive frozen range", () => {
    const result = parseNoteInterval({
      start: "2026-12-31",
      end: "2027-01-02T11:30:00+08:00",
    });

    expect(result).toMatchObject({
      error: null,
      value: {
        start: {
          value: "2026-12-31",
          date: { year: 2026, month: 12, day: 31 },
          dateKey: "2026-12-31",
          hasTime: false,
        },
        end: {
          value: "2027-01-02T11:30:00+08:00",
          date: { year: 2027, month: 1, day: 2 },
          dateKey: "2027-01-02",
          hasTime: true,
        },
        dayCount: 3,
      },
    });
    expect(result.value?.start.epochMillis).toBeTypeOf("number");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value?.start)).toBe(true);
    expect(Object.isFrozen(result.value?.start.date)).toBe(true);
  });

  it("accepts same-day ranges and trims quoted values", () => {
    const result = parseNoteInterval({
      start: " 2026-05-05T09:00:00 ",
      end: "2026-05-05T11:00:00",
    });

    expect(result.value).toMatchObject({
      start: { value: "2026-05-05T09:00:00", hasTime: true },
      end: { value: "2026-05-05T11:00:00", hasTime: true },
      dayCount: 1,
    });
  });

  it.each([
    [{ start: "2026-05-01" }, "missing-boundary"],
    [{ end: "2026-05-01" }, "missing-boundary"],
    [{ start: 20260501, end: "2026-05-02" }, "invalid-type"],
    [{ start: "", end: "2026-05-02" }, "invalid-value"],
    [{ start: "not-a-date", end: "2026-05-02" }, "invalid-value"],
    [{ start: "12:00", end: "2026-05-02" }, "invalid-value"],
    [{ start: "2026", end: "2026-05-02" }, "invalid-value"],
    [{ start: "2026-05", end: "2026-05-02" }, "invalid-value"],
    [{ start: "2026-123", end: "2026-05-02" }, "invalid-value"],
    [{ start: "2026-W18-5", end: "2026-05-02" }, "invalid-value"],
    [{ start: "20260501", end: "2026-05-02" }, "invalid-value"],
    [{ start: "2026-02-30", end: "2026-03-02" }, "invalid-value"],
    [{ start: "2026-05-03", end: "2026-05-02" }, "reversed-range"],
    [
      { start: "2026-05-02T12:00:00", end: "2026-05-02T09:00:00" },
      "reversed-range",
    ],
  ] as const)("reports invalid interval frontmatter %#", (frontmatter, reason) => {
    const result = parseNoteInterval(frontmatter);

    expect(result.value).toBeNull();
    expect(result.error).toMatchObject({
      name: "NoteIntervalError",
      reason,
    });
    expect(result.error?.message.length).toBeGreaterThan(0);
    expect(Object.isFrozen(result.error)).toBe(true);
  });

  it("preserves complete ISO datetime precision and offset semantics", () => {
    const result = parseNoteInterval({
      start: "2026-05-01T23:30:00.125-04:00",
      end: "2026-05-02T03:30:00.125Z",
    });

    expect(result.value).toMatchObject({
      start: {
        dateKey: "2026-05-01",
        hasTime: true,
      },
      end: {
        dateKey: "2026-05-02",
        hasTime: true,
      },
      dayCount: 2,
    });
    expect(result.value?.start.epochMillis).toBe(result.value?.end.epochMillis);
  });
});
