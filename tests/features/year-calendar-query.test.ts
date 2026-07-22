import { describe, expect, it } from "vitest";

import { parseNote } from "../../src/core/note/parsed-note";
import {
  selectYearCalendar,
  selectYearCalendarOverview,
} from "../../src/features/calendar/year-calendar-query";
import type {
  NoteIndexSnapshot,
  PresentNoteIndexEntry,
} from "../../src/features/notes/note-index";
import { createNoteIndexSnapshot } from "../support/note-index-snapshot";

function snapshot(
  entries: Record<string, PresentNoteIndexEntry>,
): NoteIndexSnapshot {
  return createNoteIndexSnapshot(entries, 11);
}

describe("selectYearCalendar", () => {
  it("builds overview summaries without allocating daily heatmap cells", () => {
    const result = selectYearCalendarOverview(
      2026,
      snapshot({
        "Monthly/2026-07.md": Object.freeze({
          kind: "parsed",
          revision: 1,
          note: parseNote("Monthly/2026-07.md", "July summary"),
        }),
      }),
      {
        locale: "en-US",
        weekStartDay: "monday",
        monthly: { enabled: true, pattern: "'Monthly'/yyyy-MM" },
        quarterly: { enabled: false, pattern: "" },
      },
    );

    expect(result.quarters).toHaveLength(4);
    expect(result.quarters.flatMap((quarter) => quarter.months)).toHaveLength(
      12,
    );
    expect(
      result.quarters.flatMap((quarter) =>
        quarter.months.flatMap((month) => month.heatmapCells),
      ),
    ).toEqual([]);
    expect(result.quarters[2]?.months[0]?.summary).toMatchObject({
      notePath: "Monthly/2026-07.md",
      noteState: "has-body",
    });
    expect(
      result.quarters.every((quarter) =>
        quarter.months.every((month) => Object.isFrozen(month.heatmapCells)),
      ),
    ).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("builds four quarter rows, twelve months, and every leap-year day", () => {
    const result = selectYearCalendar(2024, snapshot({}), {
      locale: "en-US",
      weekStartDay: "monday",
      statisticDisplayDimension: "word-count",
      statisticValueStep: 200,
      daily: { enabled: false, pattern: "" },
      monthly: { enabled: false, pattern: "" },
      quarterly: { enabled: false, pattern: "" },
    });

    expect(result.year).toBe(2024);
    expect(result.noteSnapshotVersion).toBe(11);
    expect(result.quarters).toHaveLength(4);
    expect(result.quarters.flatMap((quarter) => quarter.months)).toHaveLength(
      12,
    );
    expect(
      result.quarters.flatMap((quarter) =>
        quarter.months.flatMap((month) => month.heatmapCells.filter(Boolean)),
      ),
    ).toHaveLength(366);
    expect(result.quarters[0]?.months[0]?.heatmapCells[0]).toMatchObject({
      date: { year: 2024, month: 1, day: 1 },
    });
    expect(
      result.quarters[0]?.months[1]?.heatmapCells.filter(Boolean),
    ).toHaveLength(29);
  });

  it("maps month, quarter, and daily states through one NoteIndex snapshot", () => {
    const result = selectYearCalendar(
      2024,
      snapshot({
        "Monthly/2024-09.md": Object.freeze({
          kind: "parsed",
          revision: 1,
          note: parseNote(
            "Monthly/2024-09.md",
            "September summary\n- [ ] open\n- [x] done",
          ),
        }),
        "Quarterly/2024-Q3.md": Object.freeze({
          kind: "error",
          path: "Quarterly/2024-Q3.md",
          revision: 2,
          error: Object.freeze({
            name: "Error",
            message: "quarter read failed",
          }),
        }),
        "Daily/2024-02-29.md": Object.freeze({
          kind: "parsed",
          revision: 1,
          note: parseNote("Daily/2024-02-29.md", "one two three four five"),
        }),
        "Quarterly/2024-Q4.md": Object.freeze({
          kind: "parsed",
          revision: 1,
          note: parseNote("Quarterly/2024-Q4.md", "- [ ] first\n- [ ] second"),
        }),
      }),
      {
        locale: "en-US",
        weekStartDay: "monday",
        statisticDisplayDimension: "word-count",
        statisticValueStep: 2,
        daily: { enabled: true, pattern: "'Daily'/yyyy-MM-dd" },
        monthly: { enabled: true, pattern: "'Monthly'/yyyy-MM" },
        quarterly: { enabled: true, pattern: "'Quarterly'/yyyy-'Q'q" },
      },
    );
    const thirdQuarter = result.quarters[2];
    const september = thirdQuarter?.months[2];
    const leapDay = result.quarters[0]?.months[1]?.heatmapCells.find(
      (cell) => cell?.date.day === 29,
    );

    expect(thirdQuarter?.summary).toMatchObject({
      date: { year: 2024, month: 7, day: 1 },
      notePath: "Quarterly/2024-Q3.md",
      noteState: "error",
      errorMessage: "quarter read failed",
    });
    expect(september?.summary).toMatchObject({
      notePath: "Monthly/2024-09.md",
      noteState: "has-body",
      statistics: { taskCompleted: 1, taskTotal: 2 },
    });
    expect(result.quarters[3]?.summary).toMatchObject({
      notePath: "Quarterly/2024-Q4.md",
      statistics: { taskCompleted: 0, taskTotal: 2 },
    });
    expect(leapDay).toMatchObject({
      notePath: "Daily/2024-02-29.md",
      noteState: "has-body",
      heatmap: { dimension: "word-count", value: 5, level: 3 },
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.quarters)).toBe(true);
    expect(Object.isFrozen(thirdQuarter)).toBe(true);
    expect(Object.isFrozen(september?.heatmapCells)).toBe(true);
    expect(Object.isFrozen(september?.summary.statistics)).toBe(true);
    expect(Object.isFrozen(leapDay?.heatmap)).toBe(true);
  });

  it("uses null gaps outside each month and respects Sunday week starts", () => {
    const result = selectYearCalendar(2024, snapshot({}), {
      locale: "en-US",
      weekStartDay: "sunday",
      statisticDisplayDimension: "tag-count",
      statisticValueStep: 1,
      daily: { enabled: true, pattern: "'Daily'/yyyy-MM-dd" },
      monthly: { enabled: true, pattern: "'Monthly'/yyyy-MM" },
      quarterly: { enabled: true, pattern: "'Quarterly'/yyyy-'Q'q" },
    });
    const january = result.quarters[0]?.months[0];

    expect(january?.heatmapCells.slice(0, 1)).toEqual([null]);
    expect(january?.heatmapCells[1]).toMatchObject({ date: { day: 1 } });
    expect(january?.summary.noteState).toBe("missing");
    expect(result.quarters[0]?.summary.noteState).toBe("missing");
  });
});
