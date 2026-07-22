import {
  PERIODIC_NOTE_TYPES,
  getPeriodAnchor,
  type LocalDate,
  type PeriodicNoteType,
  type WeekStartDay,
} from "../../core/periodic/periodic-date";
import { formatPeriodicNotePath } from "../../core/periodic/periodic-note-path";
import type { PeriodicNoteSettings, TemplateEngine } from "../../shared/settings";

export type NoteOpenTarget = "default" | "tab";

export interface PeriodicNoteFilePort {
  exists(path: string): boolean;
  createEmpty(path: string): Promise<void>;
  delete(path: string): Promise<void>;
}

export interface PeriodicNoteTemplateContext {
  readonly date: LocalDate;
  readonly noteType: PeriodicNoteType;
  readonly path: string;
  readonly templatePath: string;
  readonly templateEngine: TemplateEngine;
  readonly title: string;
}

export interface PeriodicNoteTemplatePort {
  populate(path: string, context: PeriodicNoteTemplateContext): Promise<void>;
}

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

export interface PeriodicNoteCreateConfirmation {
  readonly date: LocalDate;
  readonly noteType: PeriodicNoteType;
  readonly path: string;
}

export interface CascadeFailure {
  readonly name: string;
  readonly message: string;
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
    readonly rollbackCause?: unknown,
  ) {
    super(`Failed to create ${noteType} note at ${path}: ${toFailure(cause).message}`, {
      cause,
    });
  }
}

/** Command-side periodic note workflow. Query state changes only through Vault events. */
export class PeriodicNoteCommands {
  private readonly creationsByPath = new Map<string, Promise<void>>();

  constructor(
    private readonly files: PeriodicNoteFilePort,
    private readonly templates: PeriodicNoteTemplatePort,
    private readonly workspace: PeriodicNoteWorkspacePort,
  ) {}

  async openOrCreate(
    request: OpenOrCreatePeriodicNoteRequest,
    settings: PeriodicNoteCommandSettings,
  ): Promise<OpenOrCreatePeriodicNoteResult> {
    const path = resolvePath(request.date, request.noteType, settings);
    if (path === null) {
      return Object.freeze({ status: "not-configured", noteType: request.noteType });
    }

    const target = request.target ?? "default";
    const pendingCreation = this.creationsByPath.get(path);
    if (pendingCreation !== undefined) {
      await pendingCreation;
      await this.workspace.open(path, target);
      const cascade = request.cascade
        ? await this.createLargerNotes(request.date, request.noteType, settings)
        : [];
      return Object.freeze({
        status: "opened",
        path,
        created: false,
        cascade: Object.freeze(cascade),
      });
    }
    if (this.files.exists(path)) {
      await this.workspace.open(path, target);
      return Object.freeze({ status: "opened", path, created: false, cascade: [] });
    }

    if (request.confirmCreate !== undefined) {
      const confirmed = await request.confirmCreate(
        Object.freeze({
          date: getPeriodAnchor(request.date, request.noteType, settings.weekStartDay),
          noteType: request.noteType,
          path,
        }),
      );
      if (!confirmed) {
        return Object.freeze({ status: "cancelled", noteType: request.noteType, path });
      }
    }

    const created = await this.createPopulatedOnce(
      request.date,
      request.noteType,
      path,
      settings,
    );
    await this.workspace.open(path, target);
    const cascade = request.cascade
      ? await this.createLargerNotes(request.date, request.noteType, settings)
      : [];
    return Object.freeze({
      status: "opened",
      path,
      created,
      cascade: Object.freeze(cascade),
    });
  }

  private async createLargerNotes(
    date: LocalDate,
    triggerType: PeriodicNoteType,
    settings: PeriodicNoteCommandSettings,
  ): Promise<CascadeResult[]> {
    const results: CascadeResult[] = [];
    const triggerIndex = PERIODIC_NOTE_TYPES.indexOf(triggerType);
    for (const noteType of PERIODIC_NOTE_TYPES.slice(triggerIndex + 1)) {
      const path = resolvePath(date, noteType, settings);
      if (path === null) continue;
      try {
        const created = await this.createPopulatedOnce(date, noteType, path, settings);
        results.push(Object.freeze({
          noteType,
          path,
          status: created ? "created" : "existing",
        }));
      } catch (error) {
        const cause = error instanceof PeriodicNoteCreationError ? error.cause : error;
        results.push(
          Object.freeze({
            noteType,
            path,
            status: "failed",
            error: toFailure(cause),
          }),
        );
      }
    }
    return results;
  }

  private async createPopulatedOnce(
    selectedDate: LocalDate,
    noteType: PeriodicNoteType,
    path: string,
    settings: PeriodicNoteCommandSettings,
  ): Promise<boolean> {
    const existing = this.creationsByPath.get(path);
    if (existing !== undefined) {
      await existing;
      return false;
    }
    if (this.files.exists(path)) return false;

    const creation = Promise.resolve().then(() =>
      this.createPopulatedNote(selectedDate, noteType, path, settings));
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
    selectedDate: LocalDate,
    noteType: PeriodicNoteType,
    path: string,
    settings: PeriodicNoteCommandSettings,
  ): Promise<void> {
    let created = false;
    try {
      await this.files.createEmpty(path);
      created = true;
      const config = settings.periodicNotes[noteType];
      const context: PeriodicNoteTemplateContext = Object.freeze({
        date: getPeriodAnchor(selectedDate, noteType, settings.weekStartDay),
        noteType,
        path,
        templatePath: config.templatePath,
        templateEngine: settings.templateEngine,
        title: getNoteTitle(path),
      });
      await this.templates.populate(path, context);
    } catch (cause) {
      let rollbackCause: unknown;
      if (created) {
        try {
          await this.files.delete(path);
        } catch (error) {
          rollbackCause = error;
        }
      }
      throw new PeriodicNoteCreationError(noteType, path, cause, rollbackCause);
    }
  }
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
    { noteType, pattern: config.pattern },
    { locale: settings.locale, weekStartDay: settings.weekStartDay },
  );
}

function getNoteTitle(path: string): string {
  return path.slice(0, -3).split("/").at(-1) ?? "";
}

function toFailure(error: unknown): CascadeFailure {
  if (error instanceof Error) {
    return Object.freeze({ name: error.name, message: error.message });
  }
  return Object.freeze({ name: "Error", message: String(error) });
}
