import type { Translator } from "../../shared/i18n";

export interface DateModalMessages {
  readonly chooseDate: string;
  readonly previousYear: string;
  readonly previousMonth: string;
  readonly nextMonth: string;
  readonly nextYear: string;
  readonly today: string;
  readonly jumpToDate: string;
  readonly date: string;
  readonly formats: string;
  readonly cancel: string;
  readonly jump: string;
  readonly invalidDate: string;
}

export function getDateModalMessages(t: Translator["t"]): DateModalMessages {
  return Object.freeze({
    chooseDate: t("calendar.chooseDate"),
    previousYear: t("calendar.previous", { period: t("calendar.period.year") }),
    previousMonth: t("calendar.previous", { period: t("calendar.period.month") }),
    nextMonth: t("calendar.next", { period: t("calendar.period.month") }),
    nextYear: t("calendar.next", { period: t("calendar.period.year") }),
    today: t("calendar.today"),
    jumpToDate: t("dateModal.jumpToDate"),
    date: t("dateModal.date"),
    formats: t("dateModal.formats"),
    cancel: t("dateModal.cancel"),
    jump: t("dateModal.jump"),
    invalidDate: t("dateModal.invalidDate"),
  });
}
