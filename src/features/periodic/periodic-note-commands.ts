import {
  PERIODIC_NOTE_TYPES,
  getPeriodAnchor,
  getPeriodRange,
  type LocalDate,
  type PeriodicNoteType,
  type WeekStartDay,
} from "../../core/periodic/periodic-date";
import { formatPeriodicNotePath } from "../../core/periodic/periodic-note-path";
import {
  getOperationErrorDetails,
  type OperationErrorDetails,
} from "../../shared/operation-error";
import type { PeriodicNoteSettings, TemplateEngine } from "../../shared/settings";
import {
  runPreparedNoteCreation,
  type NoteTemplatePort,
  type PeriodicNoteTemplateContext,
} from "../templates/note-template-port";
import type { CreatedNoteFilePort } from "../templates/created-note-file-port";
import { assertNoteCreationActive } from "../notes/note-creation-lifecycle";

export type NoteOpenTarget = "default" | "tab";

export type PeriodicNoteFilePort = CreatedNoteFilePort;

export interface PeriodicNoteWorkspacePort {
  open(path: string, target: NoteOpenTarget): Promise<void>;
}

export interface PeriodicNoteCommandSettings {
  readonly locale: string;
  readonly weekStartDay: WeekStartDay;
  readonly periodicNotes: Readonly<Record<PeriodicNoteType, PeriodicNoteSettings>>;
  readonly templateEngine: TemplateEngine;
}

export interface OpenOrCreatePeriodicNoteRequest {
  readonly date: LocalDate;
  readonly noteType: PeriodicNoteType;
  readonly target?: NoteOpenTarget;
  readonly cascade?: boolean;
  readonly confirmCreate?: (context: PeriodicNoteCreateConfirmation) => Promise<boolean>;
}

interface PeriodicNoteCreateConfirmation {
  readonly date: LocalDate;
  readonly noteType: PeriodicNoteType;
  readonly path: string;
  readonly cascade: readonly PeriodicNoteCreationTarget[];
}

export interface PeriodicNoteCreationTarget {
  readonly noteType: PeriodicNoteType;
  readonly path: string;
  readonly exists: boolean;
}

interface CascadeFailure {
  readonly name: string;
  readonly message: string;
  readonly details?: OperationErrorDetails;
}

export type CascadeResult =
  | Readonly<{ noteType: PeriodicNoteType; path: string; status: "created" | "existing" }>
  | Readonly<{
      noteType: PeriodicNoteType;
      path: string;
      status: "failed";
      error: CascadeFailure;
    }>;

export type OpenOrCreatePeriodicNoteResult =
  | Readonly<{ status: "not-configured"; noteType: PeriodicNoteType }>
  | Readonly<{ status: "cancelled"; noteType: PeriodicNoteType; path: string }>
  | Readonly<{
      status: "opened";
      path: string;
      created: boolean;
      cascade: readonly CascadeResult[];
    }>;

export class PeriodicNoteCreationError extends Error {
  override readonly name = "PeriodicNoteCreationError";

  constructor(
    readonly noteType: PeriodicNoteType,
    readonly path: string,
    override readonly cause: unknown,
    readonly retainedCreatedNote = false,
  ) {
    super(`Failed to create ${noteType} note at ${path}: ${getErrorMessage(cause)}`, {
      cause,
    });
  }
}

/** Command-side periodic note workflow. Query state changes only through Vault events. */
export class PeriodicNoteCommands {
  private readonly creationsByPath = new Map<string, Promise<void>>();

  constructor(
    private readonly files: PeriodicNoteFilePort,
    private readonly templates: NoteTemplatePort,
    private readonly workspace: PeriodicNoteWorkspacePort,
    private readonly signal?: AbortSignal,
  ) {}

  async openOrCreate(
    request: OpenOrCreatePeriodicNoteRequest,
    settings: PeriodicNoteCommandSettings,
  ): Promise<OpenOrCreatePeriodicNoteResult> {
    assertNoteCreationActive(this.signal);
    const snapshot = snapshotSettings(settings);
    const date = Object.freeze({ ...request.date });
    const noteType = request.noteType;
    const path = resolvePath(date, noteType, snapshot);
    if (path === null) {
      return Object.freeze({ status: "not-configured", noteType });
    }

    const target = request.target ?? "default";
    const pendingCreation = this.creationsByPath.get(path);
    if (pendingCreation === undefined && this.files.exists(path)) {
      await this.workspace.open(path, target);
      assertNoteCreationActive(this.signal);
      return Object.freeze({ status: "opened", path, created: false, cascade: [] });
    }

    // Resolve every authorized path and template before the first await. Runtime
    // settings can change while confirmation, rendering or workspace.open waits.
    const primary = createTemplateContext(date, noteType, path, snapshot);
    const cascadePlan = request.cascade ? this.largerNotePlan(date, noteType, snapshot) : [];
    if (pendingCreation !== undefined) {
      await pendingCreation;
      assertNoteCreationActive(this.signal);
      await this.workspace.open(path, target);
      assertNoteCreationActive(this.signal);
      const cascade = await this.createLargerNotes(cascadePlan);
      return Object.freeze({
        status: "opened",
        path,
        created: false,
        cascade: Object.freeze(cascade),
      });
    }
    if (request.confirmCreate !== undefined) {
      const confirmed = await request.confirmCreate(
        Object.freeze({
          date: primary.date,
          noteType,
          path,
          cascade: Object.freeze(cascadePlan.map((context) => Object.freeze({
            noteType: context.noteType,
            path: context.path,
            exists: this.files.exists(context.path),
          }))),
        }),
      );
      assertNoteCreationActive(this.signal);
      if (!confirmed) {
        return Object.freeze({ status: "cancelled", noteType, path });
      }
    }

    const created = await this.createPopulatedOnce(primary);
    assertNoteCreationActive(this.signal);
    await this.workspace.open(path, target);
    assertNoteCreationActive(this.signal);
    const cascade = await this.createLargerNotes(cascadePlan);
    return Object.freeze({
      status: "opened",
      path,
      created,
      cascade: Object.freeze(cascade),
    });
  }

