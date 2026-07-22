import type { App, TFile, Vault } from "obsidian";

import { formatLocalDateKey } from "../../core/periodic/periodic-date";
import { renderBuiltinTemplate } from "../../core/template/builtin-template";
import type {
  PeriodicNoteTemplateContext,
  PeriodicNoteTemplatePort,
} from "../../features/periodic/periodic-note-commands";
import { isMarkdownFile } from "./obsidian-markdown-files";

export class ObsidianBuiltinTemplatePort implements PeriodicNoteTemplatePort {
  constructor(
    private readonly vault: Vault,
    private readonly now: () => Date = () => new Date(),
    private readonly timeZone?: string,
  ) {}

  async populate(path: string, context: PeriodicNoteTemplateContext): Promise<void> {
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
    const rendered = renderBuiltinTemplate(content, {
      date: context.date,
      title: context.title,
      now: this.now(),
      ...(this.timeZone === undefined ? {} : { timeZone: this.timeZone }),
    });
    await this.vault.modify(target, rendered);
  }
}

export class ObsidianPeriodicNoteTemplatePort implements PeriodicNoteTemplatePort {
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

  populate(path: string, context: PeriodicNoteTemplateContext): Promise<void> {
    return context.templateEngine === "templater"
      ? this.templater.populate(path, context)
      : this.builtin.populate(path, context);
  }
}

class ObsidianTemplaterTemplatePort implements PeriodicNoteTemplatePort {
  constructor(
    private readonly app: App,
    private readonly vault: Vault,
  ) {}

  async populate(path: string, context: PeriodicNoteTemplateContext): Promise<void> {
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
  context: PeriodicNoteTemplateContext,
): string {
  const targetDate = formatLocalDateKey(context.date);
  return [
    "<%*",
    "const tp_calendar = Object.freeze({",
    `  noteType: ${JSON.stringify(context.noteType)},`,
    `  title: ${JSON.stringify(context.title)},`,
    `  targetDate: ${JSON.stringify(targetDate)},`,
    `  date: (format = "YYYY-MM-DD", offset = 0) => tp.date.now(format, offset, ${JSON.stringify(targetDate)}, "YYYY-MM-DD"),`,
    '  time: (format = "HH:mm") => tp.date.now(format),',
    "});",
    "_%>",
    rawTemplate,
  ].join("\n");
}
