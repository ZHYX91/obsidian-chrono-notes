export interface CreatedNoteReference {
  readonly identity: unknown;
  readonly initialContent: string;
  readonly path: string;
}

export interface CreatedNoteFilePort {
  exists(path: string): boolean;
  create(path: string, content: string): Promise<CreatedNoteReference>;
  create(path: string, content: string, canCreate: () => boolean): Promise<CreatedNoteReference | null>;
  finalize(reference: CreatedNoteReference, content: string): Promise<void>;
}
