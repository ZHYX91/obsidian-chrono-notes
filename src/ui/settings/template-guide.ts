import type { Translator } from "../../shared/i18n";
import { renderDateFormatGuide } from "./date-format-guide";
import { createSettingsGuide } from "./settings-guide";
import { periodicNoteLabel } from "./settings-presentation";
import type { SettingsSectionContext } from "./settings-section-context";

type TemplateKind = "periodic" | "interval";
type GuideRow = readonly [syntax: string, meaning: string, example: string];

export function renderTemplateSyntaxGuide(
  containerEl: HTMLElement,
  context: SettingsSectionContext,
): void {
  const { t } = context.translator;
  const builtin = context.host.settings.templateEngine === "builtin";
  containerEl.createEl("p", {
    cls: "chrono-notes-settings-guide-brief", text: t("settings.templates.contentLocation"),
  });
  const guideEl = createSettingsGuide(containerEl, t("settings.templates.syntaxTitle"), "template-syntax");
  guideEl.createEl("p", { text: t(builtin
    ? "settings.templates.builtinHelp"
    : "settings.templates.templaterHelp") });
  guideEl.createEl("p").createEl("code", {
    text: builtin ? "{{start}} · {{start:YYYY-MM-DD}}" : '<% tp_calendar.start("YYYY-MM-DD") %>',
  });
  renderDateFormatGuide(guideEl, context.translator, true);
  guideEl.createEl("p", { text: t("settings.templates.formatDefaults") });
}

export function renderNoteTemplateGuide(
  containerEl: HTMLElement,
  context: SettingsSectionContext,
  kind: TemplateKind,
): void {
  const { t } = context.translator;
  const periodic = kind === "periodic";
  const builtin = context.host.settings.templateEngine === "builtin";
  containerEl.createEl("p", {
    cls: "chrono-notes-settings-guide-brief",
    text: t("settings.templates.engineInUse", {
      engine: t(builtin ? "settings.templates.builtinEngine" : "settings.templates.templaterEngine"),
    }),
  });
  const guideEl = createSettingsGuide(containerEl, t(periodic
    ? "settings.templates.periodicHeading"
    : "settings.templates.intervalHeading"), periodic ? "periodic-template" : "range-template");
  guideEl.createEl("p", { text: t(periodic
    ? "settings.templates.periodDates"
    : "settings.templates.intervalDates") });
  guideEl.createEl("p", { text: t("settings.templates.pathDesc", {
    general: t("settings.tab.general"), templates: t("settings.templates.settingsHeading"),
  }) });
  const syntax = (key: string, formatted = false): string => builtin
    ? `{{${key}}}${formatted ? `\n{{${key}:FORMAT}}` : ""}`
    : `<% tp_calendar.${key}${formatted ? "()" : ""} %>`
      + (formatted ? `\n<% tp_calendar.${key}("FORMAT") %>` : "");
  const start = periodic ? "2020-01-01" : "2026-07-01";
  const end = periodic ? "2029-12-31" : "2026-07-07";
  const rows: GuideRow[] = [
    [syntax("title"), t("settings.templates.meaningTitle"), periodic ? "2020s" : `${start} - ${end}`],
    ...(periodic ? [[syntax("date", true), t("settings.templates.meaningDate"), start] as const] : []),
    [syntax("start", true), t("settings.templates.meaningStart"), start],
    [syntax("end", true), t("settings.templates.meaningEnd"), end],
    [syntax(builtin ? "days" : "dayCount"), t("settings.templates.meaningDays"), periodic ? "3653" : "7"],
    [syntax("time", true), t("settings.templates.meaningTime"), "13:14"],
  ];
  if (!builtin) {
    if (periodic) rows.push(
      [syntax("noteType"), t("settings.templates.meaningType"), "decadal"],
      [syntax("targetDate"), t("settings.templates.meaningDate"), start],
    );
    rows.push(
      [syntax("startDate"), t("settings.templates.meaningStart"), start],
      [syntax("endDate"), t("settings.templates.meaningEnd"), end],
    );
  }
  guideEl.createEl("p", { text: t(periodic
    ? "settings.templates.periodicExample"
    : "settings.templates.intervalExample") });
  renderGuideTable(guideEl, context.translator, rows);
  const examples = periodic ? [
    [builtin ? "{{date:DEC[s]}}" : '<% tp_calendar.date("DEC[s]") %>', "2020s"],
    [builtin ? "{{date:[C]CEN}}" : '<% tp_calendar.date("[C]CEN") %>', "C21"],
    [builtin ? "{{start:YYYY}}–{{end:YYYY}}" : '<% tp_calendar.start("YYYY") %>–<% tp_calendar.end("YYYY") %>', "2020–2029"],
  ] : [
    [builtin ? "{{start:YYYY-MM-DD}}–{{end:YYYY-MM-DD}}" : '<% tp_calendar.start("YYYY-MM-DD") %>–<% tp_calendar.end("YYYY-MM-DD") %>', `${start}–${end}`],
  ];
  for (const [source = "", result = ""] of examples) {
    const row = guideEl.createEl("p");
    row.createEl("code", { text: source });
    row.append(" → ");
    row.createEl("code", { text: result });
  }
  guideEl.createEl("p", { text: t("settings.templates.syntaxReference") });
  if (periodic) {
    const datesEl = createSettingsGuide(
      containerEl, t("settings.templates.dateRangesHeading"), "periodic-date-ranges",
    );
    datesEl.createEl("p", { text: t("settings.templates.rangeExamples") });
    renderGuideTable(datesEl, context.translator, [
      [periodicNoteLabel("daily", t), "2026-09-08", "2026-09-08"],
      [periodicNoteLabel("weekly", t), "2026-09-07", "2026-09-13"],
      [periodicNoteLabel("monthly", t), "2026-09-01", "2026-09-30"],
      [periodicNoteLabel("quarterly", t), "2026-07-01", "2026-09-30"],
      [periodicNoteLabel("yearly", t), "2026-01-01", "2026-12-31"],
      [periodicNoteLabel("decadal", t), "2020-01-01", "2029-12-31"],
      [periodicNoteLabel("century", t), "2001-01-01", "2100-12-31"],
    ], [t("settings.templates.meaningType"), t("settings.templates.meaningStart"), t("settings.templates.meaningEnd")], [1, 2]);
  }
}

function renderGuideTable(
  containerEl: HTMLElement,
  translator: Translator,
  rows: readonly GuideRow[],
  headings: readonly string[] = [
    translator.t("settings.templates.columnSyntax"),
    translator.t("settings.templates.columnMeaning"),
    translator.t("settings.templates.columnExample"),
  ],
  codeColumns: readonly number[] = [0, 2],
): void {
  const table = containerEl.createEl("table", { cls: "chrono-notes-template-guide-table" });
  const header = table.createEl("thead").createEl("tr");
  for (const text of headings) header.createEl("th", { text, attr: { scope: "col" } });
  const body = table.createEl("tbody");
  for (const values of rows) {
    const row = body.createEl("tr");
    values.forEach((value, index) => {
      const cell = row.createEl("td");
      if (codeColumns.includes(index)) cell.createEl("code", { text: value });
      else cell.setText(value);
    });
  }
}
