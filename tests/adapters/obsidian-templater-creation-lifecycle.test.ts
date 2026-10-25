import { describe, expect, it, vi } from "vitest";

import {
  ObsidianIntervalNoteFilePort,
  ObsidianPeriodicNoteFilePort,
} from "../../src/adapters/obsidian/obsidian-note-file-ports";
import { ObsidianNoteTemplatePort } from "../../src/adapters/obsidian/obsidian-note-template-ports";
import { IntervalNoteCommands } from "../../src/features/intervals/interval-note-commands";
import { PeriodicNoteCommands } from "../../src/features/periodic/periodic-note-commands";
import { createDefaultSettings } from "../../src/shared/settings";
import { createTemplaterLifecycle } from "../support/templater-lifecycle";

const TEMPLATE_PATH = "Templates/Selected.md";
const DAILY_PATH = "Daily/2026-05-18.md";
const INTERVAL_PATH = "Ranges/2026-05-18 - 2026-05-20.md";
const RENDERED = "# Selected template";
const AUTOMATIC = "# Automatic folder template";

interface FakeFile {
  path: string;
  extension?: string;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function createFixture() {
  const controller = new AbortController();
  const lifecycle = createTemplaterLifecycle();
  const files = new Map<string, FakeFile>([
    [TEMPLATE_PATH, { path: TEMPLATE_PATH, extension: "md" }],
  ]);
  const contents = new Map<string, string>([[TEMPLATE_PATH, "<% tp.file.title %>"]]);
  const creationStarted = deferred<void>();
  const automaticDelay = deferred<void>();
  const automaticChecks: Promise<void>[] = [];
  const automaticWrites = vi.fn((path: string) => contents.set(path, AUTOMATIC));
  const reservationsAtCreate: boolean[] = [];
  const templater = {
    ...lifecycle,
    create_running_config: vi.fn((_template: FakeFile, target: FakeFile, mode: number) => ({
      target, mode,
    })),
    parse_template: vi.fn(async (_config: unknown, _content: string) => RENDERED),
  };
  const vault = {
    getAbstractFileByPath: (path: string) => files.get(path) ?? null,
    cachedRead: vi.fn(async (file: FakeFile) => contents.get(file.path) ?? ""),
    createFolder: vi.fn(async (path: string) => { files.set(path, { path }); }),
    create: vi.fn(async (path: string, content: string) => {
      reservationsAtCreate.push(lifecycle.files_with_pending_templates.has(path));
      const file = { path, extension: "md" };
      files.set(path, file);
      contents.set(path, content);
      // Model only the upstream delayed pending-file gate and folder-template
      // branch. The delay is controlled, not a wall-clock/host acceptance check.
      automaticChecks.push((async () => {
        await automaticDelay.promise;
        if (lifecycle.files_with_pending_templates.has(path)) return;
        const body = (contents.get(path) ?? "").replace(/^---\n[\s\S]*?\n---(?:\n|$)/, "");
        if (body.trim().length === 0) automaticWrites(path);
      })());
      creationStarted.resolve();
      return file;
    }),
    process: vi.fn(async (file: FakeFile, update: (content: string) => string) => {
      const next = update(contents.get(file.path) ?? "");
      contents.set(file.path, next);
      return next;
    }),
  };
  const workspace = { getLeavesOfType: vi.fn((): unknown[] => []) };
  const noteWorkspace = { open: vi.fn(async () => undefined) };
  const app = { plugins: { getPlugin: () => ({ templater }) } };
  function createCommands(signal: AbortSignal) {
    const templates = new ObsidianNoteTemplatePort(
      app as never, vault as never, undefined, undefined, signal,
    );
    return {
      periodic: new PeriodicNoteCommands(
        new ObsidianPeriodicNoteFilePort(vault as never, workspace as never, signal),
        templates, noteWorkspace, signal,
      ),
      intervals: new IntervalNoteCommands(
        new ObsidianIntervalNoteFilePort(vault as never, workspace as never, signal),
        templates, noteWorkspace, signal,
      ),
    };
  }
  const { periodic, intervals } = createCommands(controller.signal);
  const settings = createDefaultSettings();
  settings.templateEngine = "templater";
  settings.periodicNotes.daily = {
    enabled: true, pattern: "[Daily]/YYYY-MM-DD", templatePath: TEMPLATE_PATH,
  };
  const createDaily = (day = 18) => periodic.openOrCreate({
    date: { year: 2026, month: 5, day }, noteType: "daily",
  }, settings);
  const createInterval = () => intervals.openOrCreate({
    start: { year: 2026, month: 5, day: 18 },
    end: { year: 2026, month: 5, day: 20 },
    folder: "Ranges",
  }, { locale: "en-US", templateEngine: "templater", templatePath: TEMPLATE_PATH });

