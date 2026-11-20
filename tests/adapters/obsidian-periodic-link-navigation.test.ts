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

function fixture() {
  const settings = createDefaultSettings();
  settings.createMissingPeriodicNotesFromLinks = true;
  settings.periodicNotes.daily = {
    enabled: true, pattern: "日记/YYYY/YYYY-MM/YYYY-MM-DD/YYYY-MM-DD", templatePath: "Templates/Daily.md",
  };
  settings.periodicNotes.monthly = { enabled: false, pattern: "[Monthly]/YYYY-MM", templatePath: "" };
  const native = vi.fn<Workspace["openLinkText"]>(async () => {});
  const openFile = vi.fn(async () => {});
  const workspace = {
    openLinkText: native,
    getLeaf: vi.fn(() => ({ openFile })),
    getActiveViewOfType: vi.fn<() => unknown>(() => null),
  };
  const notes = new Map<string, { path: string; body: string }>();
  const getFirstLinkpathDest = vi.fn<(path: string, source: string) => { path: string } | null>(() => null);
  const app = {
    metadataCache: { getFirstLinkpathDest }, workspace,
    vault: { getFileByPath: (path: string) =>
      path === source || path === "file:/outside-vault.md" ? { path, body: "" } : notes.get(path) ?? null },
  };
  const confirm = vi.fn(async () => true);
  const prepare = vi.fn(async () => ({ initialContent: "# Journal template" }));
  const files = {
    exists: (path: string) => notes.has(path),
    create: async (path: string, initialContent: string) => {
      const identity = { path, body: initialContent };
      notes.set(path, identity);
      return { path, initialContent, identity };
    },
    finalize: vi.fn(),
  };
  const commands = new PeriodicNoteCommands(files, { prepare }, { open: vi.fn() });
  const router = new ObsidianPeriodicLinkNavigation(app as unknown as App, () => settings, () => "en",
    async (date, noteType, navigate) => {
      await commands.openOrCreate({ date, noteType, target: navigate, confirmCreate: confirm }, {
        ...settings, locale: "en",
      });
    });
  return { settings, notes, native, openFile, workspace, getFirstLinkpathDest, app, router, prepare, confirm };
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
    const { native, workspace, notes, confirm, router, prepare } = fixture();
    router.setEnabled(true);
    for (const from of ["", "file:/outside-vault.md"]) {
      await workspace.openLinkText(day, from);
      expect(native).toHaveBeenLastCalledWith(day, from);
    }
    native.mockClear();
    confirm.mockResolvedValueOnce(false);
    await workspace.openLinkText(day, source);
    prepare.mockRejectedValueOnce(new Error("template missing"));
    await expect(workspace.openLinkText(day, source)).rejects.toThrow("template missing");
    expect(native).not.toHaveBeenCalled();
    expect(notes.size).toBe(0);
  });

  it("does not retry native creation after the confirmed file vanishes", async () => {
    const { app, workspace, native, openFile, router } = fixture();
    app.vault.getFileByPath = (path) => path === source ? { path, body: "" } : null;
    router.setEnabled(true);
    await expect(workspace.openLinkText(day, source)).rejects.toThrow("Markdown note not found");
    expect(native).not.toHaveBeenCalled();
    expect(openFile).not.toHaveBeenCalled();
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
