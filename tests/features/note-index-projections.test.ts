import { describe, expect, it } from "vitest";

import { parseNote } from "../../src/core/note/parsed-note";
import { NoteIndexProjections } from "../../src/features/notes/note-index-projections";

describe("NoteIndexProjections", () => {
  it("commits high-cardinality batches with one revision and deterministic ordering", () => {
    const projections = new NoteIndexProjections();
    const changes = Array.from({ length: 500 }, (_, index) => {
      const suffix = String(499 - index).padStart(3, "0");
      const path = `Ranges/${suffix}.md`;
      return [path, parseNote(path, [
        "---",
        `start: 2026-01-${String(index % 28 + 1).padStart(2, "0")}`,
        `end: 2026-02-${String(index % 28 + 1).padStart(2, "0")}`,
        "---",
        `- [ ] Task ${suffix} \u{1F4C5} 2026-03-01`,
      ].join("\n"))] as const;
    });

    projections.replaceBatch(changes);

    expect(projections.taskDates.revision).toBe(1);
    expect(projections.intervals.revision).toBe(1);
    expect(projections.taskDates.byDate["2026-03-01"]).toHaveLength(500);
    expect(projections.taskDates.byDate["2026-03-01"]?.map((ref) => ref.task.path))
      .toEqual([...changes].map(([path]) => path).sort());
    expect(projections.intervals.items).toHaveLength(500);
    expect(Object.isFrozen(projections.intervals.items)).toBe(true);

    const oldTaskBucket = projections.taskDates.byDate["2026-03-01"];
    projections.replaceBatch(changes.map(([path, note]) => [path, note] as const));
    expect(projections.taskDates.revision).toBe(1);
    expect(projections.intervals.revision).toBe(1);
    expect(projections.taskDates.byDate["2026-03-01"]).toBe(oldTaskBucket);
  });

  it("indexes valid task dates once with fixed kinds and stable path/line ordering", () => {
    const projections = new NoteIndexProjections();
    projections.replace("Projects/zeta.md", parseNote(
      "Projects/zeta.md",
      "- [ ] Zeta 📅 2026-01-05 ⏳ 2026-01-05 🛫 2026-01-05",
    ));
    projections.replace("Projects/alpha.md", parseNote(
      "Projects/alpha.md",
      [
        "- [ ] Alpha first ⏳ 2026-01-05 📅 2026-01-01",
        "- [x] Alpha second 📅 2026-01-05 ✅ 2026-01-06",
        "- [ ] Invalid 📅 2026-99-99",
        "- [x] Done only ✅ 2026-01-05",
      ].join("\n"),
    ));

    expect(Object.keys(projections.taskDates.byDate).sort()).toEqual([
      "2026-01-01",
      "2026-01-05",
    ]);
    expect(projections.taskDates.byDate["2026-01-05"]?.map((ref) => ({
      path: ref.task.path,
      line: ref.task.line,
      kinds: ref.dateKinds,
    }))).toEqual([
      { path: "Projects/alpha.md", line: 0, kinds: ["scheduled"] },
      { path: "Projects/alpha.md", line: 1, kinds: ["due"] },
      {
        path: "Projects/zeta.md",
        line: 0,
        kinds: ["due", "scheduled", "start"],
      },
    ]);
    expect(projections.taskDates.byDate["2026-01-05"]?.[0]?.dueDate)
      .toEqual({ year: 2026, month: 1, day: 1 });
    expect(Object.isFrozen(projections.taskDates)).toBe(true);
    expect(Object.isFrozen(projections.taskDates.byDate)).toBe(true);
    expect(Object.isFrozen(projections.taskDates.byDate["2026-01-05"])).toBe(true);
    expect(projections.taskDates.byDate["2026-01-05"]?.every(Object.isFrozen)).toBe(true);
  });

  it("changes each sub-snapshot only when its own domain values change", () => {
    const projections = new NoteIndexProjections();
    projections.replace(
      "Projects/task.md",
      parseNote("Projects/task.md", "- [ ] Ship 📅 2026-01-05"),
    );
    const taskBefore = projections.taskDates;
    const intervalsBefore = projections.intervals;

    projections.replace(
      "Projects/task.md",
      parseNote("Projects/task.md", "- [ ] Ship 📅 2026-01-05\nUnrelated prose"),
    );
    expect(projections.taskDates).toBe(taskBefore);
    expect(projections.intervals).toBe(intervalsBefore);

    projections.replace(
      "Projects/task.md",
      parseNote("Projects/task.md", "- [ ] Launch 📅 2026-01-05\nUnrelated prose"),
    );
    expect(projections.taskDates).not.toBe(taskBefore);
    expect(projections.taskDates.revision).toBe(taskBefore.revision + 1);
    expect(projections.intervals).toBe(intervalsBefore);
    const taskAfter = projections.taskDates;

    const intervalContent = "---\nstart: 2026-01-01\nend: 2026-01-07\n---\nPlan";
    projections.replace(
      "Ranges/sprint.md",
      parseNote("Ranges/sprint.md", intervalContent),
    );
    const firstInterval = projections.intervals;
    expect(firstInterval).not.toBe(intervalsBefore);
    expect(projections.taskDates).toBe(taskAfter);

    projections.replace(
      "Ranges/sprint.md",
      parseNote("Ranges/sprint.md", intervalContent),
    );
    expect(projections.intervals).toBe(firstInterval);

    projections.replace(
      "Ranges/sprint.md",
      parseNote("Ranges/sprint.md", `${intervalContent} expanded`),
    );
    expect(projections.intervals).not.toBe(firstInterval);
    expect(projections.intervals.revision).toBe(firstInterval.revision + 1);
    expect(projections.taskDates).toBe(taskAfter);
  });

  it("removes old contributions without mutating older snapshots", () => {
    const projections = new NoteIndexProjections();
    projections.replace(
      "Ranges/old.md",
      parseNote(
        "Ranges/old.md",
        "---\nstart: 2026-01-01\nend: 2026-01-07\n---\n- [ ] Ship 📅 2026-01-05",
      ),
    );
    const oldTasks = projections.taskDates;
    const oldIntervals = projections.intervals;

    projections.replace("Ranges/old.md", null);
    projections.replace(
      "Archive/new.md",
      parseNote(
        "Archive/new.md",
        "---\nstart: 2026-02-01\nend: 2026-02-07\n---\n- [ ] Ship 📅 2026-02-05",
      ),
    );

    expect(oldTasks.byDate["2026-01-05"]?.[0]?.task.path).toBe("Ranges/old.md");
    expect(oldIntervals.items.map((item) => item.path)).toEqual(["Ranges/old.md"]);
    expect(projections.taskDates.byDate["2026-01-05"]).toBeUndefined();
    expect(projections.taskDates.byDate["2026-02-05"]?.[0]?.task.path)
      .toBe("Archive/new.md");
    expect(projections.intervals.items).toMatchObject([
      { path: "Archive/new.md", title: "new" },
    ]);
    expect(Object.isFrozen(oldTasks.byDate["2026-01-05"])).toBe(true);
    expect(Object.isFrozen(oldIntervals.items)).toBe(true);
  });

  it("keeps long intervals as one sorted item rather than expanding covered days", () => {
    const projections = new NoteIndexProjections();
    projections.replace(
      "Ranges/later.md",
      parseNote("Ranges/later.md", "---\nstart: 2101-01-01\nend: 2101-01-02\n---"),
    );
    projections.replace(
      "Ranges/century.md",
      parseNote("Ranges/century.md", "---\nstart: 2000-01-01\nend: 2100-12-31\n---"),
    );

    expect(projections.intervals.items.map((item) => item.path)).toEqual([
      "Ranges/century.md",
      "Ranges/later.md",
    ]);
    expect(projections.intervals.items[0]).toMatchObject({
      path: "Ranges/century.md",
      start: { dateKey: "2000-01-01" },
      end: { dateKey: "2100-12-31" },
    });
    expect(projections.intervals.items).toHaveLength(2);
    expect(Object.keys(projections.intervals.items[0] ?? {})).not.toContain("days");
  });
});
