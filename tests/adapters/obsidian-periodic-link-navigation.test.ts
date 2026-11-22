import { TemplatedNoteCreator } from "../../src/features/templates/templated-note-creator";
import type { App, Workspace } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { ObsidianPeriodicLinkNavigation } from "../../src/adapters/obsidian/obsidian-periodic-link-navigation";
import { PeriodicNoteCommands } from "../../src/features/periodic/periodic-note-commands";
import { createDefaultSettings } from "../../src/shared/settings";

vi.mock("obsidian", () => ({
  MarkdownView: class {},
  parseLinktext(text: string) {
    const index = text.indexOf("#");
    return index < 0 ? { path: text, subpath: "" } : { path: text.slice(0, index), subpath: text.slice(index) };
  },
}));

const day = "2026-11-19";
const source = "Projects/Meeting.md";
const journal = `日记/2026/2026-11/${day}/${day}.md`;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => { resolve = settle; });
  return { promise, resolve };
}

function fixture() {
  const settings = createDefaultSettings();
  settings.periodicNotes.daily = {
    enabled: true, pattern: "日记/YYYY/YYYY-MM/YYYY-MM-DD/YYYY-MM-DD", templatePath: "Templates/Daily.md",
  };
  settings.periodicNotes.monthly = { enabled: false, pattern: "[Monthly]/YYYY-MM", templatePath: "" };
  const native = vi.fn<Workspace["openLinkText"]>(async () => {});
  const openFile = vi.fn(async () => {});
  type Claim = (request: {
    linkText: string; sourcePath: string; newLeaf?: Parameters<Workspace["openLinkText"]>[2];
    viewState?: Parameters<Workspace["openLinkText"]>[3]; claim: (navigation: Promise<void>) => void;
  }) => void;
  const listeners = new Set<Claim>();
  const workspace = {
    on: (name: string, listener: Claim) => {
      expect(name).toBe("chrono-notes:claim-missing-periodic-link-v1");
      listeners.add(listener);
      return listener;
    },
    offref: (listener: Claim) => listeners.delete(listener),
    openLinkText: native as Workspace["openLinkText"],
    getLeaf: vi.fn(() => ({ openFile })),
    getActiveViewOfType: vi.fn<() => unknown>(() => null),
  };
  const notes = new Map<string, { path: string; body: string }>();
  const getFirstLinkpathDest = vi.fn<(path: string, source: string) => { path: string } | null>(() => null);
  const app = {
    metadataCache: { getFirstLinkpathDest }, workspace,
    vault: { getFileByPath: (path: string) =>
      path.toLowerCase() === source.toLowerCase() || path === "file:/outside-vault.md" ? { path, body: "" } : notes.get(path) ?? null },
  };
  const confirm = vi.fn(async () => true);
  const prepare = vi.fn<() => Promise<{ initialContent: string; renderAfterCreate?: () => Promise<string> }>>(
    async () => ({ initialContent: "# Journal template" }),
  );
  const files = {
    exists: (path: string) => notes.has(path),
    create: async (path: string, initialContent: string) => {
      const identity = { path, body: initialContent };
      notes.set(path, identity);
      return { path, initialContent, identity };
    },
    finalize: vi.fn(async (ref: { path: string }, content: string) => {
      const note = notes.get(ref.path);
      if (note === undefined) throw new Error("missing note");
      note.body = content;
    }),
  };
  const creator = new TemplatedNoteCreator(files, { prepare });
  const commands = new PeriodicNoteCommands(
    creator,
    { open: vi.fn() },
  );
  const reportError = vi.fn();
  const router = new ObsidianPeriodicLinkNavigation(app as unknown as App, () => settings, () => "en",
    async (date, noteType, navigate) => {
      await commands.openOrCreate({ date, noteType, target: navigate, confirmCreate: confirm }, {
        ...settings, locale: "en",
      });
    }, reportError, (path: string) => creator.pending(path));
  return { reportError, listeners, settings, notes, native, openFile, workspace, getFirstLinkpathDest, app, router, prepare, confirm };
}

