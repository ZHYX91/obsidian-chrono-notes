import type { Editor, TFile, Vault, Workspace, WorkspaceLeaf } from "obsidian";

import type { IntervalNoteFilePort } from "../../features/intervals/interval-note-commands";
import type { PeriodicNoteFilePort } from "../../features/periodic/periodic-note-commands";
import type { TaskFilePort } from "../../features/tasks/task-commands";
import { TaskWriteError, type TaskWriteFeedback } from "../../features/tasks/task-write-feedback";
import type { CreatedNoteReference } from "../../features/templates/created-note-file-port";
import { assertNoteCreationActive } from "../../features/notes/note-creation-lifecycle";
import { isMarkdownFile } from "./obsidian-markdown-files";

const pendingFolderCreates = new WeakMap<Vault, Map<string, Promise<void>>>();

export class ObsidianPeriodicNoteFilePort implements PeriodicNoteFilePort {
  constructor(
    private readonly vault: Vault,
    private readonly workspace: Workspace,
    private readonly signal?: AbortSignal,
  ) {}

  exists(path: string): boolean {
    return isMarkdownFile(this.vault.getAbstractFileByPath(path));
  }

  async create(path: string, content: string): Promise<CreatedNoteReference> {
    return createNote(this.vault, path, content, this.signal);
  }

  async finalize(reference: CreatedNoteReference, content: string): Promise<void> {
    await finalizeCreatedNote(this.vault, this.workspace, reference, content, this.signal);
  }
}

export class ObsidianIntervalNoteFilePort implements IntervalNoteFilePort {
  constructor(
    private readonly vault: Vault,
    private readonly workspace: Workspace,
    private readonly signal?: AbortSignal,
  ) {}

  exists(path: string): boolean {
    return isMarkdownFile(this.vault.getAbstractFileByPath(path));
  }

  async create(path: string, content: string): Promise<CreatedNoteReference> {
    return createNote(this.vault, path, content, this.signal);
  }

  async finalize(reference: CreatedNoteReference, content: string): Promise<void> {
    await finalizeCreatedNote(this.vault, this.workspace, reference, content, this.signal);
  }
}

async function createNote(
  vault: Vault,
  path: string,
  content: string,
  signal?: AbortSignal,
): Promise<CreatedNoteReference> {
  assertNoteCreationActive(signal);
  await ensureParentFolders(vault, path, signal);
  assertNoteCreationActive(signal);
  const file = await vault.create(path, content);
  return Object.freeze({ identity: file, initialContent: content, path });
}

