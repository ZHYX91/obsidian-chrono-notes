import { TemplatedNoteCreator } from "../templates/templated-note-creator";
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
import { assertNoteCreationActive } from "../notes/note-creation-lifecycle";

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
  private readonly creator: TemplatedNoteCreator;

  constructor(
    private readonly files: IntervalNoteFilePort,
    templates: NoteTemplatePort,
    private readonly workspace: PeriodicNoteWorkspacePort,
    private readonly signal?: AbortSignal,
  ) {
    this.creator = new TemplatedNoteCreator(files, templates, signal);
  }

  async openOrCreate(
    request: OpenOrCreateIntervalNoteRequest,
    settings: IntervalNoteCommandSettings,
  ): Promise<OpenOrCreateIntervalNoteResult> {
    assertNoteCreationActive(this.signal);
    if (normalizeIntervalNoteFolder(request.folder).length === 0) {
      return Object.freeze({ status: "not-configured" });
    }
    const spec = buildIntervalNoteSpec(request.start, request.end, request.folder);
    if (spec.dayCount < 2) return Object.freeze({ status: "invalid-range" });
    const target = request.target ?? "default";
    const pendingCreation = this.creator.pending(spec.path);
    if (pendingCreation !== undefined) {
      await pendingCreation;
      assertNoteCreationActive(this.signal);
      await this.workspace.open(spec.path, target);
      assertNoteCreationActive(this.signal);
      return Object.freeze({ status: "opened", path: spec.path, created: false });
    }
    if (this.files.exists(spec.path)) {
      await this.workspace.open(spec.path, target);
      assertNoteCreationActive(this.signal);
      return Object.freeze({ status: "opened", path: spec.path, created: false });
    }
    if (request.confirmCreate !== undefined) {
      const confirmed = await request.confirmCreate(spec);
      assertNoteCreationActive(this.signal);
      if (!confirmed) return Object.freeze({ status: "cancelled", path: spec.path });
    }
    const created = await this.createOnce(spec, settings);
    assertNoteCreationActive(this.signal);
    await this.workspace.open(spec.path, target);
    assertNoteCreationActive(this.signal);
    return Object.freeze({ status: "opened", path: spec.path, created });
  }

  private async createOnce(
    spec: IntervalNoteSpec,
    settings: IntervalNoteCommandSettings,
  ): Promise<boolean> {
    assertNoteCreationActive(this.signal);
    const existing = this.creator.pending(spec.path);
    if (existing !== undefined) {
      await existing;
      assertNoteCreationActive(this.signal);
      return false;
    }
    if (this.files.exists(spec.path)) return false;

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
    await this.creator.create(
      context,
      buildIntervalNoteContent(spec),
      (cause, retained) => new IntervalNoteCreationError(spec.path, cause, retained),
      (content) => applyIntervalNoteMetadata(content, spec),
    );
    return true;
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
