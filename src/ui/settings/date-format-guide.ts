import type { Translator } from "../../shared/i18n";

/** Both settings cards describe the same path/template format contract. */
export function renderDateFormatGuide(containerEl: HTMLElement, translator: Translator, time: boolean): void {
  const { t } = translator;
  const rows = [
    [t("settings.formats.date"), "YYYY, YY, M, MM, MMM, MMMM, D, DD, ddd, dddd, GGGG, GG, W, WW, Q"],
    ...(time ? [[t("settings.formats.time"), "H, HH, m, mm, s, ss, A, a"]] : []),
    [t("settings.formats.extensions"), "DEC → 2020; CEN → 21; DEC[s] → 2020s; [C]CEN → C21"],
  ];
  for (const [label = "", formats = ""] of rows) {
    const row = containerEl.createEl("p");
    row.createEl("strong", { text: `${label}: ` });
    row.createEl("code", { text: formats });
  }
  containerEl.createEl("p", { text: t("settings.formats.periods") });
}