  private async createLargerNotes(
    plan: readonly PeriodicNoteTemplateContext[],
  ): Promise<CascadeResult[]> {
    const results: CascadeResult[] = [];
    for (const context of plan) {
      const { noteType, path } = context;
      assertNoteCreationActive(this.signal);
      try {
        const created = await this.createPopulatedOnce(context);
        assertNoteCreationActive(this.signal);
        results.push(Object.freeze({
          noteType,
          path,
          status: created ? "created" : "existing",
        }));
      } catch (error) {
        if (this.signal?.aborted) throw error;
        const cause = error instanceof PeriodicNoteCreationError ? error.cause : error;
        const details = getOperationErrorDetails(error);
        results.push(Object.freeze({
          noteType,
          path,
          status: "failed",
          error: Object.freeze({
            name: cause instanceof Error ? cause.name : "Error",
            message: getErrorMessage(cause),
            ...(details === undefined ? {} : { details }),
          }),
        }));
      }
    }
    return results;
  }

  private largerNotePlan(
    date: LocalDate,
    triggerType: PeriodicNoteType,
    settings: PeriodicNoteCommandSettings,
  ): readonly PeriodicNoteTemplateContext[] {
    const result: PeriodicNoteTemplateContext[] = [];
    for (const noteType of PERIODIC_NOTE_TYPES.slice(PERIODIC_NOTE_TYPES.indexOf(triggerType) + 1)) {
      const path = resolvePath(date, noteType, settings);
      if (path !== null) result.push(createTemplateContext(date, noteType, path, settings));
    }
    return Object.freeze(result);
  }

  private async createPopulatedOnce(
    context: PeriodicNoteTemplateContext,
  ): Promise<boolean> {
    const { path } = context;
    assertNoteCreationActive(this.signal);
    const existing = this.creationsByPath.get(path);
    if (existing !== undefined) {
      await existing;
      assertNoteCreationActive(this.signal);
      return false;
    }
    if (this.files.exists(path)) return false;

    const creation = Promise.resolve().then(() =>
      this.createPopulatedNote(context));
    this.creationsByPath.set(path, creation);
    try {
      await creation;
      return true;
    } finally {
      if (this.creationsByPath.get(path) === creation) {
        this.creationsByPath.delete(path);
      }
    }
  }

  private async createPopulatedNote(
    context: PeriodicNoteTemplateContext,
  ): Promise<void> {
    const { noteType, path } = context;
    let retainedCreatedNote = false;
    try {
      assertNoteCreationActive(this.signal);
      const prepared = await this.templates.prepare(context, "");
      await runPreparedNoteCreation(prepared, async () => {
        assertNoteCreationActive(this.signal);
        const created = await this.files.create(path, prepared.initialContent);
        retainedCreatedNote = true;
        assertNoteCreationActive(this.signal);
        if (prepared.renderAfterCreate !== undefined) {
          const rendered = await prepared.renderAfterCreate(path);
          assertNoteCreationActive(this.signal);
          await this.files.finalize(created, rendered);
          assertNoteCreationActive(this.signal);
        }
      });
    } catch (cause) {
      throw new PeriodicNoteCreationError(
        noteType,
        path,
        cause,
        retainedCreatedNote,
      );
    }
  }
}

function snapshotSettings(settings: PeriodicNoteCommandSettings): PeriodicNoteCommandSettings {
  return Object.freeze({
    locale: settings.locale,
    weekStartDay: settings.weekStartDay,
    templateEngine: settings.templateEngine,
    periodicNotes: Object.freeze(Object.fromEntries(PERIODIC_NOTE_TYPES.map((noteType) => [
      noteType, Object.freeze({ ...settings.periodicNotes[noteType] }),
    ])) as Record<PeriodicNoteType, PeriodicNoteSettings>),
  });
}

function createTemplateContext(
  selectedDate: LocalDate,
  noteType: PeriodicNoteType,
  path: string,
  settings: PeriodicNoteCommandSettings,
): PeriodicNoteTemplateContext {
  return Object.freeze({
    kind: "periodic",
    range: getPeriodRange(selectedDate, noteType, settings.weekStartDay),
    date: getPeriodAnchor(selectedDate, noteType, settings.weekStartDay),
    locale: settings.locale,
    noteType,
    path,
    templatePath: settings.periodicNotes[noteType].templatePath,
    templateEngine: settings.templateEngine,
    title: getNoteTitle(path),
  });
}

function resolvePath(
  date: LocalDate,
  noteType: PeriodicNoteType,
  settings: PeriodicNoteCommandSettings,
): string | null {
  const config = settings.periodicNotes[noteType];
  if (!config.enabled || config.pattern.trim().length === 0) return null;
  return formatPeriodicNotePath(
    date,
    { noteType, pattern: config.pattern, pathLocale: config.pathLocale },
    { locale: settings.locale, weekStartDay: settings.weekStartDay },
  );
}

function getNoteTitle(path: string): string {
  return path.slice(0, -3).split("/").at(-1) ?? "";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
