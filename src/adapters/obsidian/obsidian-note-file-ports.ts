import type { Editor, TFile, Vault, Workspace, WorkspaceLeaf } from "obsidian";

import type { IntervalNoteFilePort } from "../../features/intervals/interval-note-commands";
import type { PeriodicNoteFilePort } from "../../features/periodic/periodic-note-commands";
import type { TaskFilePort } from "../../features/tasks/task-commands";
import type { CreatedNoteReference } from "../../features/templates/created-note-file-port";
import { isMarkdownFile } from "./obsidian-markdown-files";

const pendingFolderCreates = new WeakMap<Vault, Map<string, Promise<void>>>();

export class ObsidianPeriodicNoteFilePort implements PeriodicNoteFilePort {
  constructor(
    private readonly vault: Vault,
    private readonly workspace: Workspace,
  ) {}

  exists(path: string): boolean {
    return isMarkdownFile(this.vault.getAbstractFileByPath(path));
  }

  async create(path: string, content: string): Promise<CreatedNoteReference> {
    return createNote(this.vault, path, content);
  }

  async finalize(reference: CreatedNoteReference, content: string): Promise<void> {
    await finalizeCreatedNote(this.vault, this.workspace, reference, content);
  }
}

export class ObsidianIntervalNoteFilePort implements IntervalNoteFilePort {
  constructor(
    private readonly vault: Vault,
    private readonly workspace: Workspace,
  ) {}

  exists(path: string): boolean {
    return isMarkdownFile(this.vault.getAbstractFileByPath(path));
  }

  async create(path: string, content: string): Promise<CreatedNoteReference> {
    return createNote(this.vault, path, content);
  }

  async finalize(reference: CreatedNoteReference, content: string): Promise<void> {
    await finalizeCreatedNote(this.vault, this.workspace, reference, content);
  }
}

async function createNote(
  vault: Vault,
  path: string,
  content: string,
): Promise<CreatedNoteReference> {
  await ensureParentFolders(vault, path);
  const file = await vault.create(path, content);
  return Object.freeze({ identity: file, initialContent: content, path });
}

async function finalizeCreatedNote(
  vault: Vault,
  workspace: Workspace,
  reference: CreatedNoteReference,
  content: string,
): Promise<void> {
  const file = reference.identity;
  assertCreatedNoteIdentity(vault, reference, file);
  assertNoOpenMarkdownEditor(workspace, reference.path);
  const published = await vault.process(file, (current) => {
    assertCreatedNoteIdentity(vault, reference, file);
    assertNoOpenMarkdownEditor(workspace, reference.path);
    if (current !== reference.initialContent) {
      throw new Error(`Created note changed during template rendering: ${reference.path}`);
    }
    return content;
  });
  assertCreatedNoteIdentity(vault, reference, file);
  if (published !== content) {
    throw new Error(`Created note write could not be verified: ${reference.path}`);
  }
}

function assertCreatedNoteIdentity(
  vault: Vault,
  reference: CreatedNoteReference,
  candidate: unknown,
): asserts candidate is TFile {
  const abstractFile = candidate as TFile | null;
  if (
    !isMarkdownFile(abstractFile) ||
    abstractFile.path !== reference.path ||
    vault.getAbstractFileByPath(reference.path) !== abstractFile
  ) {
    throw new Error(`Created note target changed during template rendering: ${reference.path}`);
  }
}

function assertNoOpenMarkdownEditor(workspace: Workspace, path: string): void {
  if (getOpenTaskEditors(workspace, path).length > 0) {
    throw new Error(`Created note opened during template rendering: ${path}`);
  }
}

export class ObsidianTaskFilePort implements TaskFilePort {
  constructor(
    private readonly vault: Vault,
    private readonly workspace: Workspace,
  ) {}

  async process(path: string, update: (content: string) => string | null): Promise<void> {
    const file = this.vault.getAbstractFileByPath(path);
    if (!isMarkdownFile(file)) throw new Error(`Markdown note not found: ${path}`);
    const openEditor = findOpenTaskEditor(this.workspace, path);
    if (openEditor !== null) {
      const current = openEditor.editor.getValue();
      const next = update(current);
      if (next === null || next === current) return;
      if (!isSameOpenTaskEditor(this.workspace, path, openEditor)) {
        throw new Error(`Markdown editor changed before task update: ${path}`);
      }
      openEditor.editor.transaction({
        changes: [{
          from: { line: 0, ch: 0 },
          to: openEditor.editor.offsetToPos(current.length),
          text: next,
        }],
      }, "chrono-notes-task");
      openEditor.requestSave();
      return;
    }
    await this.vault.process(file, (content) => update(content) ?? content);
  }
}

interface OpenTaskEditor {
  readonly leaf: WorkspaceLeaf;
  readonly editor: Editor;
  readonly requestSave: () => void;
}

function findOpenTaskEditor(workspace: Workspace, path: string): OpenTaskEditor | null {
  const matches = getOpenTaskEditors(workspace, path);
  if (matches.length > 1) {
    throw new Error(`Cannot update task while Markdown note is open in multiple editors: ${path}`);
  }
  return matches[0] ?? null;
}

function isSameOpenTaskEditor(
  workspace: Workspace,
  path: string,
  expected: OpenTaskEditor,
): boolean {
  const matches = getOpenTaskEditors(workspace, path);
  return matches.length === 1 &&
    matches[0]?.leaf === expected.leaf &&
    matches[0].editor === expected.editor;
}

function getOpenTaskEditors(workspace: Workspace, path: string): OpenTaskEditor[] {
  const matches: OpenTaskEditor[] = [];
  for (const leaf of workspace.getLeavesOfType("markdown")) {
    const view = leaf.view as typeof leaf.view & {
      file?: { path?: unknown } | null;
      editor?: Editor;
      requestSave?: () => void;
    };
    if (
      view.file?.path === path &&
      view.editor !== undefined &&
      typeof view.requestSave === "function"
    ) {
      matches.push({
        leaf,
        editor: view.editor,
        requestSave: () => view.requestSave?.(),
      });
    }
  }
  return matches;
}

async function ensureParentFolders(vault: Vault, filePath: string): Promise<void> {
  const parts = filePath.split("/").slice(0, -1);
  let current = "";
  for (const part of parts) {
    current = current.length === 0 ? part : `${current}/${part}`;
    await ensureFolder(vault, current);
  }
}

async function ensureFolder(vault: Vault, path: string): Promise<void> {
  if (vault.getAbstractFileByPath(path) !== null) return;

  let pendingByPath = pendingFolderCreates.get(vault);
  if (pendingByPath === undefined) {
    pendingByPath = new Map();
    pendingFolderCreates.set(vault, pendingByPath);
  }

  const existing = pendingByPath.get(path);
  if (existing !== undefined) {
    await existing;
    return;
  }

  const pending = (async () => {
    if (vault.getAbstractFileByPath(path) !== null) return;

    try {
      await vault.createFolder(path);
    } catch (error) {
      if (vault.getAbstractFileByPath(path) === null) throw error;
    }
  })();
  pendingByPath.set(path, pending);

  try {
    await pending;
  } finally {
    if (pendingByPath.get(path) === pending) pendingByPath.delete(path);
    if (pendingByPath.size === 0) pendingFolderCreates.delete(vault);
  }
}
