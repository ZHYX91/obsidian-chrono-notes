import type { TFile, Vault, Workspace, WorkspaceLeaf } from "obsidian";

import type {
  NoteOpenTarget,
  PeriodicNoteWorkspacePort,
} from "../../features/periodic/periodic-note-commands";
import type { TaskWorkspacePort } from "../../features/tasks/task-commands";
import { isMarkdownFile } from "./obsidian-markdown-files";
import { assertNoteCreationActive } from "../../features/notes/note-creation-lifecycle";

export class ObsidianPeriodicNoteWorkspacePort implements PeriodicNoteWorkspacePort {
  constructor(
    private readonly vault: Vault,
    private readonly workspace: Workspace,
    private readonly signal?: AbortSignal,
  ) {}

  async open(path: string, target: NoteOpenTarget): Promise<void> {
    await activateMarkdownFile(this.vault, this.workspace, path, target, this.signal);
  }
}

export class ObsidianTaskWorkspacePort implements TaskWorkspacePort {
  constructor(
    private readonly vault: Vault,
    private readonly workspace: Workspace,
  ) {}

  async openAtLine(path: string, line: number, target: NoteOpenTarget): Promise<void> {
    await activateMarkdownFile(this.vault, this.workspace, path, target, undefined, (leaf) => {
      const editor = getLeafEditor(leaf);
      if (editor === null) throw new Error(`Markdown editor not available: ${path}`);
      const position = { line, ch: 0 };
      editor.setCursor(position);
      editor.scrollIntoView({ from: position, to: position }, true);
    });
  }
}

async function activateMarkdownFile(
  vault: Vault,
  workspace: Workspace,
  path: string,
  target: NoteOpenTarget,
  signal?: AbortSignal,
  onActive?: (leaf: WorkspaceLeaf) => void,
): Promise<void> {
  assertNoteCreationActive(signal);
  const file = vault.getAbstractFileByPath(path);
  if (!isMarkdownFile(file)) throw new Error(`Markdown note not found: ${path}`);
  const leaf = target === "default"
    ? findOpenMarkdownLeaf(workspace, path) ?? workspace.getLeaf("tab")
    : workspace.getLeaf("tab");

  const assertDestination = (): void => {
    assertNoteCreationActive(signal);
    const view = leaf.view as typeof leaf.view & { file?: TFile | null };
    if (view.file !== file || file.path !== path || vault.getAbstractFileByPath(path) !== file) {
      throw new Error(`Markdown tab no longer shows the requested note: ${path}`);
    }
  };
  if (getLeafFilePath(leaf) !== path) await leaf.openFile(file);
  assertDestination();
  await workspace.revealLeaf(leaf);
  assertDestination();
  workspace.setActiveLeaf(leaf, { focus: true });
  assertDestination();
  onActive?.(leaf);
}

function getLeafFilePath(leaf: WorkspaceLeaf): string | null {
  const view = leaf.view as typeof leaf.view & { file?: { path?: unknown } | null };
  return typeof view.file?.path === "string" ? view.file.path : null;
}

function findOpenMarkdownLeaf(
  workspace: Workspace,
  path: string,
): WorkspaceLeaf | null {
  let match: WorkspaceLeaf | null = null;
  workspace.iterateRootLeaves((leaf) => {
    if (
      match === null &&
      leaf.getViewState().type === "markdown" &&
      getLeafFilePath(leaf) === path
    ) {
      match = leaf;
    }
  });
  return match;
}

function getLeafEditor(leaf: WorkspaceLeaf): Readonly<{
  setCursor(position: { line: number; ch: number }): void;
  scrollIntoView(
    range: Readonly<{
      from: { line: number; ch: number };
      to: { line: number; ch: number };
    }>,
    center: boolean,
  ): void;
}> | null {
  const view = leaf.view as typeof leaf.view & {
    editor?: {
      setCursor?: unknown;
      scrollIntoView?: unknown;
    };
  };
  if (
    typeof view.editor?.setCursor !== "function" ||
    typeof view.editor.scrollIntoView !== "function"
  ) return null;
  return view.editor as never;
}
