import type { LocalDate, PeriodicNoteType, PeriodRange } from "../../core/periodic/periodic-date";
import type { TemplateEngine } from "../../shared/settings";

interface BaseNoteTemplateContext {
  readonly locale: string;
  readonly path: string;
  readonly templatePath: string;
  readonly templateEngine: TemplateEngine;
  readonly title: string;
}

export interface PeriodicNoteTemplateContext extends BaseNoteTemplateContext {
  readonly kind: "periodic";
  readonly date: LocalDate;
  readonly noteType: PeriodicNoteType;
  readonly range: PeriodRange;
}

export interface IntervalNoteTemplateContext extends BaseNoteTemplateContext {
  readonly kind: "interval";
  readonly start: LocalDate;
  readonly end: LocalDate;
  readonly dayCount: number;
}

export type NoteTemplateContext =
  | PeriodicNoteTemplateContext
  | IntervalNoteTemplateContext;

export interface PreparedNoteTemplate {
  readonly initialContent: string;
  readonly renderAfterCreate?: (path: string) => Promise<string>;
  /** Own external template resources until creation and final write both settle. */
  readonly runCreation?: (createAndFinalize: () => Promise<void>) => Promise<void>;
}

export function runPreparedNoteCreation(
  prepared: PreparedNoteTemplate,
  createAndFinalize: () => Promise<void>,
): Promise<void> {
  return prepared.runCreation === undefined
    ? createAndFinalize()
    : prepared.runCreation(createAndFinalize);
}

export interface NoteTemplatePort {
  prepare(
    context: NoteTemplateContext,
    defaultContent: string,
  ): Promise<PreparedNoteTemplate>;
}
