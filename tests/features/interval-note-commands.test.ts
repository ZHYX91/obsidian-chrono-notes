import { describe, expect, it, vi } from "vitest";

import {
  IntervalNoteCommands,
  type IntervalNoteFilePort,
} from "../../src/features/intervals/interval-note-commands";
import type { PeriodicNoteWorkspacePort } from "../../src/features/periodic/periodic-note-commands";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function createPorts(existing: readonly string[] = []) {
  const paths = new Set(existing);
  const files: IntervalNoteFilePort = {
    exists: vi.fn((path) => paths.has(path)),
    create: vi.fn(async (path) => {
      paths.add(path);
    }),
  };
  const workspace: PeriodicNoteWorkspacePort = {
    open: vi.fn(async () => undefined),
  };
  return { files, workspace, paths };
}

describe("IntervalNoteCommands", () => {
  it("coordinates same-path creation while preserving each request open target", async () => {
    const ports = createPorts();
    const creation = deferred<void>();
    vi.mocked(ports.files.create).mockImplementationOnce(async (path) => {
      await creation.promise;
      ports.paths.add(path);
    });
    const commands = new IntervalNoteCommands(ports.files, ports.workspace);
    const base = {
      start: { year: 2026, month: 5, day: 6 },
      end: { year: 2026, month: 5, day: 8 },
      folder: "Ranges",
    } as const;

    const first = commands.openOrCreate({ ...base, target: "default" });
    await vi.waitFor(() => expect(ports.files.create).toHaveBeenCalledOnce());
    const second = commands.openOrCreate({ ...base, target: "tab" });
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
    const commands = new IntervalNoteCommands(ports.files, ports.workspace);

    await expect(commands.openOrCreate({
      start: { year: 2026, month: 5, day: 6 },
      end: { year: 2026, month: 5, day: 8 },
      folder: " / ",
    })).resolves.toEqual({ status: "not-configured" });
    await expect(commands.openOrCreate({
      start: { year: 2026, month: 5, day: 6 },
      end: { year: 2026, month: 5, day: 6 },
      folder: "Ranges",
    })).resolves.toEqual({ status: "invalid-range" });
    expect(ports.files.exists).not.toHaveBeenCalled();
  });

  it("opens an existing normalized range without confirming or creating", async () => {
    const path = "Ranges/2026-05-06 - 2026-05-09.md";
    const ports = createPorts([path]);
    const commands = new IntervalNoteCommands(ports.files, ports.workspace);
    const confirmCreate = vi.fn(async () => true);

    await expect(commands.openOrCreate({
      start: { year: 2026, month: 5, day: 9 },
      end: { year: 2026, month: 5, day: 6 },
      folder: "Ranges",
      target: "tab",
      confirmCreate,
    })).resolves.toEqual({ status: "opened", path, created: false });
    expect(confirmCreate).not.toHaveBeenCalled();
    expect(ports.files.create).not.toHaveBeenCalled();
    expect(ports.workspace.open).toHaveBeenCalledWith(path, "tab");
  });

  it("passes a frozen spec to confirmation and cancels before creation", async () => {
    const ports = createPorts();
    const commands = new IntervalNoteCommands(ports.files, ports.workspace);
    const confirmCreate = vi.fn(async (_spec: unknown) => false);

    const result = await commands.openOrCreate({
      start: { year: 2026, month: 5, day: 9 },
      end: { year: 2026, month: 5, day: 6 },
      folder: "Ranges",
      confirmCreate,
    });
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
    const commands = new IntervalNoteCommands(ports.files, ports.workspace);

    await expect(commands.openOrCreate({
      start: { year: 2026, month: 5, day: 6 },
      end: { year: 2026, month: 5, day: 8 },
      folder: "Ranges",
    })).resolves.toEqual({
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

  it("does not erase a successful file when opening fails", async () => {
    const ports = createPorts();
    vi.mocked(ports.workspace.open).mockRejectedValueOnce(new Error("workspace unavailable"));
    const commands = new IntervalNoteCommands(ports.files, ports.workspace);

    await expect(commands.openOrCreate({
      start: { year: 2026, month: 5, day: 6 },
      end: { year: 2026, month: 5, day: 8 },
      folder: "Ranges",
    })).rejects.toThrow("workspace unavailable");
    expect(ports.paths.has("Ranges/2026-05-06 - 2026-05-08.md")).toBe(true);
  });
});
