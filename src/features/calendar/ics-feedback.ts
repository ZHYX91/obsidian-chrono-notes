import type { Translator } from "../../shared/i18n";
import type { IcsEventIndexSnapshot } from "./ics-event-index";

/** Shared user-facing explanation for the notification and persistent settings status. */
export function formatIcsLimitNotice(
  snapshot: IcsEventIndexSnapshot,
  t: Translator["t"],
): string | null {
  return snapshot.occurrenceLimit === undefined ? null : t("ics.occurrenceLimit", {
    limit: snapshot.occurrenceLimit,
    count: snapshot.truncatedEvents,
  });
}