describe("workspace link navigation for missing periodic notes", () => {
  it("uses the real creation command then opens the exact file before the metadata cache catches up", async () => {
    const { workspace, router, getFirstLinkpathDest, notes, openFile, native, prepare, confirm } = fixture();
    router.setEnabled(true);
    const view = { state: { mode: "preview" }, eState: { focus: true }, active: false };
    // The link [[...#^todo|今天]] supplies only the href to openLinkText.
    await workspace.openLinkText(`${day}/${day}#^todo`, source, "split", view);
    expect(getFirstLinkpathDest).toHaveBeenCalledWith(`${day}/${day}`, source);
    expect(prepare).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ path: journal }));
    expect([...notes.keys()]).toEqual([journal]);
    expect(notes.get(journal)?.body).toBe("# Journal template");
    expect(workspace.getLeaf).toHaveBeenCalledWith("split");
    expect(openFile).toHaveBeenCalledWith(notes.get(journal), {
      ...view, eState: { focus: true, subpath: "#^todo" },
    });
    expect(view.eState).toEqual({ focus: true });
    expect(native).not.toHaveBeenCalled();
  });

  it.each(["switch", "close", "pin", "repurpose"])("keeps the original pane through a delayed %s", async (action) => {
    const { router, workspace, openFile, notes, confirm } = fixture();
    const originalOpen = vi.fn(async () => {});
    const state = { pinned: false };
    const leaf = { openFile: originalOpen, view: {}, getViewState: () => state };
    const view = { leaf, navigation: true, containerEl: { isConnected: true }, file: { path: source } };
    leaf.view = view;
    workspace.getActiveViewOfType.mockReturnValue(view);
    confirm.mockImplementation(async () => {
      workspace.getActiveViewOfType.mockReturnValue(null);
      if (action === "close") view.containerEl.isConnected = false;
      if (action === "pin") state.pinned = true;
      if (action === "repurpose") view.file = { path: "Other.md" };
      return true;
    });
    router.setEnabled(true);
    await workspace.openLinkText(day, source);
    if (action === "switch") {
      expect(originalOpen).toHaveBeenCalledWith(notes.get(journal), undefined);
      expect(workspace.getLeaf).not.toHaveBeenCalled();
    } else {
      expect(originalOpen).not.toHaveBeenCalled();
      expect(workspace.getLeaf).toHaveBeenCalledWith("tab");
      expect(openFile).toHaveBeenCalledWith(notes.get(journal), undefined);
    }
  });

  it.each(["MD", "Md"])("recognizes Markdown sources and explicit link extensions with %s casing", async (extension) => {
    const { router, workspace, notes, native } = fixture();
    router.setEnabled(true);
    await workspace.openLinkText(day + "." + extension, "Projects/Meeting." + extension);
    expect([...notes.keys()]).toEqual([journal]);
    expect(native).not.toHaveBeenCalled();
  });

  it.each(["", "Projects/"])("opens an existing exact %s path while the metadata index catches up", async (folder) => {
    const { router, workspace, notes, openFile, prepare, confirm } = fixture();
    const existing = { path: folder + day + ".md", body: "original file" };
    notes.set(existing.path, existing);
    router.setEnabled(true);
    await workspace.openLinkText(day + "#Plan", source, "window");
    expect(workspace.getLeaf).toHaveBeenCalledWith("window");
    expect(openFile).toHaveBeenCalledExactlyOnceWith(existing, { eState: { subpath: "#Plan" } });
    expect(prepare).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    expect([...notes.keys()]).toEqual([existing.path]);
  });

  it("finds source-relative extension variants and honors an explicitly named periodic file", async () => {
    const { router, workspace, notes, openFile, prepare } = fixture();
    router.setEnabled(true);
    const relative = `Projects/${day}.mD`;
    const upper = journal.slice(0, -3) + ".MD";
    for (const path of [relative, journal, upper]) notes.set(path, { path, body: path });
    await workspace.openLinkText(day + "#Part", source);
    expect(openFile).toHaveBeenLastCalledWith(notes.get(relative), { eState: { subpath: "#Part" } });
    const root = day + ".Md";
    notes.set(root, { path: root, body: "exact extension at root" });
    await workspace.openLinkText(root, source);
    expect(openFile).toHaveBeenLastCalledWith(notes.get(root), undefined);
    notes.delete(relative);
    notes.delete(root);
    await workspace.openLinkText(day + ".MD", source);
    expect(openFile).toHaveBeenLastCalledWith(notes.get(upper), undefined);
    await workspace.openLinkText(day, source);
    expect(openFile).toHaveBeenLastCalledWith(notes.get(journal), undefined);
    expect(prepare).not.toHaveBeenCalled();
  });

  it.each([false, true])("waits for a periodic owner before opening a link (metadata resolved: %s)", async (resolved) => {
    const { router, workspace, notes, openFile, native, getFirstLinkpathDest, prepare, reportError } = fixture();
    const started = deferred<void>();
    const finish = deferred<string>();
    prepare.mockResolvedValueOnce({ initialContent: "initial", renderAfterCreate: () => {
      started.resolve();
      return finish.promise;
    } });
    router.setEnabled(true);
    const creating = workspace.openLinkText(day, source);
    await started.promise;
    if (resolved) getFirstLinkpathDest.mockImplementation(() => notes.get(journal) ?? null);
    const explicit = journal.slice(0, -3) + ".MD#Heading";
    const opening = workspace.openLinkText(explicit, source, "tab");
    await Promise.resolve();
    expect(openFile).not.toHaveBeenCalled();
    expect(native).not.toHaveBeenCalled();
    finish.resolve("complete");
    await Promise.all([creating, opening]);
    expect(notes.get(journal)?.body).toBe("complete");
    expect(reportError).not.toHaveBeenCalled();
    if (resolved) {
      expect(native).toHaveBeenCalledExactlyOnceWith(explicit, source, "tab");
      expect(openFile).toHaveBeenCalledOnce();
    } else {
      expect(native).not.toHaveBeenCalled();
      expect(openFile).toHaveBeenCalledTimes(2);
    }
  });

  it("keeps native navigation closed if the resolved template owner fails", async () => {
    const { router, workspace, notes, openFile, native, getFirstLinkpathDest, prepare, reportError } = fixture();
    const started = deferred<void>();
    const finish = deferred<void>();
    prepare.mockResolvedValueOnce({ initialContent: "initial", renderAfterCreate: async () => {
      started.resolve();
      await finish.promise;
      throw new Error("template failed");
    } });
    router.setEnabled(true);
    const creating = workspace.openLinkText(day, source);
    await started.promise;
    getFirstLinkpathDest.mockImplementation(() => notes.get(journal) ?? null);
    const opening = workspace.openLinkText(day, source);
    finish.resolve();
    await Promise.all([creating, opening]);
    expect(native).not.toHaveBeenCalled();
    expect(openFile).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalled();
  });

  it("keeps the explicit spelling of a short link while confirmation is open", async () => {
    const { router, workspace, notes, openFile, confirm, prepare } = fixture();
    const upper = journal.slice(0, -3) + ".MD";
    confirm.mockImplementationOnce(async () => {
      for (const path of [journal, upper]) notes.set(path, { path, body: path });
      return true;
    });
    router.setEnabled(true);
    await workspace.openLinkText(day + ".MD", source);
    expect(prepare).not.toHaveBeenCalled();
    expect(openFile).toHaveBeenCalledExactlyOnceWith(notes.get(upper), undefined);
  });

  it("preserves literal pipes in Markdown headings instead of treating part of the target as an alias", async () => {
    const { router, workspace, openFile, notes } = fixture();
    router.setEnabled(true);
    await workspace.openLinkText(`${day}#one|two`, source);
    expect(openFile).toHaveBeenCalledWith(notes.get(journal), { eState: { subpath: "#one|two" } });
  });

  it.each([undefined, false, true, "tab", "window"] as const)("preserves the requested pane %s", async (pane) => {
    const { router, workspace, openFile, notes } = fixture();
    router.setEnabled(true);
    await workspace.openLinkText(day, source, pane);
    expect(workspace.getLeaf).toHaveBeenCalledWith(pane);
    expect(openFile).toHaveBeenCalledWith(notes.get(journal), undefined);
  });

  it("preserves original navigation for resolved links, ordinary targets and disabled or ambiguous types", async () => {
    const { router, native, workspace, getFirstLinkpathDest, notes, settings } = fixture();
    const view = { active: false };
    router.setEnabled(true);
    getFirstLinkpathDest.mockImplementation((path, from) =>
      path === day && from === source ? { path: `会议/${day}.md` } : null);
    for (const text of [day, "meeting", `${day}|notes`, "2026-11", `会议/${day}`, `./${day}`, "#outline"]) {
      await workspace.openLinkText(text, source, true, view);
      expect(native).toHaveBeenLastCalledWith(text, source, true, view);
    }
    settings.periodicNotes.monthly.enabled = true;
    settings.periodicNotes.monthly.pattern = "[Monthly]/YYYY-MM-DD";
    await workspace.openLinkText("2026-11-01", source);
    expect(native).toHaveBeenLastCalledWith("2026-11-01", source);
    settings.createMissingPeriodicNotesFromLinks = false;
    await workspace.openLinkText("2026-11-20", source);
    expect(native).toHaveBeenLastCalledWith("2026-11-20", source);
    expect(notes.size).toBe(0);
  });

  it("delegates calls without a source note and never creates after cancellation or template failure", async () => {
    const { native, workspace, notes, confirm, router, prepare, reportError } = fixture();
    router.setEnabled(true);
    for (const from of ["", "file:/outside-vault.md"]) {
      await workspace.openLinkText(day, from);
      expect(native).toHaveBeenLastCalledWith(day, from);
    }
    native.mockClear();
    confirm.mockResolvedValueOnce(false);
    await workspace.openLinkText(day, source);
    prepare.mockRejectedValueOnce(new Error("template missing"));
    await workspace.openLinkText(day, source);
    expect(reportError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: expect.stringContaining("template missing") }));
    expect(native).not.toHaveBeenCalled();
    expect(notes.size).toBe(0);
  });

  it("does not retry native creation after the confirmed file vanishes", async () => {
    const { app, workspace, native, openFile, router, reportError } = fixture();
    app.vault.getFileByPath = (path) => path === source ? { path, body: "" } : null;
    router.setEnabled(true);
    await workspace.openLinkText(day, source);
    expect(reportError).toHaveBeenCalledExactlyOnceWith(new Error(`Markdown note not found: ${journal}`));
    expect(native).not.toHaveBeenCalled();
    expect(openFile).not.toHaveBeenCalled();
  });

  it.each(["before", "after"] as const)("claims the matching link exactly once with a fallback installed %s Chrono", async (order) => {
    const { workspace, router, listeners, native, notes, confirm, prepare, openFile, reportError } = fixture();
    const fallback = vi.fn(async () => {});
    if (order === "after") router.setEnabled(true);
    const next = workspace.openLinkText;
    workspace.openLinkText = (linkText, sourcePath, newLeaf, viewState) => {
      let claimed: Promise<void> | undefined;
      for (const listener of listeners) {
        listener({ linkText, sourcePath, newLeaf, viewState, claim: (navigation) => { claimed = navigation; } });
      }
      return claimed ?? (linkText === "other" ? next(linkText, sourcePath, newLeaf, viewState) : fallback());
    };
    if (order === "before") router.setEnabled(true);

    confirm.mockResolvedValueOnce(false);
    await workspace.openLinkText(day, source);
    prepare.mockRejectedValueOnce(new Error("template unavailable"));
    await workspace.openLinkText(day, source);
    expect(reportError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: expect.stringContaining("template unavailable") }));
    expect(notes.size).toBe(0);
    await workspace.openLinkText(day + "#Plan", source, "tab");
    expect(notes.size).toBe(1);
    expect(openFile).toHaveBeenCalledExactlyOnceWith(notes.get(journal), { eState: { subpath: "#Plan" } });
    expect(workspace.getLeaf).toHaveBeenCalledWith("tab");
    expect(confirm).toHaveBeenCalledTimes(3);
    expect(fallback).not.toHaveBeenCalled();
    expect(native).not.toHaveBeenCalled();

    await workspace.openLinkText("folder", source);
    expect(fallback).toHaveBeenCalledOnce();
    router.setEnabled(false);
    expect(listeners.size).toBe(0);
    await workspace.openLinkText("2026-11-21", source);
    expect(fallback).toHaveBeenCalledTimes(2);
    await workspace.openLinkText("other", source);
    expect(native).toHaveBeenCalledOnce();
  });

  it("restores native navigation and leaves a later plugin's wrapper intact on disable or unload", async () => {
    const { router, workspace, native, notes } = fixture();
    expect(workspace.openLinkText).toBe(native);
    router.setEnabled(true);
    const first = workspace.openLinkText;
    router.setEnabled(true);
    expect(workspace.openLinkText).toBe(first);
    router.setEnabled(false);
    expect(workspace.openLinkText).toBe(native);

    router.setEnabled(true);
    const saved = workspace.openLinkText;
    const later = vi.fn((...args: Parameters<Workspace["openLinkText"]>) => saved(...args));
    workspace.openLinkText = later;
    router.setEnabled(false);
    expect(workspace.openLinkText).toBe(later);
    await workspace.openLinkText(day, source);
    expect(native).toHaveBeenCalledExactlyOnceWith(day, source);
    expect(notes.size).toBe(0);
  });
});
