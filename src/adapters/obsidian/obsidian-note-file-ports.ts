import type { FileManager, Vault } from "obsidian";

import type { IntervalNoteFilePort } from "../../features/intervals/interval-note-commands";
import type { PeriodicNoteFilePort } from "../../features/periodic/periodic-note-commands";
import type { TaskFilePort } from "../../features/tasks/task-commands";
import { isMarkdownFile } from "./obsidian-markdown-files";

export class ObsidianPeriodicNoteFilePort implements PeriodicNoteFilePort {
  constructor(
    private readonly vault: Vault,
    private readonly fileManager: FileManager,
  ) {}

  exists(path: string): boolean {
    return isMarkdownFile(this.vault.getAbstractFileByPath(path));
  }

  async createEmpty(path: string): Promise<void> {
    await ensureParentFolders(this.vault, path);
    await this.vault.create(path, "");
  }

  async delete(path: string): Promise<void> {
    const file = this.vault.getAbstractFileByPath(path);
    if (isMarkdownFile(file)) await this.fileManager.trashFile(file);
  }
}

export class ObsidianIntervalNoteFilePort implements IntervalNoteFilePort {
  constructor(private readonly vault: Vault) {}

  exists(path: string): boolean {
    return isMarkdownFile(this.vault.getAbstractFileByPath(path));
  }

  async create(path: string, content: string): Promise<void> {
    await ensureParentFolders(this.vault, path);
    await this.vault.create(path, content);
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
    if (vault.getAbstractFileByPath(current) === null) await vault.createFolder(current);
  }
}
