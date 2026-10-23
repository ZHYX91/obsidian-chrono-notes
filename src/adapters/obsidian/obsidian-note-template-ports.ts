import type { App, TFile, Vault } from "obsidian";

import { buildTemplaterPeriodFormatter } from "../../core/template/templater-period-format";
import { formatLocalDateKey, type LocalDate } from "../../core/periodic/periodic-date";
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
import { OperationError } from "../../shared/operation-error";

// Templater exposes no stable public render-only API. Keep the current
// internal create-note mode isolated. Serialize the complete creation lifecycle
// so a preceding task cannot tear down the next task's rendering context.
const TEMPLATER_CREATE_NEW_NOTE_RUN_MODE = 0;
const templaterCreationTails = new WeakMap<object, Promise<void>>();

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
      throw new OperationError("templateMissing", `Template note not found: ${templatePath}`, {
        path: templatePath,
      });
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
          range: context.range,
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

    const plugin = getTemplaterPlugin(this.app);
    if (plugin === null) {
      throw new OperationError("templaterUnavailable", "Templater is not installed or enabled.");
    }
    const templater = plugin.templater;
    const createRunningConfig = templater?.create_running_config;
    const parseTemplate = templater?.parse_template;
    const pendingFiles = templater?.files_with_pending_templates;
    const endTemplaterTask = templater?.end_templater_task;
    if (
      templater === undefined ||
      typeof createRunningConfig !== "function" ||
      typeof parseTemplate !== "function" ||
      typeof pendingFiles?.has !== "function" ||
      typeof pendingFiles.add !== "function" ||
      typeof pendingFiles.delete !== "function" ||
      typeof endTemplaterTask !== "function"
    ) {
      throw new OperationError("templaterIncompatible", "Templater rendering API is unavailable.");
    }

    const templatePath = withMarkdownExtension(configuredPath);
    const template = this.vault.getAbstractFileByPath(templatePath);
    if (!isMarkdownFile(template)) {
      throw new OperationError("templateMissing", `Template note not found: ${templatePath}`, {
        path: templatePath,
      });
    }

    const rawTemplate = await this.vault.cachedRead(template);
    return Object.freeze({
      initialContent: defaultContent,
      runCreation: async (createAndFinalize: () => Promise<void>) => {
        // Reserve before queueing or emitting Vault.create. Templater's delayed
        // automatic handler must see this path while another note is rendering.
        if (pendingFiles.has(context.path)) {
          throw new OperationError(
            "templaterFailed",
            `Templater is already processing the target note: ${context.path}`,
            { path: context.path },
          );
        }
        pendingFiles.add(context.path);
        await runTemplaterExclusive(templater, async () => {
          let creationFailure: { error: unknown } | undefined;
          try {
            await createAndFinalize();
          } catch (error) {
            creationFailure = { error };
          }
          try {
            // The native lifecycle removes only our reserved path and defers
            // all-templates-executed/teardown until every pending path ends.
            await endTemplaterTask.call(templater, context.path);
          } catch (error) {
            if (creationFailure !== undefined) {
              throw new AggregateError(
                [creationFailure.error, error],
                `${errorMessage(creationFailure.error)}; Templater cleanup failed: ${errorMessage(error)}`,
                { cause: creationFailure.error },
              );
            }
            throw new OperationError(
              "templaterFailed", `Templater cleanup failed: ${errorMessage(error)}`, { cause: error },
            );
          }
          if (creationFailure !== undefined) throw creationFailure.error;
        });
      },
      renderAfterCreate: async (path: string) => {
        const target = this.vault.getAbstractFileByPath(path);
        if (!isMarkdownFile(target)) {
          throw new OperationError("targetMissing", `Target note not found: ${path}`, { path });
        }
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
          const message = errorMessage(error);
          throw new OperationError("templaterFailed", `Templater rendering failed: ${message}`, {
            cause: error,
          });
        }
        return Array.isArray(rendered) ? String(rendered[0]) : String(rendered);
      },
    });
  }
}

async function runTemplaterExclusive<T>(
  templater: object,
  createAndFinalize: () => Promise<T>,
): Promise<T> {
  const previous = templaterCreationTails.get(templater) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => gate);
  templaterCreationTails.set(templater, tail);
  await previous;
  try {
    return await createAndFinalize();
  } finally {
    release();
    if (templaterCreationTails.get(templater) === tail) {
      void tail.then(() => {
        if (templaterCreationTails.get(templater) === tail) templaterCreationTails.delete(templater);
      });
    }
  }
}

function preparedContent(initialContent: string): PreparedNoteTemplate {
  return Object.freeze({ initialContent });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function withMarkdownExtension(path: string): string {
  return path.toLowerCase().endsWith(".md") ? path : `${path}.md`;
}

interface TemplaterPlugin {
  readonly templater?: {
    readonly create_running_config?: (template: TFile, target: TFile, mode: number) => unknown;
    readonly parse_template?: (config: unknown, content: string) => Promise<unknown>;
    readonly files_with_pending_templates?: Set<string>;
    readonly end_templater_task?: (path: string) => Promise<void>;
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
    buildTemplaterPeriodFormatter(),
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
    ...buildTemplaterRange(context.range.start, context.range.end, context.range.dayCount),
    `  date: (format = "YYYY-MM-DD", offset = 0) => chronoDate(format, offset, ${JSON.stringify(targetDate)}),`,
    '  time: (format = "HH:mm") => chronoDate(format),',
  ];
}

function buildIntervalTemplaterContext(
  context: Extract<NoteTemplateContext, { kind: "interval" }>,
): readonly string[] {
  return [
    '  kind: "interval",',
    `  title: ${JSON.stringify(context.title)},`,
    ...buildTemplaterRange(context.start, context.end, context.dayCount),
    '  time: (format = "HH:mm") => chronoDate(format),',
  ];
}

function buildTemplaterRange(
  start: LocalDate,
  end: LocalDate,
  dayCount: number,
): readonly string[] {
  const startDate = formatLocalDateKey(start);
  const endDate = formatLocalDateKey(end);
  return [
    `  startDate: ${JSON.stringify(startDate)},`,
    `  endDate: ${JSON.stringify(endDate)},`,
    `  dayCount: ${dayCount},`,
    `  start: (format = "YYYY-MM-DD") => chronoDate(format, 0, ${JSON.stringify(startDate)}),`,
    `  end: (format = "YYYY-MM-DD") => chronoDate(format, 0, ${JSON.stringify(endDate)}),`,
  ];
}
