import type { App, TFile, Vault } from "obsidian";

import { formatLocalDateKey } from "../../core/periodic/periodic-date";
import {
  renderBuiltinIntervalTemplate,
  renderBuiltinTemplate,
} from "../../core/template/builtin-template";
import type {
  NoteTemplateContext,
  NoteTemplatePort,
} from "../../features/templates/note-template-port";
import { isMarkdownFile } from "./obsidian-markdown-files";

export class ObsidianBuiltinTemplatePort implements NoteTemplatePort {
  constructor(
    private readonly vault: Vault,
    private readonly now: () => Date = () => new Date(),
    private readonly timeZone?: string,
  ) {}

  async populate(path: string, context: NoteTemplateContext): Promise<void> {
    const configuredPath = context.templatePath.trim();
    if (configuredPath.length === 0) return;

    const templatePath = withMarkdownExtension(configuredPath);
    const template = this.vault.getAbstractFileByPath(templatePath);
    if (!isMarkdownFile(template)) {
      throw new Error(`Template note not found: ${templatePath}`);
    }
    const target = this.vault.getAbstractFileByPath(path);
    if (!isMarkdownFile(target)) {
      throw new Error(`Target note not found: ${path}`);
    }

    const content = await this.vault.read(template);
    const baseContext = {
      locale: context.locale,
      title: context.title,
      now: this.now(),
      ...(this.timeZone === undefined ? {} : { timeZone: this.timeZone }),
    };
    const rendered = context.kind === "periodic"
      ? renderBuiltinTemplate(content, {
          ...baseContext,
          date: context.date,
        })
      : renderBuiltinIntervalTemplate(content, {
          ...baseContext,
          start: context.start,
          end: context.end,
          dayCount: context.dayCount,
        });
    await this.vault.modify(target, rendered);
  }
}

export class ObsidianNoteTemplatePort implements NoteTemplatePort {
  private readonly builtin: ObsidianBuiltinTemplatePort;
  private readonly templater: ObsidianTemplaterTemplatePort;

  constructor(
    app: App,
    vault: Vault,
    now: () => Date = () => new Date(),
    timeZone?: string,
  ) {
    this.builtin = new ObsidianBuiltinTemplatePort(vault, now, timeZone);
    this.templater = new ObsidianTemplaterTemplatePort(app, vault);
  }

  populate(path: string, context: NoteTemplateContext): Promise<void> {
    return context.templateEngine === "templater"
      ? this.templater.populate(path, context)
      : this.builtin.populate(path, context);
  }
}

class ObsidianTemplaterTemplatePort implements NoteTemplatePort {
  constructor(
    private readonly app: App,
    private readonly vault: Vault,
  ) {}

  async populate(path: string, context: NoteTemplateContext): Promise<void> {
    const configuredPath = context.templatePath.trim();
    if (configuredPath.length === 0) return;

    const templater = getTemplaterPlugin(this.app)?.templater;
    if (
      typeof templater?.create_running_config !== "function" ||
      typeof templater.parse_template !== "function"
    ) {
      throw new Error("Templater is not installed or enabled.");
    }

    const templatePath = withMarkdownExtension(configuredPath);
    const template = this.vault.getAbstractFileByPath(templatePath);
    if (!isMarkdownFile(template)) {
      throw new Error(`Template note not found: ${templatePath}`);
    }
    const target = this.vault.getAbstractFileByPath(path);
    if (!isMarkdownFile(target)) {
      throw new Error(`Target note not found: ${path}`);
    }

    const rawTemplate = await this.vault.read(template);
    const config = templater.create_running_config(template, target, 1);
    let rendered: unknown;
    try {
      rendered = await templater.parse_template(
        config,
        buildTemplaterTemplate(rawTemplate, context),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Templater rendering failed: ${message}`, { cause: error });
    }
    const content = Array.isArray(rendered) ? String(rendered[0]) : String(rendered);
    await this.vault.modify(target, content);
  }
}

function withMarkdownExtension(path: string): string {
  return path.toLowerCase().endsWith(".md") ? path : `${path}.md`;
}

interface TemplaterPlugin {
  readonly templater?: {
    readonly create_running_config?: (template: TFile, target: TFile, mode: number) => unknown;
    readonly parse_template?: (config: unknown, content: string) => Promise<unknown>;
  };
}

type AppWithPlugins = App & {
  readonly plugins?: {
    readonly getPlugin?: (id: string) => unknown;
    readonly plugins?: Readonly<Record<string, unknown>>;
  };
};

function getTemplaterPlugin(app: App): TemplaterPlugin | null {
  const manager = (app as AppWithPlugins).plugins;
  const plugin =
    manager?.getPlugin?.("templater-obsidian") ?? manager?.plugins?.["templater-obsidian"];
  return (plugin as TemplaterPlugin | undefined) ?? null;
}

function buildTemplaterTemplate(
  rawTemplate: string,
  context: NoteTemplateContext,
): string {
  const contextLines = context.kind === "periodic"
    ? buildPeriodicTemplaterContext(context)
    : buildIntervalTemplaterContext(context);
  return [
    "<%*",
    "const tp_calendar = Object.freeze({",
    ...contextLines,
    "});",
    "_%>",
    rawTemplate,
  ].join("\n");
}

function buildPeriodicTemplaterContext(
  context: Extract<NoteTemplateContext, { kind: "periodic" }>,
): readonly string[] {
  const targetDate = formatLocalDateKey(context.date);
  return [
    '  kind: "periodic",',
    `  noteType: ${JSON.stringify(context.noteType)},`,
    `  title: ${JSON.stringify(context.title)},`,
    `  targetDate: ${JSON.stringify(targetDate)},`,
    `  date: (format = "YYYY-MM-DD", offset = 0) => tp.date.now(format, offset, ${JSON.stringify(targetDate)}, "YYYY-MM-DD"),`,
    '  time: (format = "HH:mm") => tp.date.now(format),',
  ];
}

function buildIntervalTemplaterContext(
  context: Extract<NoteTemplateContext, { kind: "interval" }>,
): readonly string[] {
  const startDate = formatLocalDateKey(context.start);
  const endDate = formatLocalDateKey(context.end);
  return [
    '  kind: "interval",',
    `  title: ${JSON.stringify(context.title)},`,
    `  startDate: ${JSON.stringify(startDate)},`,
    `  endDate: ${JSON.stringify(endDate)},`,
    `  dayCount: ${context.dayCount},`,
    `  start: (format = "YYYY-MM-DD") => tp.date.now(format, 0, ${JSON.stringify(startDate)}, "YYYY-MM-DD"),`,
    `  end: (format = "YYYY-MM-DD") => tp.date.now(format, 0, ${JSON.stringify(endDate)}, "YYYY-MM-DD"),`,
    '  time: (format = "HH:mm") => tp.date.now(format),',
  ];
}
