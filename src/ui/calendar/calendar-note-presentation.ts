import type { IndexedPeriodicNoteState } from "../../features/calendar/indexed-periodic-note";
import type { Translator } from "../../shared/i18n";

export function formatCalendarNoteState(
  state: IndexedPeriodicNoteState,
  errorMessage: string | undefined,
  t: Translator["t"],
): string {
  switch (state) {
    case "empty":
      return t("calendar.noteState.empty");
    case "yaml-only":
      return t("calendar.noteState.yamlOnly");
    case "has-body":
      return t("calendar.noteState.hasBody");
    case "error":
      return errorMessage === undefined
        ? t("calendar.noteState.error")
        : t("calendar.noteState.errorDetail", { error: errorMessage });
    case "missing":
      return t("calendar.noteState.missing");
    case "not-configured":
      return t("calendar.noteState.notConfigured");
  }
}
