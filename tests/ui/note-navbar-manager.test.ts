import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const roots: Array<{
    render: ReturnType<typeof vi.fn>;
    unmount: ReturnType<typeof vi.fn>;
  }> = [];
  return {
    createRoot: vi.fn(() => {
      const root = {
        render: vi.fn(),
        unmount: vi.fn(),
      };
      roots.push(root);
      return root;
    }),
    roots,
  };
});

vi.mock("obsidian", () => ({
  MarkdownView: class MarkdownView {},
}));

vi.mock("react-dom/client", () => ({
  createRoot: mocks.createRoot,
}));

import { MarkdownView } from "obsidian";
import { NoteNavbarManager } from "../../src/ui/note-navbar/note-navbar";
import { createDefaultSettings } from "../../src/shared/settings";
import { createNoteIndexSnapshot } from "../support/note-index-snapshot";

const EMPTY_NOTE_SNAPSHOT = createNoteIndexSnapshot({}, 1);

interface FakeElement {
  readonly classList: Pick<DOMTokenList, "add" | "contains" | "remove">;
  readonly ownerDocument: { createElement(): FakeElement };
  className: string;
  nextElementSibling: FakeElement | null;
  parentElement: FakeElement | null;
  previousElementSibling: FakeElement | null;
  removed: boolean;
  insertAdjacentElement(position: string, element: FakeElement): void;
  remove(): void;
}

function createElement(): FakeElement {
  const classes = new Set<string>();
  return {
    classList: {
      add: (...tokens) => tokens.forEach((token) => classes.add(token)),
      contains: (token) => classes.has(token),
      remove: (...tokens) => tokens.forEach((token) => classes.delete(token)),
    },
    ownerDocument: { createElement: vi.fn(createElement) },
    className: "",
    nextElementSibling: null,
    parentElement: null,
    previousElementSibling: null,
    removed: false,
    insertAdjacentElement(position, element) {
      if (position !== "beforebegin") throw new Error(`Unexpected position: ${position}`);
      element.parentElement = this.parentElement;
      element.previousElementSibling = this.previousElementSibling;
      element.nextElementSibling = this;
      if (this.previousElementSibling !== null) {
        this.previousElementSibling.nextElementSibling = element;
      }
      this.previousElementSibling = element;
    },
    remove() {
      if (this.previousElementSibling !== null) {
        this.previousElementSibling.nextElementSibling = this.nextElementSibling;
      }
      if (this.nextElementSibling !== null) {
        this.nextElementSibling.previousElementSibling = this.previousElementSibling;
      }
      this.removed = true;
      this.nextElementSibling = null;
      this.parentElement = null;
      this.previousElementSibling = null;
    },
  };
}

describe("NoteNavbarManager", () => {
  beforeEach(() => {
    mocks.createRoot.mockClear();
    mocks.roots.length = 0;
    vi.stubGlobal("navigator", { language: "en-US" });
    vi.stubGlobal("document", { createElement: vi.fn(createElement) });
  });

  it("unmounts when the active periodic note is renamed outside its configured path", () => {
    const settings = createDefaultSettings();
    settings.periodicNotes.daily = {
      enabled: true,
      pattern: "'Daily'/yyyy-MM-dd",
      templatePath: "",
    };
    const parent = createElement();
    const content = createElement();
    content.parentElement = parent;
    const view = Object.assign(new MarkdownView({} as never), {
      file: { path: "Daily/2026-07-14.md" },
      contentEl: content,
    });
    const leaf = { view };
    const manager = new NoteNavbarManager(
      { workspace: { getLeavesOfType: () => [leaf] } } as never,
      {
        noteIndex: {
          getSnapshot: () => EMPTY_NOTE_SNAPSHOT,
          subscribe: () => () => undefined,
        },
        getSettings: () => settings,
        openPeriodic: vi.fn(),
        openCalendar: vi.fn(),
        openPath: vi.fn(),
        setRelatedCollapsed: vi.fn(),
        pickDate: vi.fn(),
      } as never,
    );

    manager.update();
    expect(mocks.createRoot).toHaveBeenCalledOnce();
    expect(content.ownerDocument.createElement).toHaveBeenCalledOnce();
    expect(document.createElement).not.toHaveBeenCalled();
    expect(mocks.roots[0]?.render).toHaveBeenCalledOnce();
    expect(content.previousElementSibling?.nextElementSibling).toBe(content);
    expect(parent.classList.contains("chrono-notes-navbar-mounted")).toBe(false);

    view.file.path = "Fixtures/renamed-daily.md";
    manager.handleFileRename();

    expect(mocks.roots[0]?.unmount).toHaveBeenCalledOnce();
    expect(parent.classList.contains("chrono-notes-navbar-mounted")).toBe(false);
  });

  it("keeps a periodic-note navbar mounted when focus moves to the sidebar", () => {
    const settings = createDefaultSettings();
    settings.periodicNotes.daily = {
      enabled: true,
      pattern: "'Daily'/yyyy-MM-dd",
      templatePath: "",
    };
    const parent = createElement();
    const content = createElement();
    content.parentElement = parent;
    const view = Object.assign(new MarkdownView({} as never), {
      file: { path: "Daily/2026-07-14.md" },
      contentEl: content,
    });
    const leaf = { view };
    const manager = new NoteNavbarManager(
      { workspace: { getLeavesOfType: () => [leaf] } } as never,
      {
        noteIndex: {
          getSnapshot: () => EMPTY_NOTE_SNAPSHOT,
          subscribe: () => () => undefined,
        },
        getSettings: () => settings,
      } as never,
    );

    manager.update();
    manager.update();

    expect(mocks.createRoot).toHaveBeenCalledOnce();
    expect(mocks.roots[0]?.render).toHaveBeenCalledTimes(2);
    expect(mocks.roots[0]?.unmount).not.toHaveBeenCalled();
  });

  it("mounts each Markdown leaf independently and cleans up closed leaves", () => {
    const settings = createDefaultSettings();
    settings.periodicNotes.daily = {
      enabled: true,
      pattern: "'Daily'/yyyy-MM-dd",
      templatePath: "",
    };
    const createLeaf = (path: string) => {
      const parent = createElement();
      const content = createElement();
      content.parentElement = parent;
      return {
        view: Object.assign(new MarkdownView({} as never), {
          file: { path },
          contentEl: content,
        }),
      };
    };
    const leaves = [createLeaf("Daily/2026-07-14.md"), createLeaf("Daily/2026-07-15.md")];
    const manager = new NoteNavbarManager(
      { workspace: { getLeavesOfType: () => leaves } } as never,
      {
        noteIndex: {
          getSnapshot: () => EMPTY_NOTE_SNAPSHOT,
          subscribe: () => () => undefined,
        },
        getSettings: () => settings,
      } as never,
    );

    manager.update();
    expect(mocks.createRoot).toHaveBeenCalledTimes(2);
    expect(mocks.roots[0]?.render).toHaveBeenCalledOnce();
    expect(mocks.roots[1]?.render).toHaveBeenCalledOnce();

    leaves.pop();
    manager.update();
    expect(mocks.roots[0]?.unmount).not.toHaveBeenCalled();
    expect(mocks.roots[1]?.unmount).toHaveBeenCalledOnce();
  });
});
