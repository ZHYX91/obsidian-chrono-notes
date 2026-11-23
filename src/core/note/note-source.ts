export type NoteSourceEvent =
  | Readonly<{ type: "create" | "modify" | "delete"; path: string }>
  | Readonly<{ type: "delete-folder"; path: string }>
  | Readonly<{ type: "rename"; oldPath: string; path: string }>;

export type NoteSourceListener = (event: NoteSourceEvent) => void;

export interface NoteSourceFile {
  readonly path: string;
  readonly mtime: number;
  readonly size: number;
}

/**
 * Read-only boundary used by the note query side.
 *
 * Implementations own external file-system details. Consumers only receive
 * vault-relative paths, complete Markdown text, and normalized file or subtree events.
 */
export interface NoteSource {
  listPaths(): readonly string[];
  /** Optional fast metadata inventory used by the persistent startup cache. */
  listFiles?(): readonly NoteSourceFile[];
  /** Current metadata for one path, without enumerating the Vault. */
  getFileMetadata?(path: string): NoteSourceFile | null;
  read(path: string): Promise<string>;
  subscribe(listener: NoteSourceListener): () => void;
}
