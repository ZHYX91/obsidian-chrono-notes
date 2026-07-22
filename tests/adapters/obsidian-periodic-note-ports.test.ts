import { describe, expect, it, vi } from "vitest";

import {
  ObsidianBuiltinTemplatePort,
  ObsidianIntervalNoteFilePort,
  ObsidianPeriodicNoteFilePort,
  ObsidianPeriodicNoteTemplatePort,
  ObsidianPeriodicNoteWorkspacePort,
  ObsidianTaskFilePort,
  ObsidianTaskWorkspacePort,
} from "../../src/adapters/obsidian/obsidian-periodic-note-ports";

interface FakeFile {
  path: string;
  extension?: string;
}

class FakeVault {
  readonly files = new Map<string, FakeFile>();
  readonly contents = new Map<string, string>();
  readonly folders = new Set<string>();
  readonly createFolder = vi.fn(async (path: string) => {
    this.folders.add(path);
  });
  readonly create = vi.fn(async (path: string, content: string) => {
    const file = { path, extension: "md" };
    this.files.set(path, file);
    this.contents.set(path, content);
    return file;
  });
  readonly delete = vi.fn(async (file: FakeFile) => {
    this.files.delete(file.path);
    this.contents.delete(file.path);
  });
  readonly read = vi.fn(async (file: FakeFile) => this.contents.get(file.path) ?? "");
  readonly modify = vi.fn(async (file: FakeFile, content: string) => {
    this.contents.set(file.path, content);
  });
  readonly process = vi.fn(async (file: FakeFile, update: (content: string) => string) => {
    const next = update(this.contents.get(file.path) ?? "");
    this.contents.set(file.path, next);
    return next;
  });

  getAbstractFileByPath(path: string): FakeFile | null {
    if (this.folders.has(path)) return { path };
    return this.files.get(path) ?? null;
  }
}

