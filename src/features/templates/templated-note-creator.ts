import { assertNoteCreationActive } from "../notes/note-creation-lifecycle";
import type { CreatedNoteFilePort } from "./created-note-file-port";
import { runPreparedNoteCreation, type NoteTemplateContext, type NoteTemplatePort } from "./note-template-port";

/** Owns a path until preparation, creation and any template finalizer have settled. */
export class TemplatedNoteCreator {
  private readonly pendingByPath = new Map<string, Promise<boolean>>();

  constructor(
    private readonly files: CreatedNoteFilePort,
    private readonly templates: NoteTemplatePort,
    readonly signal?: AbortSignal,
  ) {}

  exists(path: string): boolean {
    return this.files.exists(path);
  }

  pending(path: string): Promise<boolean> | undefined {
    return this.pendingByPath.get(path);
  }

  create(
    context: NoteTemplateContext,
    defaultContent: string,
    creationError: (cause: unknown, retainedCreatedNote: boolean) => Error,
    prepareContent: (content: string) => string = (content) => content,
    canCreate?: () => boolean,
  ): Promise<boolean> {
    const { path } = context;
    const existing = this.pending(path);
    if (existing !== undefined) return existing.then(() => false);

    // Publish the promise before template code can re-enter a command.
    const creation = Promise.resolve().then(async () => {
      let retainedCreatedNote = false;
      try {
        assertNoteCreationActive(this.signal);
        const prepared = await this.templates.prepare(context, defaultContent);
        await runPreparedNoteCreation(prepared, async () => {
          assertNoteCreationActive(this.signal);
          if (canCreate !== undefined && !canCreate()) return;
          const content = prepareContent(prepared.initialContent);
          const created = canCreate === undefined ? await this.files.create(path, content)
            : await this.files.create(path, content, canCreate);
          if (created === null) return;
          retainedCreatedNote = true;
          assertNoteCreationActive(this.signal);
          if (prepared.renderAfterCreate === undefined) return;
          const rendered = await prepared.renderAfterCreate(path);
          assertNoteCreationActive(this.signal);
          await this.files.finalize(created, prepareContent(rendered));
          assertNoteCreationActive(this.signal);
        });
        return retainedCreatedNote;
      } catch (cause) {
        throw creationError(cause, retainedCreatedNote);
      } finally {
        this.pendingByPath.delete(path);
      }
    });
    this.pendingByPath.set(path, creation);
    return creation;
  }
}
