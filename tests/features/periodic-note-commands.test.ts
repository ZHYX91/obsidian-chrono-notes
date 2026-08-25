import { describe, expect, it, vi } from "vitest";

import type { PeriodicNoteType } from "../../src/core/periodic/periodic-date";
import {
  PeriodicNoteCommands,
  PeriodicNoteCreationError,
  type PeriodicNoteCommandSettings,
  type PeriodicNoteFilePort,
  type PeriodicNoteWorkspacePort,
} from "../../src/features/periodic/periodic-note-commands";
import type { NoteTemplatePort } from "../../src/features/templates/note-template-port";
import type { PeriodicNoteSettings } from "../../src/shared/settings";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function createSettings(
  overrides: Partial<Record<PeriodicNoteType, Partial<PeriodicNoteSettings>>> = {},
): PeriodicNoteCommandSettings {
  const create = (noteType: PeriodicNoteType): PeriodicNoteSettings => ({
    enabled: false,
    pattern: "",
    templatePath: "",
    ...overrides[noteType],
  });
  return {
    locale: "en-US",
    weekStartDay: "monday",
    templateEngine: "builtin",
    periodicNotes: {
      daily: create("daily"),
      weekly: create("weekly"),
      monthly: create("monthly"),
      quarterly: create("quarterly"),
      yearly: create("yearly"),
    },
  };
}

function createPorts(existing: readonly string[] = []) {
  const paths = new Set(existing);
  const contents = new Map<string, string>();
  const identities = new Map<string, object>();
  const files: PeriodicNoteFilePort = {
    exists: vi.fn((path) => paths.has(path)),
    create: vi.fn(async (path, content) => {
      const identity = { path };
      paths.add(path);
      contents.set(path, content);
      identities.set(path, identity);
      return Object.freeze({ identity, initialContent: content, path });
    }),
    finalize: vi.fn(async (reference, content) => {
      if (
        identities.get(reference.path) !== reference.identity ||
        contents.get(reference.path) !== reference.initialContent
      ) {
        throw new Error(`Created note changed: ${reference.path}`);
      }
      contents.set(reference.path, content);
    }),
  };
  const templates: NoteTemplatePort = {
    prepare: vi.fn(async (_context, defaultContent) => ({
      initialContent: defaultContent,
    })),
  };
  const workspace: PeriodicNoteWorkspacePort = {
    open: vi.fn(async () => undefined),
  };
  return { files, templates, workspace, paths, contents, identities };
}

