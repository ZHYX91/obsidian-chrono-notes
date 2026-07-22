import { describe, expect, it } from "vitest";

import { buildMonthGrid } from "../../src/core/calendar/month-grid";
import {
  selectIntervalNotes,
  selectIntervalNotesFromProjection,
  selectIntervalWeekData,
  selectMonthIntervalRowsForGrid,
} from "../../src/features/intervals/interval-note-query";
import type { NoteIndexSnapshot } from "../../src/features/notes/note-index";
import type { RangeNoteSettings } from "../../src/shared/settings";
import {
  createNoteIndexSnapshot,
  createParsedNoteIndexSnapshot,
} from "../support/note-index-snapshot";

function snapshot(contents: Record<string, string>): NoteIndexSnapshot {
  return createParsedNoteIndexSnapshot(contents, 17);
}

function range(start: string, end: string): string {
  return `---\nstart: ${start}\nend: ${end}\n---`;
}

const SETTINGS: RangeNoteSettings = {
  showInCalendar: true,
  folder: "Ranges",
  scanScope: "range-folder",
  customFolder: "Projects",
  monthViewLimit: 2,
  weekViewLimit: 5,
};

describe("interval note queries", () => {
  it("can consume the stable interval sub-snapshot without the notes record", () => {
    const source = snapshot({
      "Ranges/project.md": range("2026-05-04", "2026-05-08"),
      "Notes/ordinary.md": "ordinary",
    });

    const result = selectIntervalNotesFromProjection(source.intervals, SETTINGS);

    expect(result.snapshotVersion).toBe(source.intervals.revision);
    expect(result.items.map((item) => item.path)).toEqual(["Ranges/project.md"]);
  });

  it("carries the indexed note statistics through items and week segments", () => {
    const source = snapshot({
      "Ranges/tasks.md": `${range("2026-05-04", "2026-05-08")}\n- [x] Done\n- [ ] Pending`,
      "Ranges/no-tasks.md": `${range("2026-05-05", "2026-05-06")}\nNotes only`,
    });

    const items = selectIntervalNotes(source, SETTINGS).items;
    expect(items.find((item) => item.title === "tasks")?.statistics).toMatchObject({
      taskCompleted: 1,
      taskTotal: 2,
      taskCompletionRate: 50,
    });
    expect(items.find((item) => item.title === "no-tasks")?.statistics).toMatchObject({
      taskCompleted: 0,
      taskTotal: 0,
      taskCompletionRate: 0,
    });
    expect(Object.isFrozen(items[0]?.statistics)).toBe(true);

    const week = selectIntervalWeekData(items, { year: 2026, month: 5, day: 4 }, 2);
    expect(week.items.find((item) => item.title === "tasks")?.statistics.taskCompleted).toBe(1);
  });

  it("filters exact folder scopes, skips invalid ranges, sorts, and freezes results", () => {
    const source = snapshot({
      "Ranges/zeta.md": range("2026-05-03", "2026-05-05"),
      "Ranges/Nested/alpha.md": range("2026-05-01", "2026-05-04"),
      "Ranges2/not-in-scope.md": range("2026-04-01", "2026-04-02"),
      "Projects/custom.md": range("2026-05-02", "2026-05-03"),
      "Ranges/invalid.md": range("2026-05-10", "2026-05-01"),
      "Ranges/ordinary.md": "No interval",
    });

    const folder = selectIntervalNotes(source, SETTINGS);
    expect(folder.items.map((item) => item.path)).toEqual([
      "Ranges/Nested/alpha.md",
      "Ranges/zeta.md",
    ]);
    expect(folder.snapshotVersion).toBe(17);
    expect(Object.isFrozen(folder)).toBe(true);
    expect(Object.isFrozen(folder.items)).toBe(true);
    expect(folder.items.every(Object.isFrozen)).toBe(true);

    expect(selectIntervalNotes(source, { ...SETTINGS, scanScope: "custom-folder" })
      .items.map((item) => item.path)).toEqual(["Projects/custom.md"]);
    const entireVault = selectIntervalNotes(source, {
      ...SETTINGS,
      scanScope: "entire-vault",
    });
    expect(entireVault.items).toBe(source.intervals.items);
    expect(entireVault.items.map((item) => item.path)).toEqual([
      "Ranges2/not-in-scope.md",
      "Ranges/Nested/alpha.md",
      "Projects/custom.md",
      "Ranges/zeta.md",
    ]);
  });

  it("returns before touching notes when the configured scope folder is empty", () => {
    const empty = createNoteIndexSnapshot({}, 18);
    const source = Object.freeze(Object.defineProperty(
      {
        version: 18,
        taskDates: empty.taskDates,
        intervals: empty.intervals,
      },
      "notes",
      {
        enumerable: true,
        get(): never {
          throw new Error("notes should not be scanned");
        },
      },
    )) as NoteIndexSnapshot;

    const result = selectIntervalNotes(source, {
      ...SETTINGS,
      folder: "",
      scanScope: "range-folder",
    });

    expect(result).toEqual({ snapshotVersion: 18, items: [] });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.items)).toBe(true);
  });

  it("filters the interval sub-snapshot without scanning ordinary notes", () => {
    const indexed = snapshot({
      "Ranges/project.md": range("2026-05-01", "2026-05-04"),
      "Other/ignored.md": range("2026-05-02", "2026-05-03"),
      "Notes/ordinary.md": "ordinary",
    });
    const source = Object.freeze(Object.defineProperty(
      {
        version: indexed.version,
        taskDates: indexed.taskDates,
        intervals: indexed.intervals,
      },
      "notes",
      {
        enumerable: true,
        get(): never {
          throw new Error("interval selection must not scan notes");
        },
      },
    )) as NoteIndexSnapshot;

    expect(selectIntervalNotes(source, SETTINGS).items.map((item) => item.path))
      .toEqual(["Ranges/project.md"]);
  });

  it("clips overlapping ranges to week columns and reports stable overflow", () => {
    const items = selectIntervalNotes(snapshot({
      "Ranges/before.md": range("2026-05-01", "2026-05-10"),
      "Ranges/inside.md": range("2026-05-04", "2026-05-08"),
      "Ranges/after.md": range("2026-05-06", "2026-05-14"),
      "Ranges/outside.md": range("2026-05-20", "2026-05-21"),
    }), SETTINGS).items;

    const week = selectIntervalWeekData(items, { year: 2026, month: 5, day: 4 }, 2);
    expect(week).toMatchObject({
      totalCount: 3,
      hiddenCount: 1,
      hiddenItems: [{
        title: "after",
        statistics: { taskCompleted: 0, taskTotal: 0 },
      }],
      items: [
        {
          path: "Ranges/before.md",
          startColumn: 0,
          endColumn: 6,
          startsBeforeWeek: true,
          lane: 0,
        },
        { path: "Ranges/inside.md", startColumn: 0, endColumn: 4, lane: 1 },
      ],
    });
    expect(Object.isFrozen(week)).toBe(true);
    expect(Object.isFrozen(week.items)).toBe(true);
    expect(Object.isFrozen(week.hiddenItems)).toBe(true);
    expect(week.hiddenItems.every(Object.isFrozen)).toBe(true);
  });

  it("does not stop at an out-of-window date when offset timestamps sort earlier", () => {
    const source = snapshot({
      "Ranges/epoch-first-date-later.md": range(
        "2026-07-06T00:00:00+14:00",
        "2026-07-06T01:00:00+14:00",
      ),
      "Ranges/epoch-later-date-visible.md": range(
        "2026-07-05T23:00:00-12:00",
        "2026-07-05T23:30:00-12:00",
      ),
    });
    const items = selectIntervalNotes(source, SETTINGS).items;

    expect(items.map((item) => item.path)).toEqual([
      "Ranges/epoch-first-date-later.md",
      "Ranges/epoch-later-date-visible.md",
    ]);
    const week = selectIntervalWeekData(
      items,
      { year: 2026, month: 6, day: 29 },
      5,
    );
    expect(week.items.map((item) => item.path)).toEqual([
      "Ranges/epoch-later-date-visible.md",
    ]);

    const month = selectMonthIntervalRowsForGrid(
      buildMonthGrid(2026, 6, "monday"),
      source,
      SETTINGS,
    );
    expect(month.rows.at(-1)?.data.items.map((item) => item.path)).toEqual([
      "Ranges/epoch-later-date-visible.md",
    ]);
  });

  it("keeps three configured month lanes visible and summarizes later lanes", () => {
    const items = selectIntervalNotes(snapshot({
      "Ranges/alpha.md": range("2026-05-04", "2026-05-10"),
      "Ranges/bravo.md": range("2026-05-04", "2026-05-10"),
      "Ranges/charlie.md": range("2026-05-04", "2026-05-10"),
      "Ranges/delta.md": range("2026-05-04", "2026-05-10"),
    }), SETTINGS).items;

    const week = selectIntervalWeekData(
      items,
      { year: 2026, month: 5, day: 4 },
      3,
    );

    expect(week.visibleLaneCount).toBe(3);
    expect(week.items.map((item) => item.lane)).toEqual([0, 1, 2]);
    expect(week.hiddenCount).toBe(1);
    expect(week.hiddenItems.map((item) => item.title)).toEqual(["delta"]);
    expect(week.totalCount).toBe(4);
  });

  it("builds only intersecting month rows from one snapshot and honors visibility and limits", () => {
    const source = snapshot({
      "Ranges/spanning.md": range("2026-04-30", "2026-05-10"),
      "Ranges/second.md": range("2026-05-04", "2026-05-06"),
    });
    const result = selectMonthIntervalRowsForGrid(
      buildMonthGrid(2026, 5, "monday"),
      source,
      { ...SETTINGS, monthViewLimit: 1 },
    );

    expect(result.snapshotVersion).toBe(17);
    expect(result.rows).toHaveLength(5);
    expect(result.rows[0]).toMatchObject({
      weekStart: { year: 2026, month: 4, day: 27 },
      data: { totalCount: 1, items: [{ endsAfterWeek: true, lane: 0 }] },
    });
    expect(result.rows[1]).toMatchObject({
      weekStart: { year: 2026, month: 5, day: 4 },
      data: { totalCount: 2, hiddenCount: 1 },
    });
    expect(result.rows.slice(2).every((row) => row.data.totalCount === 0))
      .toBe(true);
    expect(result.rows[0]?.data.items[0]?.colorIndex)
      .toBe(result.rows[1]?.data.items[0]?.colorIndex);
    expect(selectMonthIntervalRowsForGrid(
      buildMonthGrid(2026, 5, "monday"),
      source,
      { ...SETTINGS, showInCalendar: false },
    ).rows.every((row) => row.data.totalCount === 0)).toBe(true);
  });

  it("reuses lanes for non-overlapping notes and keeps path colors stable", () => {
    const items = selectIntervalNotes(snapshot({
      "Ranges/first.md": range("2026-05-04", "2026-05-05"),
      "Ranges/second.md": range("2026-05-06", "2026-05-07"),
      "Ranges/overlap.md": range("2026-05-05", "2026-05-08"),
    }), SETTINGS).items;
    const first = selectIntervalWeekData(items, { year: 2026, month: 5, day: 4 }, 3);
    const second = selectIntervalWeekData(items, { year: 2026, month: 5, day: 4 }, 3);

    expect(first.items.map(({ title, lane }) => [title, lane])).toEqual([
      ["first", 0],
      ["overlap", 1],
      ["second", 0],
    ]);
    expect(first.items.map(({ colorIndex }) => colorIndex))
      .toEqual(second.items.map(({ colorIndex }) => colorIndex));
  });
});
