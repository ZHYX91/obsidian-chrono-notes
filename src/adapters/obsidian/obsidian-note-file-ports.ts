import type { FileManager, Vault } from "obsidian";

import type { IntervalNoteFilePort } from "../../features/intervals/interval-note-commands";
import type { PeriodicNoteFilePort } from "../../features/periodic/periodic-note-commands";
import type { TaskFilePort } from "../../features/tasks/task-commands";
import { isMarkdownFile } from "./obsidian-markdown-files";

const pendingFolderCreates = new WeakMap<Vault, Map<string, Promise<void>>>();

export class ObsidianPeriodicNoteFilePort implements PeriodicNoteFilePort {
  constructor(
    private readonly vault: Vault,
    private readonly fileManager: FileManager,
  ) {}

  exists(path: string): boolean {
    return isMarkdownFile(this.vault.getAbstractFileByPath(path));
  }

  async create(path: string, content: string): Promise<void> {
    await ensureParentFolders(this.vault, path);
    await this.vault.create(path, content);
  }

  async modify(path: string, content: string): Promise<void> {
    const file = this.vault.getAbstractFileByPath(path);
    if (!isMarkdownFile(file)) throw new Error(`Markdown note not found: ${path}`);
    await this.vault.modify(file, content);
  }

  async delete(path: string): Promise<void> {
    const file = this.vault.getAbstractFileByPath(path);
    if (isMarkdownFile(file)) await this.fileManager.trashFile(file);
  }
}

export class ObsidianIntervalNoteFilePort implements IntervalNoteFilePort {
  constructor(
    private readonly vault: Vault,
    private readonly fileManager: FileManager,
  ) {}

  exists(path: string): boolean {
    return isMarkdownFile(this.vault.getAbstractFileByPath(path));
  }

  async create(path: string, content: string): Promise<void> {
    await ensureParentFolders(this.vault, path);
    await this.vault.create(path, content);
  }

  async modify(path: string, content: string): Promise<void> {
    const file = this.vault.getAbstractFileByPath(path);
    if (!isMarkdownFile(file)) throw new Error(`Markdown note not found: ${path}`);
    await this.vault.modify(file, content);
  }

  async delete(path: string): Promise<void> {
    const file = this.vault.getAbstractFileByPath(path);
    if (isMarkdownFile(file)) await this.fileManager.trashFile(file);
  }
}

export class ObsidianTaskFilePort implements TaskFilePort {
  constructor(private readonly vault: Vault) {}

  async process(path: string, update: (content: string) => string | null): Promise<void> {
    const file = this.vault.getAbstractFileByPath(path);
    if (!isMarkdownFile(file)) throw new Error(`Markdown note not found: ${path}`);
    await this.vault.process(file, (content) => update(content) ?? content);
  }
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
