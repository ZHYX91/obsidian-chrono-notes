import type { LocalDate, PeriodicNoteType } from "../../core/periodic/periodic-date";
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

export interface NoteTemplatePort {
  populate(path: string, context: NoteTemplateContext): Promise<void>;
}
