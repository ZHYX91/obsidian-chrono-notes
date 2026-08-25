import {
  applyIntervalNoteMetadata,
  buildIntervalNoteContent,
  buildIntervalNoteSpec,
  normalizeIntervalNoteFolder,
  type IntervalNoteSpec,
} from "../../core/note/interval-note-spec";
import type { LocalDate } from "../../core/periodic/periodic-date";
import type { TemplateEngine } from "../../shared/settings";
import type {
  NoteOpenTarget,
  PeriodicNoteWorkspacePort,
} from "../periodic/periodic-note-commands";
import type {
  IntervalNoteTemplateContext,
  NoteTemplatePort,
} from "../templates/note-template-port";
import type { CreatedNoteFilePort } from "../templates/created-note-file-port";

export type IntervalNoteFilePort = CreatedNoteFilePort;

export interface IntervalNoteCommandSettings {
  readonly locale: string;
  readonly templateEngine: TemplateEngine;
  readonly templatePath: string;
}

export interface OpenOrCreateIntervalNoteRequest {
  readonly start: LocalDate;
  readonly end: LocalDate;
  readonly folder: string;
  readonly target?: NoteOpenTarget;
  readonly confirmCreate?: (spec: IntervalNoteSpec) => Promise<boolean>;
}

export type OpenOrCreateIntervalNoteResult =
  | Readonly<{ status: "not-configured" }>
  | Readonly<{ status: "invalid-range" }>
  | Readonly<{ status: "cancelled"; path: string }>
  | Readonly<{ status: "opened"; path: string; created: boolean }>;

class IntervalNoteCreationError extends Error {
  override readonly name = "IntervalNoteCreationError";

  constructor(
    readonly path: string,
    override readonly cause: unknown,
    readonly retainedCreatedNote = false,
  ) {
    super(`Failed to create range note at ${path}: ${toErrorMessage(cause)}`, {
      cause,
    });
  }
}

/** Command-side range-note workflow. NoteIndex advances only through Vault events. */
export class IntervalNoteCommands {
  private readonly creationsByPath = new Map<string, Promise<void>>();

  constructor(
    private readonly files: IntervalNoteFilePort,
    private readonly templates: NoteTemplatePort,
    private readonly workspace: PeriodicNoteWorkspacePort,
  ) {}

  async openOrCreate(
    request: OpenOrCreateIntervalNoteRequest,
    settings: IntervalNoteCommandSettings,
  ): Promise<OpenOrCreateIntervalNoteResult> {
    if (normalizeIntervalNoteFolder(request.folder).length === 0) {
      return Object.freeze({ status: "not-configured" });
    }
    const spec = buildIntervalNoteSpec(request.start, request.end, request.folder);
    if (spec.dayCount < 2) return Object.freeze({ status: "invalid-range" });
    const target = request.target ?? "default";
    const pendingCreation = this.creationsByPath.get(spec.path);
    if (pendingCreation !== undefined) {
      await pendingCreation;
      await this.workspace.open(spec.path, target);
      return Object.freeze({ status: "opened", path: spec.path, created: false });
    }
    if (this.files.exists(spec.path)) {
      await this.workspace.open(spec.path, target);
      return Object.freeze({ status: "opened", path: spec.path, created: false });
    }
    if (request.confirmCreate !== undefined && !await request.confirmCreate(spec)) {
      return Object.freeze({ status: "cancelled", path: spec.path });
    }
    const created = await this.createOnce(spec, settings);
    await this.workspace.open(spec.path, target);
    return Object.freeze({ status: "opened", path: spec.path, created });
  }

  private async createOnce(
    spec: IntervalNoteSpec,
    settings: IntervalNoteCommandSettings,
  ): Promise<boolean> {
    const existing = this.creationsByPath.get(spec.path);
    if (existing !== undefined) {
      await existing;
      return false;
    }
    if (this.files.exists(spec.path)) return false;

    const creation = Promise.resolve().then(() => this.createPopulatedNote(spec, settings));
    this.creationsByPath.set(spec.path, creation);
    try {
      await creation;
      return true;
    } finally {
      if (this.creationsByPath.get(spec.path) === creation) {
        this.creationsByPath.delete(spec.path);
      }
    }
  }

  private async createPopulatedNote(
    spec: IntervalNoteSpec,
    settings: IntervalNoteCommandSettings,
  ): Promise<void> {
    let retainedCreatedNote = false;
    try {
      const context: IntervalNoteTemplateContext = Object.freeze({
        kind: "interval",
        start: spec.start,
        end: spec.end,
        dayCount: spec.dayCount,
        locale: settings.locale,
        path: spec.path,
        templatePath: settings.templatePath,
        templateEngine: settings.templateEngine,
        title: spec.title,
      });
      const prepared = await this.templates.prepare(
        context,
        buildIntervalNoteContent(spec),
      );
      const created = await this.files.create(
        spec.path,
        applyIntervalNoteMetadata(prepared.initialContent, spec),
      );
      retainedCreatedNote = true;
      if (prepared.renderAfterCreate !== undefined) {
        const rendered = await prepared.renderAfterCreate(spec.path);
        await this.files.finalize(
          created,
          applyIntervalNoteMetadata(rendered, spec),
        );
      }
    } catch (cause) {
      throw new IntervalNoteCreationError(spec.path, cause, retainedCreatedNote);
    }
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
