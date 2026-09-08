import type { PeriodicNoteType } from "../../core/periodic/periodic-date";

export type CalendarSelectionKind = "day" | "week" | "month" | "quarter" | "year" | "decade" | "century";

export function getPeriodicSelectionKind(noteType: PeriodicNoteType): CalendarSelectionKind {
  const kinds = {
    daily: "day", weekly: "week", monthly: "month", quarterly: "quarter",
    yearly: "year", decadal: "decade", century: "century",
  } as const;
  return kinds[noteType];
}
