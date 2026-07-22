import {
  buildIntervalNoteContent,
  buildIntervalNoteSpec,
  normalizeIntervalNoteFolder,
  type IntervalNoteSpec,
} from "../../core/note/interval-note-spec";
import type { LocalDate } from "../../core/periodic/periodic-date";
import type {
  NoteOpenTarget,
  PeriodicNoteWorkspacePort,
} from "../periodic/periodic-note-commands";

export interface IntervalNoteFilePort {
  exists(path: string): boolean;
  create(path: string, content: string): Promise<void>;
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

/** Command-side range-note workflow. NoteIndex advances only through Vault events. */
export class IntervalNoteCommands {
  private readonly creationsByPath = new Map<string, Promise<void>>();

  constructor(
    private readonly files: IntervalNoteFilePort,
    private readonly workspace: PeriodicNoteWorkspacePort,
  ) {}

  async openOrCreate(
    request: OpenOrCreateIntervalNoteRequest,
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
    const created = await this.createOnce(spec);
    await this.workspace.open(spec.path, target);
    return Object.freeze({ status: "opened", path: spec.path, created });
  }

  private async createOnce(spec: IntervalNoteSpec): Promise<boolean> {
    const existing = this.creationsByPath.get(spec.path);
    if (existing !== undefined) {
      await existing;
      return false;
    }
    if (this.files.exists(spec.path)) return false;

    const creation = Promise.resolve().then(() =>
      this.files.create(spec.path, buildIntervalNoteContent(spec)));
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
}
