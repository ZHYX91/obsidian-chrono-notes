import { describe, expect, it, vi } from "vitest";

import {
  PeriodicNoteCommands,
  type PeriodicNoteCommandSettings,
} from "../../src/features/periodic/periodic-note-commands";
import { createDefaultSettings } from "../../src/shared/settings";
import { OperationError } from "../../src/shared/operation-error";

describe("periodic cascade feedback", () => {
  it.each([
    [new Error("Monthly template missing"), {
      name: "Error", message: "Monthly template missing",
    }],
    [new Error("Template preparation failed", { cause: new OperationError(
      "templateMissing", "Template file missing", { path: "Templates/Monthly.md" },
    ) }), {
      name: "Error", message: "Template preparation failed",
      details: { code: "templateMissing", path: "Templates/Monthly.md" },
    }],
  ])("retains successful notes and the original failure context for %s", async (failure, expected) => {
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
        if (context.noteType === "monthly") throw failure;
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
    }, settings as PeriodicNoteCommandSettings)).resolves.toMatchObject({
      status: "opened", created: true, path: "Daily/2026-09-17.md",
      cascade: [
        { noteType: "monthly", status: "failed", path: "Monthly/2026-09.md",
          error: expected },
        { noteType: "yearly", status: "created", path: "Yearly/2026.md" },
      ],
    });

    expect(workspace.open).toHaveBeenCalledWith("Daily/2026-09-17.md", "default");
    expect(contents.has("Daily/2026-09-17.md")).toBe(true);
    expect(contents.has("Yearly/2026.md")).toBe(true);
    expect(contents.has("Monthly/2026-09.md")).toBe(false);
  });
});
