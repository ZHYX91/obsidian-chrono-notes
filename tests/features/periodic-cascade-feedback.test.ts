import { describe, expect, it, vi } from "vitest";

import {
  PeriodicNoteCommands,
  type PeriodicNoteCommandSettings,
} from "../../src/features/periodic/periodic-note-commands";
import { createDefaultSettings } from "../../src/shared/settings";

describe("periodic cascade feedback", () => {
  it("keeps successful notes and reports larger-note failures after opening the primary note", async () => {
    const contents = new Map<string, string>();
    const files = {
      exists: vi.fn((path: string) => contents.has(path)),
      create: vi.fn(async (path: string, content: string) => {
        contents.set(path, content);
        return Object.freeze({ identity: { path }, initialContent: content, path });
      }),
      finalize: vi.fn(async () => undefined),
    };
    const templates = {
      prepare: vi.fn(async (context: { noteType?: string }) => {
        if (context.noteType === "monthly") throw new Error("Monthly template missing");
        return Object.freeze({ initialContent: `# ${context.noteType}` });
      }),
    };
    const workspace = { open: vi.fn(async () => undefined) };
    const commands = new PeriodicNoteCommands(
      files,
      templates as never,
      workspace,
    );
    const settings = createDefaultSettings();
    for (const noteType of ["daily", "monthly", "yearly"] as const) {
      settings.periodicNotes[noteType].enabled = true;
    }
    settings.periodicNotes.daily.pattern = "[Daily]/YYYY-MM-DD";
    settings.periodicNotes.monthly.pattern = "[Monthly]/YYYY-MM";
    settings.periodicNotes.yearly.pattern = "[Yearly]/YYYY";

    await expect(commands.openOrCreate({
      date: { year: 2026, month: 9, day: 17 },
      noteType: "daily",
      cascade: true,
    }, settings as PeriodicNoteCommandSettings)).rejects.toThrow(
      "Larger-note creation failed: monthly (Monthly/2026-09.md): Monthly template missing",
    );

    expect(workspace.open).toHaveBeenCalledWith("Daily/2026-09-17.md", "default");
    expect(contents.has("Daily/2026-09-17.md")).toBe(true);
    expect(contents.has("Yearly/2026.md")).toBe(true);
    expect(contents.has("Monthly/2026-09.md")).toBe(false);
  });
});
