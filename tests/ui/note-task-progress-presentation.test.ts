import { describe, expect, it } from "vitest";

import { createTranslator } from "../../src/shared/i18n";
import {
  formatCompactNoteTaskProgress,
  formatNoteTaskProgress,
  getNoteTaskProgressPresentation,
} from "../../src/ui/note-task-progress-presentation";
import { noteStatistics } from "../support/note-statistics";

describe("note task progress presentation", () => {
  it.each([
    { completed: 0, total: 0, state: "none", fraction: 0 },
    { completed: 0, total: 4, state: "not-started", fraction: 0 },
    { completed: 1, total: 4, state: "in-progress", fraction: 0.25 },
    { completed: 4, total: 4, state: "complete", fraction: 1 },
  ] as const)("classifies $completed/$total as $state", ({
    completed,
    total,
    state,
    fraction,
  }) => {
    expect(getNoteTaskProgressPresentation(noteStatistics({
      taskCompleted: completed,
      taskTotal: total,
    }))).toEqual({
      state,
      fraction,
    });
  });

  it("formats both an accessible label and a compact exact count", () => {
    const t = createTranslator("en", "en").t;
    const partial = noteStatistics({ taskCompleted: 1, taskTotal: 2 });
    const none = noteStatistics();

    expect(formatNoteTaskProgress(partial, t)).toBe("1/2 tasks complete");
    expect(formatCompactNoteTaskProgress(partial, t)).toBe("1/2");
    expect(formatNoteTaskProgress(none, t)).toBe("No tasks");
    expect(formatCompactNoteTaskProgress(none, t)).toBe("No tasks");
  });

  it("clamps progress geometry while preserving the indexed counts", () => {
    expect(getNoteTaskProgressPresentation(noteStatistics({
      taskCompleted: 9,
      taskTotal: 4,
    }))).toEqual({
      state: "complete",
      fraction: 1,
    });
  });
});
