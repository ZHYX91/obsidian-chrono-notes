import type { ObservanceGroup } from "./observance-groups";
import type { LocalDate } from "../periodic/periodic-date";

export type CalendarExtensionId =
  | "chinese-lunar"
  | "julian"
  | "coptic"
  | "ganzhi"
  | "persian"
  | "ethiopic"
  | "hebrew"
  | "indian"
  | "islamic-civil"
  | "islamic-umalqura";
export type CalendarExtensionEventKind = "festival" | "solar-term";
export type CalendarExtensionTransition = "month" | "year-month";

export interface CalendarExtensionEventSource {
  readonly id: CalendarExtensionId | ObservanceGroup;
  readonly transitionTime: string | null;
}

export interface CalendarExtensionEvent {
  readonly id: string;
  readonly kind: CalendarExtensionEventKind;
  readonly text: string;
  readonly sources: readonly CalendarExtensionEventSource[];
}

export interface CalendarExtensionResult {
  readonly dateText: string;
  readonly events: readonly CalendarExtensionEvent[];
  readonly transition: CalendarExtensionTransition | null;
  readonly accessibilityText: string;
}

export interface CalendarExtensionDay extends CalendarExtensionResult {
  readonly id: CalendarExtensionId;
}

export interface CalendarExtensionProvider {
  readonly id: CalendarExtensionId;
  getDay(date: LocalDate, locale: string): CalendarExtensionResult;
}

export function createCalendarExtensionEvent(
  id: string,
  kind: CalendarExtensionEventKind,
  text: string,
  sourceId: CalendarExtensionId | ObservanceGroup,
  transitionTime: string | null = null,
): CalendarExtensionEvent {
  return Object.freeze({
    id,
    kind,
    text,
    sources: Object.freeze([
      Object.freeze({
        id: sourceId,
        transitionTime,
      }),
    ]),
  });
}
