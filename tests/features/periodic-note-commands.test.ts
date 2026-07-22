import { describe, expect, it, vi } from "vitest";

import type { PeriodicNoteType } from "../../src/core/periodic/periodic-date";
import {
  PeriodicNoteCommands,
  PeriodicNoteCreationError,
  type PeriodicNoteCommandSettings,
  type PeriodicNoteFilePort,
  type PeriodicNoteTemplatePort,
  type PeriodicNoteWorkspacePort,
} from "../../src/features/periodic/periodic-note-commands";
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
  const files: PeriodicNoteFilePort = {
    exists: vi.fn((path) => paths.has(path)),
    createEmpty: vi.fn(async (path) => {
      paths.add(path);
    }),
    delete: vi.fn(async (path) => {
      paths.delete(path);
    }),
  };
  const templates: PeriodicNoteTemplatePort = {
    populate: vi.fn(async () => undefined),
  };
  const workspace: PeriodicNoteWorkspacePort = {
    open: vi.fn(async () => undefined),
  };
  return { files, templates, workspace, paths };
}

describe("PeriodicNoteCommands", () => {
  it("coordinates same-path creation while preserving each request target and cascade", async () => {
    const ports = createPorts();
    const population = deferred<void>();
    vi.mocked(ports.templates.populate).mockReturnValueOnce(population.promise);
    const commands = new PeriodicNoteCommands(ports.files, ports.templates, ports.workspace);
    const settings = createSettings({
      daily: { enabled: true, pattern: "'Daily'/yyyy-MM-dd" },
      monthly: { enabled: true, pattern: "'Monthly'/yyyy-MM" },
    });
    const date = { year: 2026, month: 5, day: 18 } as const;

    const first = commands.openOrCreate(
      { date, noteType: "daily", target: "default" },
      settings,
    );
    await vi.waitFor(() => expect(ports.files.createEmpty).toHaveBeenCalledOnce());
    const second = commands.openOrCreate(
      { date, noteType: "daily", target: "tab", cascade: true },
      settings,
    );
    expect(ports.workspace.open).not.toHaveBeenCalled();

    population.resolve();
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

    expect(ports.files.createEmpty).toHaveBeenCalledTimes(2);
    expect(ports.files.createEmpty).toHaveBeenCalledWith("Daily/2026-05-18.md");
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
      daily: { enabled: true, pattern: "'Daily'/yyyy-MM-dd" },
      monthly: { enabled: true, pattern: "'Monthly'/yyyy-MM" },
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
    expect(ports.files.createEmpty).not.toHaveBeenCalled();
    expect(ports.templates.populate).not.toHaveBeenCalled();
  });

  it("cancels before creating when confirmation is declined", async () => {
    const ports = createPorts();
    const commands = new PeriodicNoteCommands(ports.files, ports.templates, ports.workspace);
    const confirmCreate = vi.fn(async () => false);
    const settings = createSettings({
      daily: { enabled: true, pattern: "'Daily'/yyyy-MM-dd" },
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
    expect(ports.files.createEmpty).not.toHaveBeenCalled();
  });

  it("creates, populates, and opens a note with one canonical context", async () => {
    const ports = createPorts();
    const commands = new PeriodicNoteCommands(ports.files, ports.templates, ports.workspace);
    const settings = createSettings({
      quarterly: {
        enabled: true,
        pattern: "'Quarterly'/yyyy-'Q'q",
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
    expect(ports.files.createEmpty).toHaveBeenCalledWith("Quarterly/2026-Q2.md");
    expect(ports.templates.populate).toHaveBeenCalledWith("Quarterly/2026-Q2.md", {
      date: { year: 2026, month: 4, day: 1 },
      noteType: "quarterly",
      path: "Quarterly/2026-Q2.md",
      templatePath: "Templates/Quarterly.md",
      templateEngine: "builtin",
      title: "2026-Q2",
    });
    expect(ports.workspace.open).toHaveBeenCalledWith("Quarterly/2026-Q2.md", "default");
  });

  it("rolls back the new file and reports the cause when its template fails", async () => {
    const ports = createPorts();
    vi.mocked(ports.templates.populate).mockRejectedValueOnce(new Error("template boom"));
    const commands = new PeriodicNoteCommands(ports.files, ports.templates, ports.workspace);
    const settings = createSettings({
      daily: { enabled: true, pattern: "'Daily'/yyyy-MM-dd" },
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
    expect(ports.files.delete).toHaveBeenCalledWith("Daily/2026-05-18.md");
    expect(ports.paths.has("Daily/2026-05-18.md")).toBe(false);
    expect(ports.workspace.open).not.toHaveBeenCalled();
  });

  it("cascade-creates every enabled larger period and skips existing notes", async () => {
    const ports = createPorts(["Monthly/2026-05.md"]);
    const commands = new PeriodicNoteCommands(ports.files, ports.templates, ports.workspace);
    const confirmCreate = vi.fn(async () => true);
    const settings = createSettings({
      daily: { enabled: true, pattern: "'Daily'/yyyy-MM-dd" },
      weekly: { enabled: true, pattern: "'Weekly'/kkkk-'W'WW" },
      monthly: { enabled: true, pattern: "'Monthly'/yyyy-MM" },
      quarterly: { enabled: false, pattern: "'Quarterly'/yyyy-'Q'q" },
      yearly: { enabled: true, pattern: "'Yearly'/yyyy" },
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
    expect(ports.files.createEmpty).toHaveBeenCalledTimes(3);
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
    vi.mocked(ports.templates.populate)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("weekly template failed"))
      .mockResolvedValueOnce(undefined);
    const commands = new PeriodicNoteCommands(ports.files, ports.templates, ports.workspace);
    const settings = createSettings({
      daily: { enabled: true, pattern: "'Daily'/yyyy-MM-dd" },
      weekly: { enabled: true, pattern: "'Weekly'/kkkk-'W'WW" },
      yearly: { enabled: true, pattern: "'Yearly'/yyyy" },
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
      daily: { enabled: true, pattern: "'Daily'/yyyy-MM-dd" },
    });

    await expect(
      commands.openOrCreate(
        { date: { year: 2026, month: 5, day: 18 }, noteType: "daily" },
        settings,
      ),
    ).rejects.toThrow("workspace unavailable");
    expect(ports.files.delete).not.toHaveBeenCalled();
    expect(ports.paths.has("Daily/2026-05-18.md")).toBe(true);
  });
});