async function finalizeCreatedNote(
  vault: Vault,
  workspace: Workspace,
  reference: CreatedNoteReference,
  content: string,
  signal?: AbortSignal,
): Promise<void> {
  assertNoteCreationActive(signal);
  const file = reference.identity;
  assertCreatedNoteIdentity(vault, reference, file);
  assertNoOpenMarkdownEditor(workspace, reference.path);
  const published = await vault.process(file, (current) => {
    assertNoteCreationActive(signal);
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
  if (getOpenTaskPanes(workspace, path).length > 0) {
    throw new Error(`Created note opened during template rendering: ${path}`);
  }
}

export class ObsidianTaskFilePort implements TaskFilePort {
  constructor(
    private readonly vault: Vault,
    private readonly workspace: Workspace,
  ) {}

  async process(path: string, update: (content: string) => string | null): Promise<TaskWriteFeedback | void> {
    const file = this.vault.getAbstractFileByPath(path);
    if (!isMarkdownFile(file)) throw new Error(`Markdown note not found: ${path}`);
    const openEditor = findOpenTaskEditor(this.workspace, path);
    if (openEditor !== null) {
      const current = openEditor.editor.getValue();
      const next = update(current);
      if (next === null || next === current) return;
      assertTaskFileIdentity(this.vault, file, path);
      if (openEditor.file !== file || !isSameOpenTaskEditor(this.workspace, path, openEditor) ||
        openEditor.editor.getValue() !== current) {
        throw new Error(`Markdown editor changed before task update: ${path}`);
      }
      // Keep unchanged text outside the editor transaction. Offsets and the
      // editor API both use UTF-16 coordinates, including text before emoji.
      let start = 0;
      while (start < current.length && start < next.length && current[start] === next[start]) {
        start += 1;
      }
      let currentEnd = current.length;
      let nextEnd = next.length;
      while (currentEnd > start && nextEnd > start &&
        current[currentEnd - 1] === next[nextEnd - 1]) {
        currentEnd -= 1;
        nextEnd -= 1;
      }
      let transactionError: unknown;
      let transactionFailed = false;
      try {
        openEditor.editor.transaction({
          changes: [{
            from: openEditor.editor.offsetToPos(start),
            to: openEditor.editor.offsetToPos(currentEnd),
            text: next.slice(start, nextEnd),
          }],
        }, "chrono-notes-task");
      } catch (error) {
        transactionError = error;
        transactionFailed = true;
      }
      let published: string;
      try {
        published = openEditor.editor.getValue();
      } catch (cause) {
        throw new TaskWriteError("unconfirmed", path, { cause });
      }
      if (published !== next) {
        throw new TaskWriteError(published === current ? "not-applied" : "unconfirmed", path,
          transactionFailed ? { cause: transactionError } : undefined);
      }
      // The edit is applied. A later host callback/save failure is a warning,
      // not permission to replay a checkbox toggle or overwrite a third state.
      try {
        assertTaskFileIdentity(this.vault, file, path);
        if (!isSameOpenTaskEditor(this.workspace, path, openEditor)) {
          return { warning: "save-not-confirmed" };
        }
        openEditor.requestSave.call(openEditor.view);
      } catch {
        return { warning: "save-not-confirmed" };
      }
      if (transactionFailed) return { warning: "editor-reported-error" };
      return;
    }
    let expectedPublished: string | undefined;
    const published = await this.vault.process(file, (content) => {
      assertTaskFileIdentity(this.vault, file, path);
      if (getOpenTaskPanes(this.workspace, path).length > 0) {
        throw new Error(`Markdown editor opened before task update: ${path}`);
      }
      expectedPublished = update(content) ?? content;
      return expectedPublished;
    });
    // process() has committed at this point. Opening or renaming the note
    // afterwards must not turn a successful write into a reported failure.
    if (expectedPublished === undefined || published !== expectedPublished) {
      throw new Error(`Markdown task update could not be verified: ${path}`);
    }
  }
}

function assertTaskFileIdentity(vault: Vault, file: TFile, path: string): void {
  if (
    file.path !== path
    || vault.getAbstractFileByPath(path) !== file
  ) {
    throw new Error(`Markdown note changed during task update: ${path}`);
  }
}

interface OpenTaskPane {
  readonly leaf: WorkspaceLeaf;
  readonly file: unknown;
  readonly view: unknown;
  readonly editor: Editor | null | undefined;
  readonly requestSave: unknown;
}

interface OpenTaskEditor extends OpenTaskPane {
  readonly editor: Editor;
  readonly requestSave: () => void;
}

function findOpenTaskEditor(workspace: Workspace, path: string): OpenTaskEditor | null {
  const matches = getOpenTaskPanes(workspace, path);
  if (matches.length > 1) {
    throw new Error(`Cannot update task while Markdown note is open in multiple editors: ${path}`);
  }
  const match = matches[0];
  if (match === undefined) return null;
  if (!isWritableTaskEditor(match)) {
    throw new Error(`Cannot update task while the open Markdown editor is unavailable: ${path}`);
  }
  return match;
}

function isWritableTaskEditor(pane: OpenTaskPane): pane is OpenTaskEditor {
  return pane.editor != null && typeof pane.editor.getValue === "function" &&
    typeof pane.editor.offsetToPos === "function" && typeof pane.editor.transaction === "function" &&
    typeof pane.requestSave === "function";
}

function isSameOpenTaskEditor(
  workspace: Workspace,
  path: string,
  expected: OpenTaskEditor,
): boolean {
  const matches = getOpenTaskPanes(workspace, path);
  const current = matches[0];
  return matches.length === 1 && current !== undefined && isWritableTaskEditor(current) &&
    current.leaf === expected.leaf && current.view === expected.view &&
    current.file === expected.file && current.editor === expected.editor &&
    current.requestSave === expected.requestSave;
}

/** A matching pane blocks disk fallback even when its editor capabilities are unavailable. */
function getOpenTaskPanes(workspace: Workspace, path: string): OpenTaskPane[] {
  const matches: OpenTaskPane[] = [];
  for (const leaf of workspace.getLeavesOfType("markdown")) {
    const view = leaf.view as typeof leaf.view & {
      file?: { path?: unknown } | null;
      editor?: Editor | null;
      requestSave?: unknown;
    };
    if (view.file?.path === path) {
      matches.push({ leaf, file: view.file, view, editor: view.editor, requestSave: view.requestSave });
    }
  }
  return matches;
}

async function ensureParentFolders(vault: Vault, filePath: string, signal?: AbortSignal): Promise<void> {
  const parts = filePath.split("/").slice(0, -1);
  let current = "";
  for (const part of parts) {
    assertNoteCreationActive(signal);
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
