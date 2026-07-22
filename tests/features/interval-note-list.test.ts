import { describe, expect, it } from "vitest";

import {
  filterIntervalNoteItems,
  type IntervalListOptions,
} from "../../src/features/intervals/interval-note-list";
import { selectIntervalNotes } from "../../src/features/intervals/interval-note-query";
import type { RangeNoteSettings } from "../../src/shared/settings";
import { createParsedNoteIndexSnapshot } from "../support/note-index-snapshot";

function items() {
  const contents: Record<string, string> = {
    "Ranges/trip.md": "---\nstart: 2026-05-10\nend: 2026-05-12\n---",
    "Projects/Sprint.md": "---\nstart: 2026-05-01\nend: 2026-05-20\n---",
    "Projects/launch.md": "---\nstart: 2026-06-01\nend: 2026-06-03\n---",
    "Projects/year-spanning.md": "---\nstart: 2025-12-20\nend: 2026-01-05\n---",
  };
  const snapshot = createParsedNoteIndexSnapshot(contents, 1);
  const settings: RangeNoteSettings = {
    showInCalendar: true,
    folder: "Ranges",
    scanScope: "entire-vault",
    customFolder: "",
    monthViewLimit: 2,
    weekViewLimit: 5,
  };
  return selectIntervalNotes(snapshot, settings).items;
}

function options(overrides: Partial<IntervalListOptions> = {}): IntervalListOptions {
  return {
    query: "",
    scope: "all",
    sort: "start-asc",
    referenceDate: { year: 2026, month: 5, day: 15 },
    ...overrides,
  };
}

describe("filterIntervalNoteItems", () => {
  it("searches title and path without case sensitivity", () => {
    expect(filterIntervalNoteItems(items(), options({ query: "RANGE" }))
      .map((item) => item.title)).toEqual(["trip"]);
    expect(filterIntervalNoteItems(items(), options({ query: "sPrInT" }))
      .map((item) => item.title)).toEqual(["Sprint"]);
  });

  it("filters month and year by overlap rather than start containment", () => {
    expect(filterIntervalNoteItems(items(), options({ scope: "month" }))
      .map((item) => item.title)).toEqual(["Sprint", "trip"]);
    expect(filterIntervalNoteItems(
      items(),
      options({ scope: "year", referenceDate: { year: 2026, month: 1, day: 2 } }),
    ).map((item) => item.title)).toEqual([
      "year-spanning",
      "Sprint",
      "trip",
      "launch",
    ]);
  });

  it("sorts descending while retaining deterministic title and path ties", () => {
    const sourceItems = items();
    const trip = sourceItems.find((item) => item.title === "trip");
    expect(trip).toBeDefined();
    const ties = [
      Object.freeze({ ...trip!, title: "Alpha", path: "zeta.md" }),
      Object.freeze({ ...trip!, title: "Alpha", path: "alpha.md" }),
      Object.freeze({ ...trip!, title: "Zulu", path: "middle.md" }),
    ];
    const result = filterIntervalNoteItems(
      [...sourceItems, ...ties],
      options({ sort: "start-desc" }),
    );
    expect(result.map((item) => `${item.title}:${item.path}`)).toEqual([
      "launch:Projects/launch.md",
      "Alpha:alpha.md",
      "Alpha:zeta.md",
      "trip:Ranges/trip.md",
      "Zulu:middle.md",
      "Sprint:Projects/Sprint.md",
      "year-spanning:Projects/year-spanning.md",
    ]);
    expect(Object.isFrozen(result)).toBe(true);
  });
});