  return {
    ...lifecycle, templater, vault, files, contents, workspace, noteWorkspace,
    controller, periodic, intervals, settings, createCommands,
    creationStarted, reservationsAtCreate, createDaily, createInterval, automaticWrites,
    async finishAutomaticCheck() {
      automaticDelay.resolve();
      await Promise.all(automaticChecks);
    },
  };
}

describe("Templater creation lifecycle", () => {
  it.each(["periodic", "interval"] as const)(
    "stops %s creation after a confirmation resolves for an unloaded runtime",
    async (kind) => {
      const fixture = createFixture();
      const confirmation = deferred<boolean>();
      const confirmCreate = vi.fn(() => confirmation.promise);
      const creation = kind === "periodic"
        ? fixture.periodic.openOrCreate({
            date: { year: 2026, month: 5, day: 18 }, noteType: "daily", confirmCreate,
          }, fixture.settings)
        : fixture.intervals.openOrCreate({
            start: { year: 2026, month: 5, day: 18 },
            end: { year: 2026, month: 5, day: 20 }, folder: "Ranges", confirmCreate,
          }, { locale: "en", templateEngine: "templater", templatePath: TEMPLATE_PATH });
      const rejected = expect(creation).rejects.toMatchObject({
        details: { code: "noteCreationStopped" },
      });
      fixture.controller.abort();
      confirmation.resolve(true);
      await rejected;
      expect(fixture.vault.cachedRead).not.toHaveBeenCalled();
      expect(fixture.vault.create).not.toHaveBeenCalled();
      expect(fixture.noteWorkspace.open).not.toHaveBeenCalled();
    },
  );

  it.each(["periodic", "interval"] as const)(
    "stops %s creation after a pending template read",
    async (kind) => {
      const fixture = createFixture();
      const read = deferred<string>();
      fixture.vault.cachedRead.mockReturnValueOnce(read.promise);
      const creation = kind === "periodic" ? fixture.createDaily() : fixture.createInterval();
      const rejected = expect(creation).rejects.toMatchObject({ retainedCreatedNote: false });
      await vi.waitFor(() => expect(fixture.vault.cachedRead).toHaveBeenCalledOnce());
      fixture.controller.abort();
      read.resolve("template");
      await rejected;
      expect(fixture.vault.create).not.toHaveBeenCalled();
      expect(fixture.files_with_pending_templates.size).toBe(0);
      expect(fixture.noteWorkspace.open).not.toHaveBeenCalled();
    },
  );

  it.each(["periodic", "interval"] as const)(
    "retains a dispatched %s create without starting rendering after unload",
    async (kind) => {
      const fixture = createFixture();
      const created = deferred<void>();
      const original = fixture.vault.create.getMockImplementation()!;
      fixture.vault.create.mockImplementationOnce(async (path, content) => {
        const file = await original(path, content);
        await created.promise;
        return file;
      });
      const creation = kind === "periodic" ? fixture.createDaily() : fixture.createInterval();
      const rejected = expect(creation).rejects.toMatchObject({ retainedCreatedNote: true });
      await fixture.creationStarted.promise;
      await fixture.finishAutomaticCheck();
      fixture.controller.abort();
      created.resolve();
      await rejected;
      expect(fixture.files.has(kind === "periodic" ? DAILY_PATH : INTERVAL_PATH)).toBe(true);
      expect(fixture.templater.parse_template).not.toHaveBeenCalled();
      expect(fixture.vault.process).not.toHaveBeenCalled();
      expect(fixture.noteWorkspace.open).not.toHaveBeenCalled();
      expect(fixture.files_with_pending_templates.size).toBe(0);
      expect(fixture.end_templater_task).toHaveBeenCalledOnce();
    },
  );

  it.each(["periodic", "interval"] as const)(
    "retains the initial %s note when rendering finishes after unload",
    async (kind) => {
      const fixture = createFixture();
      const render = deferred<string>();
      fixture.templater.parse_template.mockReturnValueOnce(render.promise);
      const creation = kind === "periodic" ? fixture.createDaily() : fixture.createInterval();
      const rejected = expect(creation).rejects.toMatchObject({ retainedCreatedNote: true });
      await vi.waitFor(() => expect(fixture.templater.parse_template).toHaveBeenCalledOnce());
      await fixture.finishAutomaticCheck();
      const path = kind === "periodic" ? DAILY_PATH : INTERVAL_PATH;
      const initial = fixture.contents.get(path);
      fixture.controller.abort();
      render.resolve(RENDERED);
      await rejected;
      expect(fixture.contents.get(path)).toBe(initial);
      expect(fixture.vault.process).not.toHaveBeenCalled();
      expect(fixture.noteWorkspace.open).not.toHaveBeenCalled();
      expect(fixture.files_with_pending_templates.size).toBe(0);
      expect(fixture.end_templater_task).toHaveBeenCalledOnce();
    },
  );

  it("releases queued reservations after unload and lets a fresh runtime create", async () => {
    const fixture = createFixture();
    const render = deferred<string>();
    fixture.templater.parse_template.mockReturnValueOnce(render.promise);
    const first = expect(fixture.createDaily()).rejects.toMatchObject({ retainedCreatedNote: true });
    await vi.waitFor(() => expect(fixture.templater.parse_template).toHaveBeenCalledOnce());
    const second = expect(fixture.createInterval()).rejects.toMatchObject({ retainedCreatedNote: false });
    await vi.waitFor(() => expect(fixture.files_with_pending_templates.size).toBe(2));
    await fixture.finishAutomaticCheck();
    fixture.controller.abort();
    render.resolve(RENDERED);
    await Promise.all([first, second]);
    expect(fixture.vault.create).toHaveBeenCalledOnce();
    expect(fixture.vault.process).not.toHaveBeenCalled();
    expect(fixture.noteWorkspace.open).not.toHaveBeenCalled();
    expect(fixture.files_with_pending_templates.size).toBe(0);
    expect(fixture.end_templater_task.mock.calls).toEqual([[DAILY_PATH], [INTERVAL_PATH]]);
    const fresh = fixture.createCommands(new AbortController().signal);
    await expect(fresh.periodic.openOrCreate({
      date: { year: 2026, month: 5, day: 19 }, noteType: "daily",
    }, fixture.settings)).resolves.toMatchObject({ status: "opened", created: true });
  });

  it("releases cancellation ownership before an independent delayed automatic template runs", async () => {
    const fixture = createFixture();
    const render = deferred<string>();
    fixture.templater.parse_template.mockReturnValueOnce(render.promise);
    const stopped = expect(fixture.createDaily()).rejects.toMatchObject({ retainedCreatedNote: true });
    await vi.waitFor(() => expect(fixture.templater.parse_template).toHaveBeenCalledOnce());
    fixture.controller.abort();
    render.resolve(RENDERED);
    await stopped;
    expect(fixture.contents.get(DAILY_PATH)).toBe("");
    expect(fixture.files_with_pending_templates.size).toBe(0);
    expect(fixture.vault.process).not.toHaveBeenCalled();
    expect(fixture.noteWorkspace.open).not.toHaveBeenCalled();

    // Cancellation cannot take ownership of Templater's independent handler
    // after cleanup. This is the substitute's ordering, not a host verdict.
    await fixture.finishAutomaticCheck();
    expect(fixture.automaticWrites).toHaveBeenCalledExactlyOnceWith(DAILY_PATH);
    expect(fixture.contents.get(DAILY_PATH)).toBe(AUTOMATIC);
  });

  it.each(["periodic", "interval"] as const)(
    "refuses a delayed %s mutation callback after unload",
    async (kind) => {
      const fixture = createFixture();
      const process = deferred<void>();
      const entered = deferred<void>();
      fixture.vault.process.mockImplementationOnce(async (file, update) => {
        entered.resolve();
        await process.promise;
        const next = update(fixture.contents.get(file.path) ?? "");
        fixture.contents.set(file.path, next);
        return next;
      });
      const creation = kind === "periodic" ? fixture.createDaily() : fixture.createInterval();
      const rejected = expect(creation).rejects.toMatchObject({ retainedCreatedNote: true });
      await entered.promise;
      await fixture.finishAutomaticCheck();
      const path = kind === "periodic" ? DAILY_PATH : INTERVAL_PATH;
      const initial = fixture.contents.get(path);
      fixture.controller.abort();
      process.resolve();
      await rejected;
      expect(fixture.contents.get(path)).toBe(initial);
      expect(fixture.noteWorkspace.open).not.toHaveBeenCalled();
      expect(fixture.files_with_pending_templates.size).toBe(0);
    },
  );

  it("does not open a same-path waiter or start a larger period after unload", async () => {
    const fixture = createFixture();
    const render = deferred<string>();
    fixture.templater.parse_template.mockReturnValueOnce(render.promise);
    fixture.settings.periodicNotes.weekly = { enabled: true, pattern: "[Weekly]/GGGG-[W]WW", templatePath: "" };
    const request = { date: { year: 2026, month: 5, day: 18 }, noteType: "daily" as const, cascade: true };
    const first = expect(fixture.periodic.openOrCreate(request, fixture.settings)).rejects.toThrow();
    await vi.waitFor(() => expect(fixture.templater.parse_template).toHaveBeenCalledOnce());
    const waiter = expect(fixture.periodic.openOrCreate(request, fixture.settings)).rejects.toThrow();
    await fixture.finishAutomaticCheck();
    fixture.controller.abort();
    render.resolve(RENDERED);
    await Promise.all([first, waiter]);
    expect(fixture.vault.create).toHaveBeenCalledOnce();
    expect(fixture.noteWorkspace.open).not.toHaveBeenCalled();
  });

  it("stops between parent-folder creation and the note write", async () => {
    const fixture = createFixture();
    const folder = deferred<void>();
    fixture.settings.periodicNotes.daily.pattern = "[Nested/Days]/YYYY-MM-DD";
    fixture.vault.createFolder.mockImplementationOnce(async (path) => {
      await folder.promise;
      fixture.files.set(path, { path });
    });
    const stopped = expect(fixture.createDaily()).rejects.toMatchObject({ retainedCreatedNote: false });
    await vi.waitFor(() => expect(fixture.vault.createFolder).toHaveBeenCalledOnce());
    fixture.controller.abort();
    folder.resolve();
    await stopped;
    expect(fixture.vault.createFolder).toHaveBeenCalledOnce();
    expect(fixture.vault.create).not.toHaveBeenCalled();
    expect(fixture.files_with_pending_templates.size).toBe(0);
  });

  it.each(["periodic", "interval"] as const)(
    "protects a slow %s template from automatic folder rendering",
    async (kind) => {
      const fixture = createFixture();
      const render = deferred<string>();
      fixture.templater.parse_template.mockReturnValueOnce(render.promise);
      const creation = kind === "periodic" ? fixture.createDaily() : fixture.createInterval();
      const path = kind === "periodic" ? DAILY_PATH : INTERVAL_PATH;
      await fixture.creationStarted.promise;
      await fixture.finishAutomaticCheck();

      expect(fixture.reservationsAtCreate).toEqual([true]);
      expect(fixture.files_with_pending_templates.has(path)).toBe(true);
      expect(fixture.automaticWrites).not.toHaveBeenCalled();
      render.resolve(RENDERED);
      await expect(creation).resolves.toMatchObject({ status: "opened", created: true });
      expect(fixture.contents.get(path)).toContain(RENDERED);
      if (kind === "interval") {
        expect(fixture.contents.get(path)).toContain("start: 2026-05-18");
        expect(fixture.contents.get(path)).toContain("end: 2026-05-20");
      }
      expect(fixture.files_with_pending_templates.size).toBe(0);
      expect(fixture.end_templater_task).toHaveBeenCalledExactlyOnceWith(path);
      expect(fixture.teardown).toHaveBeenCalledOnce();
    },
  );

  it("keeps the reservation until the final Vault write settles", async () => {
    const fixture = createFixture();
    const writing = deferred<void>();
    const finishWrite = deferred<void>();
    fixture.vault.process.mockImplementationOnce(async (file, update) => {
      writing.resolve();
      await finishWrite.promise;
      const next = update(fixture.contents.get(file.path) ?? "");
      fixture.contents.set(file.path, next);
      return next;
    });
    const creation = fixture.createDaily();
    await writing.promise;
    await fixture.finishAutomaticCheck();
    expect(fixture.automaticWrites).not.toHaveBeenCalled();
    expect(fixture.end_templater_task).not.toHaveBeenCalled();
    finishWrite.resolve();
    await creation;
    expect(fixture.files_with_pending_templates.size).toBe(0);
  });

  it.each(["create", "render", "finalize"] as const)(
    "releases its reservation after a %s failure without undoing created content",
    async (stage) => {
      const fixture = createFixture();
      const failure = new Error(`${stage} failed`);
      if (stage === "create") fixture.vault.create.mockRejectedValueOnce(failure);
      if (stage === "render") fixture.templater.parse_template.mockRejectedValueOnce(failure);
      if (stage === "finalize") fixture.vault.process.mockRejectedValueOnce(failure);

      await expect(fixture.createDaily()).rejects.toThrow(failure.message);
      expect(fixture.files_with_pending_templates.size).toBe(0);
      expect(fixture.end_templater_task).toHaveBeenCalledExactlyOnceWith(DAILY_PATH);
      expect(fixture.teardown).toHaveBeenCalledOnce();
      expect(fixture.contents.get(DAILY_PATH)).toBe(stage === "create" ? undefined : "");
      expect(fixture.noteWorkspace.open).not.toHaveBeenCalled();
      // A failure must not poison the shared creation queue.
      await expect(fixture.createDaily(19)).resolves.toMatchObject({ created: true });
      expect(fixture.files_with_pending_templates.size).toBe(0);
    },
  );

  it("cleans up when deferred range-template metadata is invalid", async () => {
    const fixture = createFixture();
    fixture.templater.parse_template.mockResolvedValueOnce("---\n[invalid mapping]\n---\n");

    await expect(fixture.createInterval()).rejects.toThrow();
    expect(fixture.files_with_pending_templates.size).toBe(0);
    expect(fixture.end_templater_task).toHaveBeenCalledExactlyOnceWith(INTERVAL_PATH);
    expect(fixture.contents.get(INTERVAL_PATH)).toContain("start: 2026-05-18");
    expect(fixture.vault.process).not.toHaveBeenCalled();
  });

  it("preserves an external edit and releases its reservation on the rejected final write", async () => {
    const fixture = createFixture();
    fixture.templater.parse_template.mockImplementationOnce(async () => {
      fixture.contents.set(DAILY_PATH, "# External edit");
      return RENDERED;
    });

    await expect(fixture.createDaily()).rejects.toThrow("changed during template rendering");
    expect(fixture.contents.get(DAILY_PATH)).toBe("# External edit");
    expect(fixture.files_with_pending_templates.size).toBe(0);
    expect(fixture.end_templater_task).toHaveBeenCalledExactlyOnceWith(DAILY_PATH);
  });

  it("does not create, render, or clear a target reserved by an external task", async () => {
    const fixture = createFixture();
    fixture.files_with_pending_templates.add(DAILY_PATH);

    await expect(fixture.createDaily()).rejects.toThrow("already processing the target note");
    expect(fixture.files_with_pending_templates).toEqual(new Set([DAILY_PATH]));
    expect(fixture.vault.create).not.toHaveBeenCalled();
    expect(fixture.templater.parse_template).not.toHaveBeenCalled();
    expect(fixture.end_templater_task).not.toHaveBeenCalled();
  });

  it.each(["files_with_pending_templates", "end_templater_task"] as const)(
    "rejects missing %s before creating a target",
    async (field) => {
      const fixture = createFixture();
      Reflect.deleteProperty(fixture.templater, field);

      await expect(fixture.createDaily()).rejects.toMatchObject({
        cause: { details: { code: "templaterIncompatible" } },
      });
      expect(fixture.vault.create).not.toHaveBeenCalled();
    },
  );

  it("keeps other external reservations and does not tear down their modules", async () => {
    const fixture = createFixture();
    const externalPath = "External/pending.md";
    fixture.files_with_pending_templates.add(externalPath);

    await fixture.createDaily();
    expect(fixture.files_with_pending_templates).toEqual(new Set([externalPath]));
    expect(fixture.end_templater_task).toHaveBeenCalledExactlyOnceWith(DAILY_PATH);
    expect(fixture.allTemplatesExecuted).not.toHaveBeenCalled();
    expect(fixture.teardown).not.toHaveBeenCalled();
  });

  it("reserves queued paths and defers teardown until all creations finish", async () => {
    const fixture = createFixture();
    const render = deferred<string>();
    const secondRendering = deferred<void>();
    fixture.templater.parse_template
      .mockReturnValueOnce(render.promise)
      .mockImplementationOnce(async () => {
        secondRendering.resolve();
        expect(fixture.teardown).not.toHaveBeenCalled();
        return RENDERED;
      });
    const first = fixture.createDaily();
    await fixture.creationStarted.promise;
    const second = fixture.createInterval();
    await vi.waitFor(() => expect(fixture.files_with_pending_templates).toEqual(
      new Set([DAILY_PATH, INTERVAL_PATH]),
    ));
    expect(fixture.vault.create).toHaveBeenCalledOnce();
    await fixture.finishAutomaticCheck();
    render.resolve(RENDERED);
    await secondRendering.promise;
    await Promise.all([first, second]);

    expect(fixture.automaticWrites).not.toHaveBeenCalled();
    expect(fixture.reservationsAtCreate).toEqual([true, true]);
    expect(fixture.end_templater_task.mock.calls).toEqual([[DAILY_PATH], [INTERVAL_PATH]]);
    expect(fixture.allTemplatesExecuted).toHaveBeenCalledOnce();
    expect(fixture.teardown).toHaveBeenCalledOnce();
    expect(fixture.files_with_pending_templates.size).toBe(0);
  });

  it("waits for asynchronous cleanup before starting the next reserved creation", async () => {
    const fixture = createFixture();
    const cleanupStarted = deferred<void>();
    const finishCleanup = deferred<void>();
    fixture.teardown.mockImplementationOnce(async () => {
      cleanupStarted.resolve();
      await finishCleanup.promise;
    });
    const first = fixture.createDaily();
    await cleanupStarted.promise;
    const second = fixture.createInterval();
    await vi.waitFor(() => expect(fixture.files_with_pending_templates.has(INTERVAL_PATH)).toBe(true));
    expect(fixture.vault.create).toHaveBeenCalledOnce();
    expect(fixture.templater.parse_template).toHaveBeenCalledOnce();
    finishCleanup.resolve();
    await Promise.all([first, second]);
    expect(fixture.contents.get(INTERVAL_PATH)).toContain(RENDERED);
    expect(fixture.files_with_pending_templates.size).toBe(0);
  });

  it("continues a reserved creation after the preceding render fails", async () => {
    const fixture = createFixture();
    const failRender = deferred<void>();
    fixture.templater.parse_template.mockImplementationOnce(async () => {
      await failRender.promise;
      throw new Error("first render failed");
    });
    const first = expect(fixture.createDaily()).rejects.toThrow("first render failed");
    await fixture.creationStarted.promise;
    const second = fixture.createInterval();
    await vi.waitFor(() => expect(fixture.files_with_pending_templates.size).toBe(2));
    await fixture.finishAutomaticCheck();
    failRender.resolve();
    await Promise.all([first, second]);

    expect(fixture.contents.get(DAILY_PATH)).toBe("");
    expect(fixture.contents.get(INTERVAL_PATH)).toContain(RENDERED);
    expect(fixture.teardown).toHaveBeenCalledOnce();
    expect(fixture.files_with_pending_templates.size).toBe(0);
  });

  it("reports cleanup failure without discarding the original creation failure", async () => {
    const fixture = createFixture();
    const creationFailure = new Error("disk full");
    const cleanupFailure = new Error("teardown failed");
    fixture.vault.create.mockRejectedValueOnce(creationFailure);
    fixture.teardown.mockRejectedValueOnce(cleanupFailure);

    await expect(fixture.createDaily()).rejects.toMatchObject({
      cause: {
        name: "AggregateError",
        cause: creationFailure,
        errors: [creationFailure, cleanupFailure],
      },
    });
    expect(fixture.files_with_pending_templates.size).toBe(0);
    await expect(fixture.createDaily(19)).resolves.toMatchObject({ created: true });
  });

  it("reports failed cleanup after a successful final write and retains the note", async () => {
    const fixture = createFixture();
    fixture.teardown.mockRejectedValueOnce(new Error("teardown failed"));

    await expect(fixture.createDaily()).rejects.toThrow("Templater cleanup failed: teardown failed");
    expect(fixture.contents.get(DAILY_PATH)).toBe(RENDERED);
    expect(fixture.files_with_pending_templates.size).toBe(0);
    expect(fixture.noteWorkspace.open).not.toHaveBeenCalled();
  });
});
