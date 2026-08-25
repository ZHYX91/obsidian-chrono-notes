import type { App, TFile, Vault } from "obsidian";

import { formatLocalDateKey } from "../../core/periodic/periodic-date";
import {
  renderBuiltinIntervalTemplate,
  renderBuiltinTemplate,
} from "../../core/template/builtin-template";
import type {
  NoteTemplateContext,
  NoteTemplatePort,
  PreparedNoteTemplate,
} from "../../features/templates/note-template-port";
import { isMarkdownFile } from "./obsidian-markdown-files";

// Templater exposes no stable public render-only API. Keep the current
// internal create-note mode isolated and serialize access to its mutable
// running configuration so concurrent note creation cannot cross contexts.
const TEMPLATER_CREATE_NEW_NOTE_RUN_MODE = 1;
const templaterRenderTails = new WeakMap<object, Promise<void>>();

export class ObsidianBuiltinTemplatePort implements NoteTemplatePort {
  constructor(
    private readonly vault: Vault,
    private readonly now: () => Date = () => new Date(),
    private readonly timeZone?: string,
  ) {}

  async prepare(
    context: NoteTemplateContext,
    defaultContent: string,
  ): Promise<PreparedNoteTemplate> {
    const configuredPath = context.templatePath.trim();
    if (configuredPath.length === 0) return preparedContent(defaultContent);

    const templatePath = withMarkdownExtension(configuredPath);
    const template = this.vault.getAbstractFileByPath(templatePath);
    if (!isMarkdownFile(template)) {
      throw new Error(`Template note not found: ${templatePath}`);
    }

    const content = await this.vault.cachedRead(template);
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
    return preparedContent(rendered);
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

  prepare(
    context: NoteTemplateContext,
    defaultContent: string,
  ): Promise<PreparedNoteTemplate> {
    return context.templateEngine === "templater"
      ? this.templater.prepare(context, defaultContent)
      : this.builtin.prepare(context, defaultContent);
  }
}

class ObsidianTemplaterTemplatePort implements NoteTemplatePort {
  constructor(
    private readonly app: App,
    private readonly vault: Vault,
  ) {}

  async prepare(
    context: NoteTemplateContext,
    defaultContent: string,
  ): Promise<PreparedNoteTemplate> {
    const configuredPath = context.templatePath.trim();
    if (configuredPath.length === 0) return preparedContent(defaultContent);

    const templater = getTemplaterPlugin(this.app)?.templater;
    const createRunningConfig = templater?.create_running_config;
    const parseTemplate = templater?.parse_template;
    if (
      templater === undefined ||
      typeof createRunningConfig !== "function" ||
      typeof parseTemplate !== "function"
    ) {
      throw new Error("Templater is not installed or enabled.");
    }

    const templatePath = withMarkdownExtension(configuredPath);
    const template = this.vault.getAbstractFileByPath(templatePath);
    if (!isMarkdownFile(template)) {
      throw new Error(`Template note not found: ${templatePath}`);
    }

    const rawTemplate = await this.vault.cachedRead(template);
    return Object.freeze({
      initialContent: defaultContent,
      renderAfterCreate: async (path: string) => {
        const target = this.vault.getAbstractFileByPath(path);
        if (!isMarkdownFile(target)) {
          throw new Error(`Target note not found: ${path}`);
        }
        return runTemplaterExclusive(templater, async () => {
          const config = createRunningConfig.call(
            templater,
            template,
            target,
            TEMPLATER_CREATE_NEW_NOTE_RUN_MODE,
          );
          let rendered: unknown;
          try {
            rendered = await parseTemplate.call(
              templater,
              config,
              buildTemplaterTemplate(rawTemplate, context),
            );
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Templater rendering failed: ${message}`, { cause: error });
          }
          return Array.isArray(rendered) ? String(rendered[0]) : String(rendered);
        });
      },
    });
  }
}

async function runTemplaterExclusive<T>(
  templater: object,
  render: () => Promise<T>,
): Promise<T> {
  const previous = templaterRenderTails.get(templater) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => gate);
  templaterRenderTails.set(templater, tail);
  await previous;
  try {
    return await render();
  } finally {
    release();
    if (templaterRenderTails.get(templater) === tail) {
      void tail.then(() => {
        if (templaterRenderTails.get(templater) === tail) templaterRenderTails.delete(templater);
      });
    }
  }
}

function preparedContent(initialContent: string): PreparedNoteTemplate {
  return Object.freeze({ initialContent });
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
