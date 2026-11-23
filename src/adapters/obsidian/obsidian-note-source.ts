import type { EventRef, TAbstractFile, TFile, TFolder, Vault } from "obsidian";

import type {
  NoteSource,
  NoteSourceFile,
  NoteSourceListener,
} from "../../core/note/note-source";

export class ObsidianNoteSource implements NoteSource {
  constructor(private readonly vault: Vault) {}

  listPaths(): readonly string[] {
    return this.vault.getMarkdownFiles().map((file) => file.path);
  }

  listFiles(): readonly NoteSourceFile[] {
    return this.vault.getMarkdownFiles().map(fileMetadata);
  }

  getFileMetadata(path: string): NoteSourceFile | null {
    const file = this.vault.getAbstractFileByPath(path);
    return isMarkdownFile(file) ? fileMetadata(file) : null;
  }

  async read(path: string): Promise<string> {
    const file = this.vault.getAbstractFileByPath(path);
    if (!isMarkdownFile(file)) {
      throw new Error(`Markdown note not found: ${path}`);
    }
    return this.vault.cachedRead(file);
  }

  subscribe(listener: NoteSourceListener): () => void {
    const refs: EventRef[] = [
      this.vault.on("create", (file) => {
        if (isFolder(file)) listener({ type: "folder", removedFolder: null, paths: folderNotePaths(file) });
        else if (isMarkdownFile(file)) listener({ type: "create", path: file.path });
      }),
      this.vault.on("modify", (file) => {
        if (isMarkdownFile(file)) listener({ type: "modify", path: file.path });
      }),
      this.vault.on("rename", (file, oldPath) => {
        if (isFolder(file)) {
          listener({ type: "folder", removedFolder: oldPath, paths: folderNotePaths(file) });
          return;
        }
        const wasMarkdown = hasMarkdownExtension(oldPath);
        const isMarkdown = isMarkdownFile(file);
        if (wasMarkdown && isMarkdown) {
          listener({ type: "rename", oldPath, path: file.path });
        } else if (wasMarkdown) {
          listener({ type: "delete", path: oldPath });
        } else if (isMarkdown) {
          listener({ type: "create", path: file.path });
        }
      }),
      this.vault.on("delete", (file) => {
        if (isFolder(file)) listener({ type: "folder", removedFolder: file.path, paths: [] });
        else if (isMarkdownFile(file)) listener({ type: "delete", path: file.path });
      }),
    ];

    return () => {
      for (const ref of refs) this.vault.offref(ref);
    };
  }
}

function isFolder(file: TAbstractFile): file is TFolder {
  return "children" in file && Array.isArray(file.children);
}

// A parent move may arrive before every child path has been updated by the
// adapter. Build the destination from the reported parent and child names.
function folderNotePaths(folder: TFolder): string[] {
  const paths: string[] = [];
  const pending = [{ folder, path: folder.path }];
  while (pending.length > 0) {
    const parent = pending.pop()!;
    const prefix = parent.path === "/" || parent.path === "" ? "" : parent.path + "/";
    for (const child of parent.folder.children) {
      const path = prefix + child.name;
      if (isFolder(child)) pending.push({ folder: child, path });
      else if (isMarkdownFile(child)) paths.push(path);
    }
  }
  return paths;
}

function fileMetadata(file: TFile): NoteSourceFile {
  return Object.freeze({ path: file.path, mtime: file.stat?.mtime ?? 0, size: file.stat?.size ?? 0 });
}

function isMarkdownFile(file: TAbstractFile | null): file is TFile {
  return (
    file !== null &&
    "extension" in file &&
    typeof file.extension === "string" &&
    file.extension.toLowerCase() === "md"
  );
}

function hasMarkdownExtension(path: string): boolean {
  return path.toLowerCase().endsWith(".md");
}
