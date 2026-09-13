import { describe, expect, it, vi } from "vitest";

import { PeriodicNoteCommands } from "../../src/features/periodic/periodic-note-commands";
import { createDefaultSettings } from "../../src/shared/settings";

describe("periodic note command identity boundary", () => {
  it("does not open or create a shared monthly path on behalf of a daily note", async () => {
    const files = {
      exists: vi.fn(() => true),
      create: vi.fn(async () => ({ identity: {}, initialContent: "", path: "unused.md" })),
      finalize: vi.fn(async () => undefined),
    };
    const templates = { prepare: vi.fn(async () => ({ initialContent: "" })) };
    const workspace = { open: vi.fn(async () => undefined) };
    const commands = new PeriodicNoteCommands(files, templates, workspace);
    const settings = createDefaultSettings();
    settings.periodicNotes.daily = {
      enabled: true, pattern: "[Daily]/YYYY-MM", templatePath: "",
    };
    for (const day of [13, 14]) {
      await expect(commands.openOrCreate({
        date: { year: 2026, month: 9, day }, noteType: "daily",
      }, {
        locale: "en-US", weekStartDay: "monday",
        periodicNotes: settings.periodicNotes, templateEngine: "builtin",
      })).resolves.toEqual({ status: "not-configured", noteType: "daily" });
    }
    expect(files.exists).not.toHaveBeenCalled();
    expect(files.create).not.toHaveBeenCalled();
    expect(files.finalize).not.toHaveBeenCalled();
    expect(templates.prepare).not.toHaveBeenCalled();
    expect(workspace.open).not.toHaveBeenCalled();
  });
});
