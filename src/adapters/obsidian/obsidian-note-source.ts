import type { EventRef, TAbstractFile, TFile, Vault } from "obsidian";

import type {
  NoteSource,
  NoteSourceListener,
} from "../../core/note/note-source";

export class ObsidianNoteSource implements NoteSource {
  constructor(private readonly vault: Vault) {}

  listPaths(): readonly string[] {
    return this.vault.getMarkdownFiles().map((file) => file.path);
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
        if (isMarkdownFile(file)) listener({ type: "create", path: file.path });
      }),
      this.vault.on("modify", (file) => {
        if (isMarkdownFile(file)) listener({ type: "modify", path: file.path });
      }),
      this.vault.on("rename", (file, oldPath) => {
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
        if (isMarkdownFile(file)) listener({ type: "delete", path: file.path });
      }),
    ];

    return () => {
      for (const ref of refs) this.vault.offref(ref);
    };
  }
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
