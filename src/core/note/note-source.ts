export type NoteSourceEvent =
  | Readonly<{ type: "create" | "modify" | "delete"; path: string }>
  | Readonly<{ type: "rename"; oldPath: string; path: string }>;

export type NoteSourceListener = (event: NoteSourceEvent) => void;

/**
 * Read-only boundary used by the note query side.
 *
 * Implementations own external file-system details. Consumers only receive
 * vault-relative Markdown paths, complete UTF-8 text, and normalized events.
 */
export interface NoteSource {
  listPaths(): readonly string[];
  read(path: string): Promise<string>;
  subscribe(listener: NoteSourceListener): () => void;
}
