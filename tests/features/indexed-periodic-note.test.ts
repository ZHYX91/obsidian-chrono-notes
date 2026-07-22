import { describe, expect, it } from "vitest";

import {
  canOpenOrCreateIndexedPeriodicNote,
  isPeriodicNotePathIndexing,
  selectIndexedPeriodicNote,
} from "../../src/features/calendar/indexed-periodic-note";
import { createParsedNoteIndexSnapshot } from "../support/note-index-snapshot";

const DATE = Object.freeze({ year: 2026, month: 7, day: 20 });
const CONTEXT = Object.freeze({ locale: "en", weekStartDay: "monday" as const });
const RULE = Object.freeze({ enabled: true, pattern: "'Daily'/yyyy-MM-dd" });

describe("indexed periodic note", () => {
  it("withholds note actions only while a configured path is unknown", () => {
    expect(canOpenOrCreateIndexedPeriodicNote("indexing")).toBe(false);
    expect(canOpenOrCreateIndexedPeriodicNote("not-configured")).toBe(false);
    expect(canOpenOrCreateIndexedPeriodicNote("missing")).toBe(true);
    expect(canOpenOrCreateIndexedPeriodicNote("has-body")).toBe(true);
  });

  it("keeps an absent path unknown while the index is updating", () => {
    const ready = createParsedNoteIndexSnapshot({}, 1);
    const indexing = Object.freeze({
      ...ready,
      version: 2,
      readiness: "indexing" as const,
    });

    expect(selectIndexedPeriodicNote(
      DATE,
      "daily",
      indexing,
      CONTEXT,
      RULE,
    ).noteState).toBe("indexing");
    expect(isPeriodicNotePathIndexing(
      DATE,
      "daily",
      indexing,
      CONTEXT,
      RULE,
    )).toBe(true);
    expect(selectIndexedPeriodicNote(
      DATE,
      "daily",
      ready,
      CONTEXT,
      RULE,
    ).noteState).toBe("missing");
  });

  it("allows an already indexed path and ignores disabled rules", () => {
    const parsed = createParsedNoteIndexSnapshot({
      "Daily/2026-07-20.md": "existing",
    }, 1);
    const indexing = Object.freeze({
      ...parsed,
      version: 2,
      readiness: "indexing" as const,
    });

    expect(isPeriodicNotePathIndexing(
      DATE,
      "daily",
      indexing,
      CONTEXT,
      RULE,
    )).toBe(false);
    expect(isPeriodicNotePathIndexing(
      DATE,
      "daily",
      indexing,
      CONTEXT,
      { ...RULE, enabled: false },
    )).toBe(false);
  });
});