describe("PeriodicNoteCommands", () => {
  it("coordinates same-path creation while preserving each request target and cascade", async () => {
    const ports = createPorts();
    const preparation = deferred<{ initialContent: string }>();
    vi.mocked(ports.templates.prepare).mockReturnValueOnce(preparation.promise);
    const commands = new PeriodicNoteCommands(ports.files, ports.templates, ports.workspace);
    const settings = createSettings({
      daily: { enabled: true, pattern: "[Daily]/YYYY-MM-DD" },
      monthly: { enabled: true, pattern: "[Monthly]/YYYY-MM" },
    });
    const date = { year: 2026, month: 5, day: 18 } as const;

    const first = commands.openOrCreate(
      { date, noteType: "daily", target: "default" },
      settings,
    );
    await vi.waitFor(() => expect(ports.templates.prepare).toHaveBeenCalledOnce());
    const second = commands.openOrCreate(
      { date, noteType: "daily", target: "tab", cascade: true },
      settings,
    );
    expect(ports.workspace.open).not.toHaveBeenCalled();

    preparation.resolve({ initialContent: "" });
    await expect(Promise.all([first, second])).resolves.toEqual([
      {
        status: "opened",
        path: "Daily/2026-05-18.md",
        created: true,
        cascade: [],
      },
      {
        status: "opened",
        path: "Daily/2026-05-18.md",
        created: false,
        cascade: [
          { noteType: "monthly", path: "Monthly/2026-05.md", status: "created" },
        ],
      },
    ]);

    expect(ports.files.create).toHaveBeenCalledTimes(2);
    expect(ports.files.create).toHaveBeenCalledWith("Daily/2026-05-18.md", "");
    expect(ports.workspace.open).toHaveBeenCalledWith("Daily/2026-05-18.md", "default");
    expect(ports.workspace.open).toHaveBeenCalledWith("Daily/2026-05-18.md", "tab");
  });

  it("returns not-configured without touching external ports", async () => {
    const ports = createPorts();
    const commands = new PeriodicNoteCommands(ports.files, ports.templates, ports.workspace);

    await expect(
      commands.openOrCreate(
        { date: { year: 2026, month: 5, day: 18 }, noteType: "daily" },
        createSettings(),
      ),
    ).resolves.toEqual({ status: "not-configured", noteType: "daily" });
    expect(ports.files.exists).not.toHaveBeenCalled();
    expect(ports.workspace.open).not.toHaveBeenCalled();
  });

  it("opens an existing note without creating, templating, or cascading", async () => {
    const ports = createPorts(["Daily/2026-05-18.md"]);
    const commands = new PeriodicNoteCommands(ports.files, ports.templates, ports.workspace);
    const settings = createSettings({
      daily: { enabled: true, pattern: "[Daily]/YYYY-MM-DD" },
      monthly: { enabled: true, pattern: "[Monthly]/YYYY-MM" },
    });

    await expect(
      commands.openOrCreate(
        {
          date: { year: 2026, month: 5, day: 18 },
          noteType: "daily",
          target: "tab",
          cascade: true,
        },
        settings,
      ),
    ).resolves.toEqual({
      status: "opened",
      path: "Daily/2026-05-18.md",
      created: false,
      cascade: [],
    });
    expect(ports.workspace.open).toHaveBeenCalledWith("Daily/2026-05-18.md", "tab");
    expect(ports.files.create).not.toHaveBeenCalled();
    expect(ports.templates.prepare).not.toHaveBeenCalled();
  });

  it("cancels before creating when confirmation is declined", async () => {
    const ports = createPorts();
    const commands = new PeriodicNoteCommands(ports.files, ports.templates, ports.workspace);
    const confirmCreate = vi.fn(async () => false);
    const settings = createSettings({
      daily: { enabled: true, pattern: "[Daily]/YYYY-MM-DD" },
    });

    await expect(
      commands.openOrCreate(
        {
          date: { year: 2026, month: 5, day: 18 },
          noteType: "daily",
          confirmCreate,
        },
        settings,
      ),
    ).resolves.toEqual({
      status: "cancelled",
      noteType: "daily",
      path: "Daily/2026-05-18.md",
    });
    expect(confirmCreate).toHaveBeenCalledWith({
      date: { year: 2026, month: 5, day: 18 },
      noteType: "daily",
      path: "Daily/2026-05-18.md",
    });
    expect(ports.files.create).not.toHaveBeenCalled();
  });

  it("creates, populates, and opens a note with one canonical context", async () => {
    const ports = createPorts();
    vi.mocked(ports.templates.prepare).mockResolvedValueOnce({
      initialContent: "# rendered quarterly note",
    });
    const commands = new PeriodicNoteCommands(ports.files, ports.templates, ports.workspace);
    const settings = createSettings({
      quarterly: {
        enabled: true,
        pattern: "[Quarterly]/YYYY-[Q]Q",
        templatePath: "Templates/Quarterly.md",
      },
    });

    await expect(
      commands.openOrCreate(
        { date: { year: 2026, month: 5, day: 18 }, noteType: "quarterly" },
        settings,
      ),
    ).resolves.toEqual({
      status: "opened",
      path: "Quarterly/2026-Q2.md",
      created: true,
      cascade: [],
    });
    expect(ports.templates.prepare).toHaveBeenCalledWith(
      {
        kind: "periodic",
        date: { year: 2026, month: 4, day: 1 },
        locale: "en-US",
        noteType: "quarterly",
        path: "Quarterly/2026-Q2.md",
        templatePath: "Templates/Quarterly.md",
        templateEngine: "builtin",
        title: "2026-Q2",
      },
      "",
    );
    expect(ports.files.create).toHaveBeenCalledWith(
      "Quarterly/2026-Q2.md",
      "# rendered quarterly note",
    );
    expect(ports.files.finalize).not.toHaveBeenCalled();
    expect(ports.workspace.open).toHaveBeenCalledWith("Quarterly/2026-Q2.md", "default");
  });

  it("fails before file creation when template preparation fails", async () => {
    const ports = createPorts();
    vi.mocked(ports.templates.prepare).mockRejectedValueOnce(new Error("template boom"));
    const commands = new PeriodicNoteCommands(ports.files, ports.templates, ports.workspace);
    const settings = createSettings({
      daily: { enabled: true, pattern: "[Daily]/YYYY-MM-DD" },
    });

    const promise = commands.openOrCreate(
      { date: { year: 2026, month: 5, day: 18 }, noteType: "daily" },
      settings,
    );
    await expect(promise).rejects.toMatchObject({
      name: "PeriodicNoteCreationError",
      message:
        "Failed to create daily note at Daily/2026-05-18.md: template boom",
      path: "Daily/2026-05-18.md",
      noteType: "daily",
      cause: new Error("template boom"),
    } satisfies Partial<PeriodicNoteCreationError>);
    expect(ports.files.create).not.toHaveBeenCalled();
    expect(ports.paths.has("Daily/2026-05-18.md")).toBe(false);
    expect(ports.workspace.open).not.toHaveBeenCalled();
  });

  it("retains a Templater target when deferred rendering fails", async () => {
    const ports = createPorts();
    vi.mocked(ports.templates.prepare).mockResolvedValueOnce({
      initialContent: "",
      renderAfterCreate: vi.fn(async () => {
        throw new Error("templater boom");
      }),
    });
    const commands = new PeriodicNoteCommands(ports.files, ports.templates, ports.workspace);
    const settings = createSettings({
      daily: { enabled: true, pattern: "[Daily]/YYYY-MM-DD" },
    });

    await expect(commands.openOrCreate(
      { date: { year: 2026, month: 5, day: 18 }, noteType: "daily" },
      settings,
    )).rejects.toThrow("templater boom");
    expect(ports.files.create).toHaveBeenCalledWith("Daily/2026-05-18.md", "");
    expect(ports.files.finalize).not.toHaveBeenCalled();
    expect(ports.paths.has("Daily/2026-05-18.md")).toBe(true);
    expect(ports.contents.get("Daily/2026-05-18.md")).toBe("");
  });

  it("refuses to overwrite a Templater target changed during rendering", async () => {
    const ports = createPorts();
    const path = "Daily/2026-05-18.md";
    vi.mocked(ports.templates.prepare).mockResolvedValueOnce({
      initialContent: "",
      renderAfterCreate: vi.fn(async () => {
        ports.contents.set(path, "# External edit");
        return "# Rendered template";
      }),
    });
    const commands = new PeriodicNoteCommands(ports.files, ports.templates, ports.workspace);
    const settings = createSettings({
      daily: { enabled: true, pattern: "[Daily]/YYYY-MM-DD" },
    });

    await expect(commands.openOrCreate(
      { date: { year: 2026, month: 5, day: 18 }, noteType: "daily" },
      settings,
    )).rejects.toThrow("Created note changed");
    expect(ports.contents.get(path)).toBe("# External edit");
    expect(ports.paths.has(path)).toBe(true);
  });

  it("cascade-creates every enabled larger period and skips existing notes", async () => {
    const ports = createPorts(["Monthly/2026-05.md"]);
    const commands = new PeriodicNoteCommands(ports.files, ports.templates, ports.workspace);
    const confirmCreate = vi.fn(async () => true);
    const settings = createSettings({
      daily: { enabled: true, pattern: "[Daily]/YYYY-MM-DD" },
      weekly: { enabled: true, pattern: "[Weekly]/GGGG-[W]WW" },
      monthly: { enabled: true, pattern: "[Monthly]/YYYY-MM" },
      quarterly: { enabled: false, pattern: "[Quarterly]/YYYY-[Q]Q" },
      yearly: { enabled: true, pattern: "[Yearly]/YYYY" },
    });

    const result = await commands.openOrCreate(
      {
        date: { year: 2026, month: 5, day: 18 },
        noteType: "daily",
        cascade: true,
        confirmCreate,
      },
      settings,
    );

    expect(result).toEqual({
      status: "opened",
      path: "Daily/2026-05-18.md",
      created: true,
      cascade: [
        { noteType: "weekly", path: "Weekly/2026-W21.md", status: "created" },
        { noteType: "monthly", path: "Monthly/2026-05.md", status: "existing" },
        { noteType: "yearly", path: "Yearly/2026.md", status: "created" },
      ],
    });
    expect(ports.files.create).toHaveBeenCalledTimes(3);
    expect(confirmCreate).toHaveBeenCalledOnce();
    expect(ports.paths).toEqual(
      new Set([
        "Daily/2026-05-18.md",
        "Weekly/2026-W21.md",
        "Monthly/2026-05.md",
        "Yearly/2026.md",
      ]),
    );
  });

  it("rolls back only a failed cascade note and continues with later periods", async () => {
    const ports = createPorts();
    vi.mocked(ports.templates.prepare)
      .mockResolvedValueOnce({ initialContent: "" })
      .mockRejectedValueOnce(new Error("weekly template failed"))
      .mockResolvedValueOnce({ initialContent: "" });
    const commands = new PeriodicNoteCommands(ports.files, ports.templates, ports.workspace);
    const settings = createSettings({
      daily: { enabled: true, pattern: "[Daily]/YYYY-MM-DD" },
      weekly: { enabled: true, pattern: "[Weekly]/GGGG-[W]WW" },
      yearly: { enabled: true, pattern: "[Yearly]/YYYY" },
    });

    const result = await commands.openOrCreate(
      {
        date: { year: 2026, month: 5, day: 18 },
        noteType: "daily",
        cascade: true,
      },
      settings,
    );

    expect(result).toMatchObject({
      status: "opened",
      created: true,
      cascade: [
        {
          noteType: "weekly",
          path: "Weekly/2026-W21.md",
          status: "failed",
          error: { message: "weekly template failed" },
        },
        { noteType: "yearly", path: "Yearly/2026.md", status: "created" },
      ],
    });
    expect(ports.paths.has("Daily/2026-05-18.md")).toBe(true);
    expect(ports.paths.has("Weekly/2026-W21.md")).toBe(false);
    expect(ports.paths.has("Yearly/2026.md")).toBe(true);
  });

  it("does not roll back a populated note when opening it fails", async () => {
    const ports = createPorts();
    vi.mocked(ports.workspace.open).mockRejectedValueOnce(new Error("workspace unavailable"));
    const commands = new PeriodicNoteCommands(ports.files, ports.templates, ports.workspace);
    const settings = createSettings({
      daily: { enabled: true, pattern: "[Daily]/YYYY-MM-DD" },
    });

    await expect(
      commands.openOrCreate(
        { date: { year: 2026, month: 5, day: 18 }, noteType: "daily" },
        settings,
      ),
    ).rejects.toThrow("workspace unavailable");
    expect(ports.paths.has("Daily/2026-05-18.md")).toBe(true);
  });
});
