import { describe, expect, it, vi } from "vitest";

import {
  IntervalNoteCommands,
  type IntervalNoteCommandSettings,
  type IntervalNoteFilePort,
} from "../../src/features/intervals/interval-note-commands";
import type { PeriodicNoteWorkspacePort } from "../../src/features/periodic/periodic-note-commands";
import type { NoteTemplatePort } from "../../src/features/templates/note-template-port";

const SETTINGS: IntervalNoteCommandSettings = Object.freeze({
  locale: "en-US",
  templateEngine: "builtin",
  templatePath: "",
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function createPorts(existing: readonly string[] = []) {
  const paths = new Set(existing);
  const contents = new Map<string, string>();
  const files: IntervalNoteFilePort = {
    exists: vi.fn((path) => paths.has(path)),
    create: vi.fn(async (path, content) => {
      paths.add(path);
      contents.set(path, content);
    }),
    process: vi.fn(async (path, update) => {
      contents.set(path, update(contents.get(path) ?? ""));
    }),
    delete: vi.fn(async (path) => {
      paths.delete(path);
      contents.delete(path);
    }),
  };
  const templates: NoteTemplatePort = {
    populate: vi.fn(async () => undefined),
  };
  const workspace: PeriodicNoteWorkspacePort = {
    open: vi.fn(async () => undefined),
  };
  return { files, templates, workspace, paths, contents };
}

describe("IntervalNoteCommands", () => {
  it("coordinates same-path creation while preserving each request open target", async () => {
    const ports = createPorts();
    const creation = deferred<void>();
    vi.mocked(ports.files.create).mockImplementationOnce(async (path) => {
      await creation.promise;
      ports.paths.add(path);
    });
    const commands = new IntervalNoteCommands(
      ports.files,
      ports.templates,
      ports.workspace,
    );
    const base = {
      start: { year: 2026, month: 5, day: 6 },
      end: { year: 2026, month: 5, day: 8 },
      folder: "Ranges",
    } as const;

    const first = commands.openOrCreate({ ...base, target: "default" }, SETTINGS);
    await vi.waitFor(() => expect(ports.files.create).toHaveBeenCalledOnce());
    const second = commands.openOrCreate({ ...base, target: "tab" }, SETTINGS);
    expect(ports.workspace.open).not.toHaveBeenCalled();

    creation.resolve();
    await expect(Promise.all([first, second])).resolves.toEqual([
      {
        status: "opened",
        path: "Ranges/2026-05-06 - 2026-05-08.md",
        created: true,
      },
      {
        status: "opened",
        path: "Ranges/2026-05-06 - 2026-05-08.md",
        created: false,
      },
    ]);
    expect(ports.files.create).toHaveBeenCalledOnce();
    expect(ports.templates.populate).toHaveBeenCalledOnce();
    expect(ports.files.process).toHaveBeenCalledOnce();
    expect(ports.workspace.open).toHaveBeenCalledWith(
      "Ranges/2026-05-06 - 2026-05-08.md",
      "default",
    );
    expect(ports.workspace.open).toHaveBeenCalledWith(
      "Ranges/2026-05-06 - 2026-05-08.md",
      "tab",
    );
  });

  it("returns not-configured and invalid-range without touching external ports", async () => {
    const ports = createPorts();
    const commands = new IntervalNoteCommands(
      ports.files,
      ports.templates,
      ports.workspace,
    );

    await expect(commands.openOrCreate({
      start: { year: 2026, month: 5, day: 6 },
      end: { year: 2026, month: 5, day: 8 },
      folder: " / ",
    }, SETTINGS)).resolves.toEqual({ status: "not-configured" });
    await expect(commands.openOrCreate({
      start: { year: 2026, month: 5, day: 6 },
      end: { year: 2026, month: 5, day: 6 },
      folder: "Ranges",
    }, SETTINGS)).resolves.toEqual({ status: "invalid-range" });
    expect(ports.files.exists).not.toHaveBeenCalled();
  });

  it("opens an existing normalized range without confirming or creating", async () => {
    const path = "Ranges/2026-05-06 - 2026-05-09.md";
    const ports = createPorts([path]);
    const commands = new IntervalNoteCommands(
      ports.files,
      ports.templates,
      ports.workspace,
    );
    const confirmCreate = vi.fn(async () => true);

    await expect(commands.openOrCreate({
      start: { year: 2026, month: 5, day: 9 },
      end: { year: 2026, month: 5, day: 6 },
      folder: "Ranges",
      target: "tab",
      confirmCreate,
    }, SETTINGS)).resolves.toEqual({ status: "opened", path, created: false });
    expect(confirmCreate).not.toHaveBeenCalled();
    expect(ports.files.create).not.toHaveBeenCalled();
    expect(ports.workspace.open).toHaveBeenCalledWith(path, "tab");
  });

  it("passes a frozen spec to confirmation and cancels before creation", async () => {
    const ports = createPorts();
    const commands = new IntervalNoteCommands(
      ports.files,
      ports.templates,
      ports.workspace,
    );
    const confirmCreate = vi.fn(async (_spec: unknown) => false);

    const result = await commands.openOrCreate({
      start: { year: 2026, month: 5, day: 9 },
      end: { year: 2026, month: 5, day: 6 },
      folder: "Ranges",
      confirmCreate,
    }, SETTINGS);
    expect(result).toEqual({
      status: "cancelled",
      path: "Ranges/2026-05-06 - 2026-05-09.md",
    });
    expect(confirmCreate).toHaveBeenCalledWith(expect.objectContaining({ dayCount: 4 }));
    expect(Object.isFrozen(confirmCreate.mock.calls[0]?.[0])).toBe(true);
    expect(ports.files.create).not.toHaveBeenCalled();
  });

  it("creates the deterministic Markdown note and opens it", async () => {
    const ports = createPorts();
    const commands = new IntervalNoteCommands(
      ports.files,
      ports.templates,
      ports.workspace,
    );

    await expect(commands.openOrCreate({
      start: { year: 2026, month: 5, day: 6 },
      end: { year: 2026, month: 5, day: 8 },
      folder: "Ranges",
    }, SETTINGS)).resolves.toEqual({
      status: "opened",
      path: "Ranges/2026-05-06 - 2026-05-08.md",
      created: true,
    });
    expect(ports.files.create).toHaveBeenCalledWith(
      "Ranges/2026-05-06 - 2026-05-08.md",
      expect.stringContaining("start: 2026-05-06\nend: 2026-05-08"),
    );
    expect(ports.workspace.open).toHaveBeenCalledWith(
      "Ranges/2026-05-06 - 2026-05-08.md",
      "default",
    );
  });

  it("renders a configured range template and then enforces canonical metadata", async () => {
    const ports = createPorts();
    vi.mocked(ports.templates.populate).mockImplementationOnce(async (path) => {
      ports.contents.set(path, [
        "---",
        "start: wrong",
        "project: travel",
        "---",
        "",
        "# Custom range",
      ].join("\n"));
    });
    const commands = new IntervalNoteCommands(
      ports.files,
      ports.templates,
      ports.workspace,
    );

    await commands.openOrCreate({
      start: { year: 2026, month: 7, day: 7 },
      end: { year: 2026, month: 7, day: 1 },
      folder: "Ranges",
    }, {
      locale: "en-US",
      templateEngine: "builtin",
      templatePath: "Templates/Range.md",
    });

    expect(ports.templates.populate).toHaveBeenCalledWith(
      "Ranges/2026-07-01 - 2026-07-07.md",
      expect.objectContaining({
        kind: "interval",
        start: { year: 2026, month: 7, day: 1 },
        end: { year: 2026, month: 7, day: 7 },
        dayCount: 7,
        templatePath: "Templates/Range.md",
      }),
    );
    expect(ports.contents.get("Ranges/2026-07-01 - 2026-07-07.md")).toContain(
      "start: 2026-07-01\nproject: travel\nend: 2026-07-07",
    );
  });

  it("removes a newly created range note when template rendering fails", async () => {
    const ports = createPorts();
    vi.mocked(ports.templates.populate).mockRejectedValueOnce(
      new Error("template failed"),
    );
    const commands = new IntervalNoteCommands(
      ports.files,
      ports.templates,
      ports.workspace,
    );
    const path = "Ranges/2026-07-01 - 2026-07-07.md";

    await expect(commands.openOrCreate({
      start: { year: 2026, month: 7, day: 1 },
      end: { year: 2026, month: 7, day: 7 },
      folder: "Ranges",
    }, {
      ...SETTINGS,
      templatePath: "Templates/Range.md",
    })).rejects.toThrow("template failed");
    expect(ports.files.delete).toHaveBeenCalledWith(path);
    expect(ports.paths.has(path)).toBe(false);
    expect(ports.workspace.open).not.toHaveBeenCalled();
  });

  it("removes a newly created range note when template metadata is invalid", async () => {
    const ports = createPorts();
    vi.mocked(ports.templates.populate).mockImplementationOnce(async (path) => {
      ports.contents.set(path, "---\ninvalid: [\n---\nBody");
    });
    const commands = new IntervalNoteCommands(
      ports.files,
      ports.templates,
      ports.workspace,
    );
    const path = "Ranges/2026-07-01 - 2026-07-07.md";

    await expect(commands.openOrCreate({
      start: { year: 2026, month: 7, day: 1 },
      end: { year: 2026, month: 7, day: 7 },
      folder: "Ranges",
    }, {
      ...SETTINGS,
      templatePath: "Templates/Range.md",
    })).rejects.toThrow("invalid frontmatter");
    expect(ports.files.delete).toHaveBeenCalledWith(path);
    expect(ports.paths.has(path)).toBe(false);
    expect(ports.workspace.open).not.toHaveBeenCalled();
  });

  it("does not erase a successful file when opening fails", async () => {
    const ports = createPorts();
    vi.mocked(ports.workspace.open).mockRejectedValueOnce(new Error("workspace unavailable"));
    const commands = new IntervalNoteCommands(
      ports.files,
      ports.templates,
      ports.workspace,
    );

    await expect(commands.openOrCreate({
      start: { year: 2026, month: 5, day: 6 },
      end: { year: 2026, month: 5, day: 8 },
      folder: "Ranges",
    }, SETTINGS)).rejects.toThrow("workspace unavailable");
    expect(ports.paths.has("Ranges/2026-05-06 - 2026-05-08.md")).toBe(true);
  });
});
