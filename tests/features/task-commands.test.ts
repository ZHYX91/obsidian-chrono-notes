import { describe, expect, it, vi } from "vitest";

import { parseNote } from "../../src/core/note/parsed-note";
import { TaskCommands } from "../../src/features/tasks/task-commands";

function task(content: string) {
  const value = parseNote("Tasks.md", content).tasks[0];
  if (value === undefined) throw new Error("Task fixture was not parsed");
  return value;
}

describe("TaskCommands", () => {
  it("reads the latest content, writes an accepted toggle, and opens the exact source line", async () => {
    let content = "heading\n- [ ] Work 📅 2026-01-05\n";
    const files = {
      process: vi.fn(async (_path: string, update: (current: string) => string | null) => {
        content = update(content) ?? content;
      }),
    };
    const workspace = { openAtLine: vi.fn(async () => undefined) };
    const commands = new TaskCommands(files, workspace);
    const sourceTask = task(content);

    await expect(commands.toggle(sourceTask)).resolves.toEqual({ status: "updated" });
    expect(content).toBe("heading\n- [x] Work 📅 2026-01-05\n");
    await commands.openSource(sourceTask, "tab");
    expect(workspace.openAtLine).toHaveBeenCalledWith("Tasks.md", 1, "tab");
  });

  it("does not write when the current task identity is stale", async () => {
    const original = "- [ ] Original 📅 2026-01-05";
    let current = "- [ ] Changed 📅 2026-01-05";
    const files = {
      process: vi.fn(async (_path: string, update: (content: string) => string | null) => {
        current = update(current) ?? current;
      }),
    };
    const commands = new TaskCommands(files, { openAtLine: vi.fn() });

    await expect(commands.toggle(task(original))).resolves.toEqual({ status: "stale" });
    expect(current).toBe("- [ ] Changed 📅 2026-01-05");
  });

  it("writes a valid due-date move and leaves no-due tasks unchanged", async () => {
    let content = "- [ ] Move 📅 2026-01-05 ⏳ 2026-01-06";
    const files = {
      process: vi.fn(async (_path: string, update: (current: string) => string | null) => {
        content = update(content) ?? content;
      }),
    };
    const commands = new TaskCommands(files, { openAtLine: vi.fn() });

    await expect(commands.rescheduleDue(
      task(content),
      { year: 2026, month: 1, day: 12 },
    )).resolves.toEqual({ status: "updated" });
    expect(content).toBe("- [ ] Move 📅 2026-01-12 ⏳ 2026-01-06");

    const noDue = "- [ ] Wait ⏳ 2026-01-06";
    content = noDue;
    await expect(commands.rescheduleDue(
      task(noDue),
      { year: 2026, month: 1, day: 12 },
    )).resolves.toEqual({ status: "no-due" });
    expect(content).toBe(noDue);
  });
});
