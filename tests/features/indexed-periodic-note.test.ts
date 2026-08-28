import { describe, expect, it } from "vitest";

import {
  canOpenOrCreateIndexedPeriodicNote,
  getIndexedPeriodicNoteExistence,
  selectIndexedPeriodicNote,
} from "../../src/features/calendar/indexed-periodic-note";
import { createParsedNoteIndexSnapshot } from "../support/note-index-snapshot";

const DATE = Object.freeze({ year: 2026, month: 7, day: 20 });
const CONTEXT = Object.freeze({ locale: "en", weekStartDay: "monday" as const });
const RULE = Object.freeze({ enabled: true, pattern: "[Daily]/YYYY-MM-DD" });

describe("indexed periodic note", () => {
  it("allows note actions for every configured state", () => {
    expect(canOpenOrCreateIndexedPeriodicNote("indexing")).toBe(true);
    expect(canOpenOrCreateIndexedPeriodicNote("not-configured")).toBe(false);
    expect(canOpenOrCreateIndexedPeriodicNote("missing")).toBe(true);
    expect(canOpenOrCreateIndexedPeriodicNote("has-body")).toBe(true);
  });

  it("keeps index-derived existence honest while a path is unknown", () => {
    expect(getIndexedPeriodicNoteExistence("indexing")).toBeNull();
    expect(getIndexedPeriodicNoteExistence("not-configured")).toBeNull();
    expect(getIndexedPeriodicNoteExistence("missing")).toBe(false);
    expect(getIndexedPeriodicNoteExistence("has-body")).toBe(true);
    expect(getIndexedPeriodicNoteExistence("error")).toBe(true);
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
    expect(selectIndexedPeriodicNote(
      DATE,
      "daily",
      ready,
      CONTEXT,
      RULE,
    ).noteState).toBe("missing");
  });

  it("reports already indexed paths during a live update", () => {
    const parsed = createParsedNoteIndexSnapshot({
      "Daily/2026-07-20.md": "existing",
    }, 1);
    const indexing = Object.freeze({
      ...parsed,
      version: 2,
      readiness: "indexing" as const,
    });

    expect(getIndexedPeriodicNoteExistence(selectIndexedPeriodicNote(
      DATE,
      "daily",
      indexing,
      CONTEXT,
      RULE,
    ).noteState)).toBe(true);
    expect(selectIndexedPeriodicNote(
      DATE,
      "daily",
      indexing,
      CONTEXT,
      { ...RULE, enabled: false },
    ).noteState).toBe("not-configured");
  });
});
