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
  const identities = new Map<string, object>();
  const files: IntervalNoteFilePort = {
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

describe("IntervalNoteCommands", () => {
  it("coordinates same-path creation while preserving each request open target", async () => {
    const ports = createPorts();
    const creation = deferred<void>();
    vi.mocked(ports.files.create).mockImplementationOnce(async (path, content) => {
      await creation.promise;
      ports.paths.add(path);
      const identity = { path };
      ports.identities.set(path, identity);
      ports.contents.set(path, content);
      return Object.freeze({ identity, initialContent: content, path });
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
    expect(ports.templates.prepare).toHaveBeenCalledOnce();
    expect(ports.files.finalize).not.toHaveBeenCalled();
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
      expect.stringContaining(
        "chrono-notes: interval\nstart: 2026-05-06\nend: 2026-05-08",
      ),
    );
    expect(ports.workspace.open).toHaveBeenCalledWith(
      "Ranges/2026-05-06 - 2026-05-08.md",
      "default",
    );
  });

  it("renders a configured range template and then enforces canonical metadata", async () => {
    const ports = createPorts();
    vi.mocked(ports.templates.prepare).mockResolvedValueOnce({
      initialContent: [
        "---",
        "start: wrong",
        "project: travel",
        "---",
        "",
        "# Custom range",
      ].join("\n"),
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

    expect(ports.templates.prepare).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "interval",
        start: { year: 2026, month: 7, day: 1 },
        end: { year: 2026, month: 7, day: 7 },
        dayCount: 7,
        templatePath: "Templates/Range.md",
      }),
      expect.stringContaining("start: 2026-07-01\nend: 2026-07-07"),
    );
    expect(ports.contents.get("Ranges/2026-07-01 - 2026-07-07.md")).toContain(
      "start: 2026-07-01\nproject: travel\nchrono-notes: interval\nend: 2026-07-07",
    );
  });

  it("fails before creating a range note when template preparation fails", async () => {
    const ports = createPorts();
    vi.mocked(ports.templates.prepare).mockRejectedValueOnce(
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
    expect(ports.files.create).not.toHaveBeenCalled();
    expect(ports.paths.has(path)).toBe(false);
    expect(ports.workspace.open).not.toHaveBeenCalled();
  });

  it("rejects invalid built-in template metadata before target creation", async () => {
    const ports = createPorts();
    vi.mocked(ports.templates.prepare).mockResolvedValueOnce({
      initialContent: "---\ninvalid: [\n---\nBody",
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
    expect(ports.files.create).not.toHaveBeenCalled();
    expect(ports.paths.has(path)).toBe(false);
    expect(ports.workspace.open).not.toHaveBeenCalled();
  });

  it("writes a Templater range in two operations with canonical metadata", async () => {
    const ports = createPorts();
    const renderAfterCreate = vi.fn(async () => [
      "---",
      "start: wrong",
      "project: travel",
      "---",
      "",
      "# Deferred range",
    ].join("\n"));
    vi.mocked(ports.templates.prepare).mockResolvedValueOnce({
      initialContent: "---\nstart: 2026-07-01\nend: 2026-07-07\n---\n",
      renderAfterCreate,
    });
    const commands = new IntervalNoteCommands(
      ports.files,
      ports.templates,
      ports.workspace,
    );
    const path = "Ranges/2026-07-01 - 2026-07-07.md";

    await commands.openOrCreate({
      start: { year: 2026, month: 7, day: 1 },
      end: { year: 2026, month: 7, day: 7 },
      folder: "Ranges",
    }, {
      ...SETTINGS,
      templateEngine: "templater",
      templatePath: "Templates/Range.md",
    });

    expect(ports.files.create).toHaveBeenCalledOnce();
    expect(renderAfterCreate).toHaveBeenCalledWith(path);
    expect(ports.files.finalize).toHaveBeenCalledOnce();
    expect(ports.contents.get(path)).toContain(
      "start: 2026-07-01\nproject: travel\nchrono-notes: interval\nend: 2026-07-07",
    );
  });

  it("retains external changes when deferred Templater rendering fails", async () => {
    const ports = createPorts();
    const path = "Ranges/2026-07-01 - 2026-07-07.md";
    vi.mocked(ports.templates.prepare).mockResolvedValueOnce({
      initialContent: "",
      renderAfterCreate: vi.fn(async () => {
        ports.contents.set(path, "# External range edit");
        throw new Error("templater failed");
      }),
    });
    const commands = new IntervalNoteCommands(
      ports.files,
      ports.templates,
      ports.workspace,
    );
    await expect(commands.openOrCreate({
      start: { year: 2026, month: 7, day: 1 },
      end: { year: 2026, month: 7, day: 7 },
      folder: "Ranges",
    }, {
      ...SETTINGS,
      templateEngine: "templater",
      templatePath: "Templates/Range.md",
    })).rejects.toThrow("templater failed");
    expect(ports.files.create).toHaveBeenCalledOnce();
    expect(ports.files.finalize).not.toHaveBeenCalled();
    expect(ports.paths.has(path)).toBe(true);
    expect(ports.contents.get(path)).toBe("# External range edit");
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
