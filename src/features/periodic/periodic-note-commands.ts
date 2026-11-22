import { findMarkdownExtensionVariant } from "../../core/document/markdown-extension";
import type { TemplatedNoteCreator } from "../templates/templated-note-creator";
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
import type {
  PeriodicNoteTemplateContext,
} from "../templates/note-template-port";
import type { CreatedNoteFilePort } from "../templates/created-note-file-port";
import { assertNoteCreationActive } from "../notes/note-creation-lifecycle";

export type NoteOpenTarget = "default" | "tab";
export interface PeriodicLinkDestination {
  readonly requestedPath: string;
  open(path: string): Promise<void>;
}
export type PeriodicNoteDestination = NoteOpenTarget | PeriodicLinkDestination | ((path: string) => Promise<void>);

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
  readonly target?: PeriodicNoteDestination;
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

interface NoteCreationTarget {
  readonly context: PeriodicNoteTemplateContext;
  readonly createIfMissing: boolean;
  readonly existingAtConfirmation?: string;
  readonly pendingAtConfirmation?: Promise<boolean> | undefined;
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
  constructor(
    private readonly creator: TemplatedNoteCreator,
    private readonly workspace: PeriodicNoteWorkspacePort,
  ) {}

  async openOrCreate(
    request: OpenOrCreatePeriodicNoteRequest,
    settings: PeriodicNoteCommandSettings,
  ): Promise<OpenOrCreatePeriodicNoteResult> {
    assertNoteCreationActive(this.creator.signal);
    const snapshot = snapshotSettings(settings);
    const date = Object.freeze({ ...request.date });
    const noteType = request.noteType;
    const path = resolvePath(date, noteType, snapshot);
    if (path === null) {
      return Object.freeze({ status: "not-configured", noteType });
    }

    const target = request.target ?? "default";
    const open = typeof target === "object" ? (actual: string) => target.open(actual)
      : typeof target === "function" ? target : (actual: string) => this.workspace.open(actual, target);
    const preferredPath = typeof target === "object" && /\.md$/iu.test(target.requestedPath) &&
      target.requestedPath.slice(0, -3) === path.slice(0, -3) ? target.requestedPath : path;
    const existing = this.existingPath(preferredPath);
    const pendingCreation = this.creator.pending(existing ?? path);
    if (pendingCreation === undefined && existing !== undefined) {
      await open(existing);
      assertNoteCreationActive(this.creator.signal);
      return Object.freeze({ status: "opened", path: existing, created: false, cascade: [] });
    }

    // Resolve every authorized path and template before the first await. Runtime
    // settings can change while confirmation, rendering or workspace.open waits.
    const primary = createTemplateContext(date, noteType, path, snapshot);
    const cascadePlan = request.cascade ? this.largerNotePlan(date, noteType, snapshot) : [];
    if (pendingCreation !== undefined) {
      await pendingCreation;
      assertNoteCreationActive(this.creator.signal);
    }
    const cascadeTargets = cascadePlan.map((context): NoteCreationTarget => {
      const actual = this.existingPath(context.path);
      if (request.confirmCreate !== undefined && actual !== undefined) {
        // An existing path may still hold a template's initial content.
        return {
          context, existingAtConfirmation: actual, createIfMissing: false,
          pendingAtConfirmation: this.creator.pending(actual),
        };
      }
      return { context, createIfMissing: true };
    });
    if (request.confirmCreate !== undefined &&
        (pendingCreation === undefined || cascadeTargets.some((target) => target.createIfMissing))) {
      const confirmed = await request.confirmCreate(
        Object.freeze({
          date: primary.date,
          noteType,
          path,
          cascade: Object.freeze(cascadeTargets.map(({ context, existingAtConfirmation, createIfMissing }) => Object.freeze({
            noteType: context.noteType,
            path: existingAtConfirmation ?? context.path,
            exists: !createIfMissing,
          }))),
        }),
      );
      assertNoteCreationActive(this.creator.signal);
      if (!confirmed) {
        return Object.freeze({ status: "cancelled", noteType, path });
      }
    }

    const primaryStatus = await this.ensurePopulated({
      context: primary, createIfMissing: pendingCreation === undefined,
    }, preferredPath);
    assertNoteCreationActive(this.creator.signal);
    const actual = this.existingPath(preferredPath) ?? path;
    await open(actual);
    assertNoteCreationActive(this.creator.signal);
    const cascade = await this.createLargerNotes(cascadeTargets);
    return Object.freeze({
      status: "opened",
      path: actual,
      created: primaryStatus === "created" && actual === path,
      cascade: Object.freeze(cascade),
    });
  }

  private async createLargerNotes(
    plan: readonly NoteCreationTarget[],
  ): Promise<CascadeResult[]> {
    const results: CascadeResult[] = [];
    for (const target of plan) {
      const { noteType, path } = target.context;
      assertNoteCreationActive(this.creator.signal);
      try {
        const status = await this.ensurePopulated(target);
        assertNoteCreationActive(this.creator.signal);
        if (status !== "missing") {
          results.push(Object.freeze({ noteType, path: this.existingPath(path) ?? path, status }));
        }
      } catch (error) {
        if (this.creator.signal?.aborted) throw error;
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

  private async ensurePopulated(
    { context, createIfMissing, pendingAtConfirmation }: NoteCreationTarget,
    preferredPath = context.path,
  ): Promise<"created" | "existing" | "missing"> {
    const { path } = context;
    assertNoteCreationActive(this.creator.signal);
    let actual = this.existingPath(preferredPath);
    let pending = this.creator.pending(actual ?? path) ?? pendingAtConfirmation;
    const joined = pending !== undefined;
    while (pending !== undefined) {
      await pending;
      assertNoteCreationActive(this.creator.signal);
      actual = this.existingPath(preferredPath);
      pending = this.creator.pending(actual ?? path);
    }
    if (actual !== undefined) return "existing";
    if (!createIfMissing || joined) return "missing";

    const created = await this.creator.create(
      context,
      "",
      (cause, retained) => new PeriodicNoteCreationError(context.noteType, path, cause, retained),
      undefined,
      () => this.existingPath(path) === undefined,
    );
    return created ? "created" : "existing";
  }

  private existingPath(path: string): string | undefined {
    return findMarkdownExtensionVariant(path, (candidate) => this.creator.exists(candidate) ? candidate : undefined);
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