describe("Obsidian periodic note ports", () => {
  it("creates interval note content after ensuring parent folders", async () => {
    const vault = new FakeVault();
    const files = new ObsidianIntervalNoteFilePort(vault as never);

    await files.create("Calendar/Range Notes/trip.md", "---\nstart: 2026-05-01\n---");
    expect([...vault.folders]).toEqual(["Calendar", "Calendar/Range Notes"]);
    expect(vault.contents.get("Calendar/Range Notes/trip.md")).toContain("start: 2026-05-01");
    expect(files.exists("Calendar/Range Notes/trip.md")).toBe(true);
  });

  it("creates missing parent folders and deletes only the addressed Markdown note", async () => {
    const vault = new FakeVault();
    const files = new ObsidianPeriodicNoteFilePort(vault as never);

    await files.createEmpty("Calendar/Daily/2026-05-18.md");
    expect([...vault.folders]).toEqual(["Calendar", "Calendar/Daily"]);
    expect(vault.contents.get("Calendar/Daily/2026-05-18.md")).toBe("");
    expect(files.exists("Calendar/Daily/2026-05-18.md")).toBe(true);

    await files.delete("Calendar/Daily/2026-05-18.md");
    expect(files.exists("Calendar/Daily/2026-05-18.md")).toBe(false);
  });

  it("processes task source files atomically through the Vault port", async () => {
    const vault = new FakeVault();
    vault.files.set("Tasks.md", { path: "Tasks.md", extension: "md" });
    vault.contents.set("Tasks.md", "- [ ] Work");
    const tasks = new ObsidianTaskFilePort(vault as never);

    await tasks.process("Tasks.md", (content) => content.replace("[ ]", "[x]"));
    expect(vault.contents.get("Tasks.md")).toBe("- [x] Work");
    await tasks.process("Tasks.md", () => null);
    expect(vault.contents.get("Tasks.md")).toBe("- [x] Work");
    await expect(tasks.process("Missing.md", () => null)).rejects.toThrow(
      "Markdown note not found",
    );
  });

  it("reads, renders, and writes a configured built-in template", async () => {
    const vault = new FakeVault();
    vault.files.set("Templates/Daily.md", { path: "Templates/Daily.md", extension: "md" });
    vault.contents.set("Templates/Daily.md", "# {{title}}\n{{date:YYYY-MM-DD}} {{time}}");
    vault.files.set("Daily/2026-05-18.md", { path: "Daily/2026-05-18.md", extension: "md" });
    vault.contents.set("Daily/2026-05-18.md", "");
    const templates = new ObsidianBuiltinTemplatePort(
      vault as never,
      () => new Date("2030-08-09T10:11:12Z"),
      "UTC",
    );

    await templates.populate("Daily/2026-05-18.md", {
      date: { year: 2026, month: 5, day: 18 },
      noteType: "daily",
      path: "Daily/2026-05-18.md",
      templatePath: "Templates/Daily.md",
      templateEngine: "builtin",
      title: "2026-05-18",
    });

    expect(vault.contents.get("Daily/2026-05-18.md")).toBe(
      "# 2026-05-18\n2026-05-18 10:11",
    );
  });

  it("does nothing without a template and fails explicitly for a missing template", async () => {
    const vault = new FakeVault();
    vault.files.set("Daily/today.md", { path: "Daily/today.md", extension: "md" });
    const templates = new ObsidianBuiltinTemplatePort(vault as never);
    const context = {
      date: { year: 2026, month: 5, day: 18 },
      noteType: "daily" as const,
      path: "Daily/today.md",
      templatePath: "",
      templateEngine: "builtin" as const,
      title: "today",
    };

    await templates.populate("Daily/today.md", context);
    expect(vault.modify).not.toHaveBeenCalled();
    await expect(
      templates.populate("Daily/today.md", {
        ...context,
        templatePath: "Templates/Missing.md",
      }),
    ).rejects.toThrow("Template note not found: Templates/Missing.md");
  });

  it("fails explicitly when Templater is selected but unavailable", async () => {
    const vault = new FakeVault();
    vault.files.set("Templates/Daily.md", { path: "Templates/Daily.md", extension: "md" });
    vault.files.set("Daily/today.md", { path: "Daily/today.md", extension: "md" });
    const templates = new ObsidianPeriodicNoteTemplatePort(
      { plugins: { getPlugin: () => null } } as never,
      vault as never,
    );

    await expect(
      templates.populate("Daily/today.md", {
        date: { year: 2026, month: 5, day: 18 },
        noteType: "daily",
        path: "Daily/today.md",
        templatePath: "Templates/Daily.md",
        templateEngine: "templater",
        title: "today",
      }),
    ).rejects.toThrow("Templater is not installed or enabled");
    expect(vault.modify).not.toHaveBeenCalled();
  });

  it("injects target-period context and accepts Templater tuple results", async () => {
    const vault = new FakeVault();
    const template = { path: "Templates/Quarterly.md", extension: "md" };
    const target = { path: "Quarterly/2026-Q2.md", extension: "md" };
    vault.files.set(template.path, template);
    vault.contents.set(template.path, "<% tp_calendar.targetDate %>");
    vault.files.set(target.path, target);
    vault.contents.set(target.path, "");
    const config = { target: true };
    const createRunningConfig = vi.fn(() => config);
    const parseTemplate = vi.fn(
      async (_config: unknown, _content: string): Promise<unknown> => [
        "rendered by templater",
        () => undefined,
      ],
    );
    const app = {
      plugins: {
        getPlugin: () => ({
          templater: {
            create_running_config: createRunningConfig,
            parse_template: parseTemplate,
          },
        }),
      },
    };
    const templates = new ObsidianPeriodicNoteTemplatePort(app as never, vault as never);

    await templates.populate(target.path, {
      date: { year: 2026, month: 4, day: 1 },
      noteType: "quarterly",
      path: target.path,
      templatePath: template.path,
      templateEngine: "templater",
      title: "2026-Q2",
    });

    expect(createRunningConfig).toHaveBeenCalledWith(template, target, 1);
    expect(parseTemplate).toHaveBeenCalledOnce();
    expect(parseTemplate.mock.calls[0]?.[0]).toBe(config);
    const injected = parseTemplate.mock.calls[0]?.[1] ?? "";
    expect(injected).toContain('noteType: "quarterly"');
    expect(injected).toContain('title: "2026-Q2"');
    expect(injected).toContain('targetDate: "2026-04-01"');
    expect(injected).toContain("<% tp_calendar.targetDate %>");
    expect(vault.contents.get(target.path)).toBe("rendered by templater");
  });

  it("reuses an already open Markdown leaf or opens a new tab", async () => {
    const vault = new FakeVault();
    const file = { path: "Daily/today.md", extension: "md" };
    vault.files.set(file.path, file);
    const existingLeaf = {
      view: { file },
      getViewState: () => ({ type: "markdown" }),
      openFile: vi.fn(async () => undefined),
    };
    const newLeaf = {
      view: { file: null },
      getViewState: () => ({ type: "empty" }),
      openFile: vi.fn(async () => undefined),
    };
    const workspace = {
      iterateRootLeaves: (callback: (leaf: typeof existingLeaf) => void) => callback(existingLeaf),
      getLeaf: vi.fn(() => newLeaf),
      revealLeaf: vi.fn(async () => undefined),
      setActiveLeaf: vi.fn(),
    };
    const port = new ObsidianPeriodicNoteWorkspacePort(vault as never, workspace as never);

    await port.open(file.path, "default");
    expect(existingLeaf.openFile).not.toHaveBeenCalled();
    expect(workspace.revealLeaf).toHaveBeenCalledWith(existingLeaf);

    await port.open(file.path, "tab");
    expect(workspace.getLeaf).toHaveBeenCalledWith("tab");
    expect(newLeaf.openFile).toHaveBeenCalledWith(file);
  });

  it("opens a task source and positions the Markdown editor at its exact line", async () => {
    const vault = new FakeVault();
    const file = { path: "Tasks.md", extension: "md" };
    vault.files.set(file.path, file);
    const setCursor = vi.fn();
    const scrollIntoView = vi.fn();
    const leaf = {
      view: { file: null as FakeFile | null, editor: { setCursor, scrollIntoView } },
      getViewState: () => ({ type: "empty" }),
      openFile: vi.fn(async () => {
        leaf.view.file = file;
      }),
    };
    const workspace = {
      iterateRootLeaves: vi.fn(),
      getLeaf: vi.fn(() => leaf),
      revealLeaf: vi.fn(async () => undefined),
      setActiveLeaf: vi.fn(),
    };
    const tasks = new ObsidianTaskWorkspacePort(vault as never, workspace as never);

    await tasks.openAtLine("Tasks.md", 14, "tab");
    expect(leaf.openFile).toHaveBeenCalledWith(file);
    expect(setCursor).toHaveBeenCalledWith({ line: 14, ch: 0 });
    expect(scrollIntoView).toHaveBeenCalledWith({
      from: { line: 14, ch: 0 },
      to: { line: 14, ch: 0 },
    }, true);
  });
});
