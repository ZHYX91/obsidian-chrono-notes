import { describe, expect, it, vi } from "vitest";

import { ObsidianNoteSource } from "../../src/adapters/obsidian/obsidian-note-source";
import { NoteIndex } from "../../src/features/notes/note-index";

interface FakeFile {
  path: string;
  extension?: string;
}

type EventName = "create" | "modify" | "rename" | "delete";

class Deferred<T> {
  readonly promise: Promise<T>;
  private resolvePromise!: (value: T) => void;

  constructor() {
    this.promise = new Promise<T>((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  resolve(value: T): void {
    this.resolvePromise(value);
  }
}

class FakeVault {
  readonly cachedRead = vi.fn(async (file: FakeFile) => `content:${file.path}`);
  readonly files = new Map<string, FakeFile>();
  private readonly listeners = new Map<EventName, Set<(...args: never[]) => void>>();

  getMarkdownFiles(): FakeFile[] {
    return [...this.files.values()].filter((file) => file.extension === "md");
  }

  getAbstractFileByPath(path: string): FakeFile | null {
    return this.files.get(path) ?? null;
  }

  on(event: EventName, callback: (...args: never[]) => void): { event: EventName; callback: (...args: never[]) => void } {
    const callbacks = this.listeners.get(event) ?? new Set();
    callbacks.add(callback);
    this.listeners.set(event, callbacks);
    return { event, callback };
  }

  offref(ref: { event: EventName; callback: (...args: never[]) => void }): void {
    this.listeners.get(ref.event)?.delete(ref.callback);
  }

  emit(event: EventName, ...args: unknown[]): void {
    for (const callback of this.listeners.get(event) ?? []) {
      Reflect.apply(callback, undefined, args);
    }
  }
}

describe("ObsidianNoteSource", () => {
  it("lists and reads Markdown files without exposing Vault objects", async () => {
    const vault = new FakeVault();
    vault.files.set("Daily/today.md", { path: "Daily/today.md", extension: "md" });
    vault.files.set("assets/icon.png", { path: "assets/icon.png", extension: "png" });
    const source = new ObsidianNoteSource(vault as never);

    expect(source.listPaths()).toEqual(["Daily/today.md"]);
    await expect(source.read("Daily/today.md")).resolves.toBe("content:Daily/today.md");
    expect(vault.cachedRead).toHaveBeenCalledWith(vault.files.get("Daily/today.md"));
    await expect(source.read("missing.md")).rejects.toThrow("Markdown note not found: missing.md");
  });

  it("translates Vault events and handles extension-changing renames", () => {
    const vault = new FakeVault();
    const source = new ObsidianNoteSource(vault as never);
    const listener = vi.fn();
    const unsubscribe = source.subscribe(listener);

    vault.emit("create", { path: "Daily/a.md", extension: "md" });
    vault.emit("modify", { path: "Daily/a.md", extension: "md" });
    vault.emit("rename", { path: "Daily/b.md", extension: "md" }, "Daily/a.md");
    vault.emit("rename", { path: "Daily/from.txt", extension: "txt" }, "Daily/from.md");
    vault.emit("rename", { path: "Daily/to.md", extension: "md" }, "Daily/to.txt");
    vault.emit("delete", { path: "Daily/b.md", extension: "md" });
    vault.emit("create", { path: "assets/icon.png", extension: "png" });

    expect(listener.mock.calls).toEqual([
      [{ type: "create", path: "Daily/a.md" }],
      [{ type: "modify", path: "Daily/a.md" }],
      [{ type: "rename", oldPath: "Daily/a.md", path: "Daily/b.md" }],
      [{ type: "delete", path: "Daily/from.md" }],
      [{ type: "create", path: "Daily/to.md" }],
      [{ type: "delete", path: "Daily/b.md" }],
    ]);

    unsubscribe();
    vault.emit("create", { path: "Daily/ignored.md", extension: "md" });
    expect(listener).toHaveBeenCalledTimes(6);
  });

  it("rejects an older cachedRead completion after a newer modify read", async () => {
    const vault = new FakeVault();
    const file = { path: "Daily/today.md", extension: "md" };
    vault.files.set(file.path, file);
    const staleRead = new Deferred<string>();
    vault.cachedRead
      .mockImplementationOnce(() => staleRead.promise)
      .mockResolvedValueOnce("newest content");
    const index = new NoteIndex(new ObsidianNoteSource(vault as never));

    const starting = index.start();
    await vi.waitFor(() => expect(vault.cachedRead).toHaveBeenCalledTimes(1));
    vault.emit("modify", file);
    await vi.waitFor(() => expect(vault.cachedRead).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(index.get(file.path)).toMatchObject({
      kind: "parsed",
      note: { document: { body: "newest content" } },
    }));

    staleRead.resolve("stale content");
    await starting;

    expect(index.get(file.path)).toMatchObject({
      kind: "parsed",
      note: { document: { body: "newest content" } },
    });
    index.stop();
  });

  it("keeps a pending old-path cachedRead invalid after rename", async () => {
    const vault = new FakeVault();
    const oldFile = { path: "Ranges/old.md", extension: "md" };
    const newFile = { path: "Ranges/new.md", extension: "md" };
    vault.files.set(oldFile.path, oldFile);
    const staleRead = new Deferred<string>();
    const movedContent = [
      "---",
      "start: 2026-07-20",
      "end: 2026-07-21",
      "---",
      "- [ ] moved task 📅 2026-07-20",
    ].join("\n");
    vault.cachedRead
      .mockResolvedValueOnce("old content")
      .mockImplementationOnce(() => staleRead.promise)
      .mockResolvedValueOnce(movedContent);
    const index = new NoteIndex(new ObsidianNoteSource(vault as never));
    await index.start();

    vault.emit("modify", oldFile);
    await vi.waitFor(() => expect(vault.cachedRead).toHaveBeenCalledTimes(2));
    vault.files.delete(oldFile.path);
    vault.files.set(newFile.path, newFile);
    vault.emit("rename", newFile, oldFile.path);
    expect(index.get(oldFile.path).kind).toBe("missing");
    await vi.waitFor(() => expect(vault.cachedRead).toHaveBeenCalledTimes(3));
    await vi.waitFor(() => expect(index.get(newFile.path)).toMatchObject({
      kind: "parsed",
      note: { document: { body: "- [ ] moved task 📅 2026-07-20" } },
    }));

    staleRead.resolve("stale old-path content");
    await staleRead.promise;
    await Promise.resolve();

    expect(index.get(oldFile.path).kind).toBe("missing");
    expect(index.getSnapshot().taskDates.byDate["2026-07-20"]?.[0]?.task.path)
      .toBe(newFile.path);
    expect(index.getSnapshot().intervals.items.map((item) => item.path))
      .toEqual([newFile.path]);
    index.stop();
  });

  it("keeps a pending cachedRead invalid after delete", async () => {
    const vault = new FakeVault();
    const file = { path: "Daily/today.md", extension: "md" };
    vault.files.set(file.path, file);
    const staleRead = new Deferred<string>();
    vault.cachedRead
      .mockResolvedValueOnce("initial content")
      .mockImplementationOnce(() => staleRead.promise);
    const index = new NoteIndex(new ObsidianNoteSource(vault as never));
    await index.start();

    vault.emit("modify", file);
    await vi.waitFor(() => expect(vault.cachedRead).toHaveBeenCalledTimes(2));
    vault.files.delete(file.path);
    vault.emit("delete", file);
    expect(index.get(file.path).kind).toBe("missing");

    staleRead.resolve("stale deleted content");
    await staleRead.promise;
    await Promise.resolve();

    expect(index.get(file.path).kind).toBe("missing");
    expect(index.getSnapshot().notes).toEqual({});
    index.stop();
  });
});
