import type { Translator } from "../../shared/i18n";

export interface FirstUseGuideMessages {
  readonly title: string;
  readonly intro: string;
  readonly hints: readonly string[];
  readonly openSettings: string;
  readonly dismiss: string;
}

export function getFirstUseGuideMessages(
  t: Translator["t"],
  modifier: string,
): FirstUseGuideMessages {
  return Object.freeze({
    title: t("firstUse.title"),
    intro: t("firstUse.intro"),
    hints: Object.freeze([
      t("firstUse.selectionHint"),
      t("firstUse.openHint", { modifier }),
      t("firstUse.contextMenuHint"),
      t("firstUse.markerHint"),
      t("firstUse.navbarHint"),
    ]),
    openSettings: t("firstUse.openSettings"),
    dismiss: t("firstUse.dismiss"),
  });
}
