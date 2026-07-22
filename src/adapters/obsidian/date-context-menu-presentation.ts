import type { DateContextMenuActionId } from "../../features/calendar/date-context-menu";
import type { Translator } from "../../shared/i18n";

export function getDateContextMenuActionLabel(
  actionId: DateContextMenuActionId,
  noteExists: boolean,
  t: Translator["t"],
): string {
  switch (actionId) {
    case "open-default":
      return noteExists
        ? t("dateContextMenu.openNote")
        : t("dateContextMenu.createNote");
    case "open-tab":
      return t("dateContextMenu.openNewTab");
    case "create-range":
      return t("dateContextMenu.createRange");
    case "copy-date":
      return t("dateContextMenu.copyDate");
  }
}

export function formatCopiedDateNotice(
  date: string,
  t: Translator["t"],
): string {
  return t("dateContextMenu.copiedDate", { date });
}

export function getCopyDateFailedNotice(t: Translator["t"]): string {
  return t("dateContextMenu.copyFailed");
}
