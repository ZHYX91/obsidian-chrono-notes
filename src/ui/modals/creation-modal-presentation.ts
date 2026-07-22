import type { Translator } from "../../shared/i18n";

export interface CreationModalMessages {
  readonly createPeriodicTitle: string;
  readonly createRangeTitle: string;
  readonly confirmRangeTitle: string;
  readonly rangeInstructions: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly targetPath: string;
  readonly cancel: string;
  readonly continue: string;
  readonly create: string;
  readonly suppressFuturePeriodicConfirmation: string;
  readonly suppressFutureIntervalConfirmation: string;
  readonly invalidRange: string;
}

export function getCreationModalMessages(t: Translator["t"]): CreationModalMessages {
  return Object.freeze({
    createPeriodicTitle: t("creationModal.createPeriodicTitle"),
    createRangeTitle: t("creationModal.createRangeTitle"),
    confirmRangeTitle: t("creationModal.confirmRangeTitle"),
    rangeInstructions: t("creationModal.rangeInstructions"),
    startDate: t("creationModal.startDate"),
    endDate: t("creationModal.endDate"),
    targetPath: t("creationModal.targetPath"),
    cancel: t("creationModal.cancel"),
    continue: t("creationModal.continue"),
    create: t("creationModal.create"),
    suppressFuturePeriodicConfirmation:
      t("creationModal.suppressFuturePeriodicConfirmation"),
    suppressFutureIntervalConfirmation:
      t("creationModal.suppressFutureIntervalConfirmation"),
    invalidRange: t("creationModal.invalidRange"),
  });
}

export function formatIntervalSummary(
  title: string,
  dayCount: number,
  t: Translator["t"],
): string {
  return t("creationModal.intervalSummary", {
    title,
    count: dayCount,
  });
}
