import type { Translator } from "../../shared/i18n";
import type { IcsEventIndexSnapshot } from "./ics-event-index";

/** Shared user-facing explanation for the notification and persistent settings status. */
export function formatIcsLimitNotice(
  snapshot: IcsEventIndexSnapshot,
  t: Translator["t"],
): string | null {
  const notices: string[] = [];
  if (snapshot.sourceLimit !== undefined) {
    notices.push(t("ics.sourceLimit", {
      limit: snapshot.sourceLimit,
      count: snapshot.totalSources - snapshot.sourceStatuses.length,
    }));
  }
  if (snapshot.occurrenceLimit !== undefined) {
    notices.push(t("ics.occurrenceLimit", {
      limit: snapshot.occurrenceLimit,
      count: snapshot.truncatedEvents,
    }));
  }
  return notices.length === 0 ? null : notices.join("\n");
}
