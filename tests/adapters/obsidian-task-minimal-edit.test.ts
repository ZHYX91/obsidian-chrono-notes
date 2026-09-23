import { describe, expect, it, vi } from "vitest";

import { ObsidianTaskFilePort } from "../../src/adapters/obsidian/obsidian-note-file-ports";

function fixture(initial: string) {
  let content = initial;
  const file = { path: "Tasks.md", extension: "md" };
  const vault = { getAbstractFileByPath: () => file, process: vi.fn() };
  const editor = {
    getValue: vi.fn(() => content),
    offsetToPos: vi.fn((offset: number) => {
      const lines = content.slice(0, offset).split("\n");
      return { line: lines.length - 1, ch: lines.at(-1)?.length ?? 0 };
    }),
    transaction: vi.fn(),
  };
  const requestSave = vi.fn();
  const leaf = { view: { file, editor, requestSave } };
  const workspace = { getLeavesOfType: vi.fn(() => [leaf]) };
  return {
    port: new ObsidianTaskFilePort(vault as never, workspace as never),
    vault, editor, requestSave,
    replace: (next: string) => { content = next; },
  };
}

describe("minimal task editor transactions", () => {
  it("changes only the checkbox in a multiline buffer and leaves other text outside the transaction", async () => {
    const value = fixture("# 😀 Notes\n- [ ] Work 📅 2026-09-13\nUnrelated unsaved text");
    await value.port.process("Tasks.md", (content) => content.replace("[ ]", "[x]"));
    expect(value.editor.transaction).toHaveBeenCalledWith({ changes: [{
      from: { line: 1, ch: 3 }, to: { line: 1, ch: 4 }, text: "x",
    }] }, "chrono-notes-task");
    expect(value.requestSave).toHaveBeenCalledOnce();
    expect(value.vault.process).not.toHaveBeenCalled();
  });

  it("uses UTF-16 offsets for a date following emoji", async () => {
    const prefix = "- [ ] 😀 Work 📅 2026-09-";
    const value = fixture(`${prefix}13\nUnrelated text`);
    await value.port.process("Tasks.md", (content) => content.replace("2026-09-13", "2026-09-24"));
    expect(value.editor.transaction).toHaveBeenCalledWith({ changes: [{
      from: { line: 0, ch: prefix.length }, to: { line: 0, ch: prefix.length + 2 }, text: "24",
    }] }, "chrono-notes-task");
  });

  it("does not submit a transaction or request a save for a rejected or unchanged edit", async () => {
    const value = fixture("- [ ] Work");
    await value.port.process("Tasks.md", () => null);
    await value.port.process("Tasks.md", (content) => content);
    expect(value.editor.transaction).not.toHaveBeenCalled();
    expect(value.requestSave).not.toHaveBeenCalled();
  });

  it("rejects a closed-file update when the note opens before the process callback", async () => {
    let content = "- [ ] Work";
    const file = { path: "Tasks.md", extension: "md" };
    const editor = {
      getValue: vi.fn(() => "- [ ] Unsaved edit"),
      offsetToPos: vi.fn(),
      transaction: vi.fn(),
    };
    const requestSave = vi.fn();
    let leaves: Array<{ view: { file: typeof file; editor: typeof editor; requestSave: typeof requestSave } }> = [];
    const workspace = { getLeavesOfType: vi.fn(() => leaves) };
    const vault = {
      getAbstractFileByPath: vi.fn(() => file),
      process: vi.fn(async (_file: typeof file, transform: (current: string) => string) => {
        leaves = [{ view: { file, editor, requestSave } }];
        const next = transform(content);
        content = next;
        return next;
      }),
    };
    const port = new ObsidianTaskFilePort(vault as never, workspace as never);

    await expect(port.process("Tasks.md", (source) => source.replace("[ ]", "[x]")))
      .rejects.toThrow("editor opened before task update");
    expect(content).toBe("- [ ] Work");
    expect(editor.transaction).not.toHaveBeenCalled();
    expect(requestSave).not.toHaveBeenCalled();
  });

  it.each(["open", "rename"])("accepts a committed write when the note changes afterwards: %s", async (change) => {
    let content = "- [ ] Work";
    const file = { path: "Tasks.md", extension: "md" };
    const editor = { getValue: vi.fn(() => content), transaction: vi.fn() };
    const requestSave = vi.fn();
    const leaves: Array<{ view: { file: typeof file; editor: typeof editor; requestSave: typeof requestSave } }> = [];
    const vault = {
      getAbstractFileByPath: (path: string) => path === file.path ? file : null,
      process: async (_file: typeof file, transform: (current: string) => string) => {
        content = transform(content);
        if (change === "open") leaves.push({ view: { file, editor, requestSave } });
        else file.path = "Renamed.md";
        return content;
      },
    };
    const port = new ObsidianTaskFilePort(vault as never, {
      getLeavesOfType: () => leaves,
    } as never);

    await expect(port.process("Tasks.md", (source) => source.replace("[ ]", "[x]")))
      .resolves.toBeUndefined();
    expect(content).toBe("- [x] Work");
    expect(editor.transaction).not.toHaveBeenCalled();
    expect(requestSave).not.toHaveBeenCalled();
  });

  it.each(["rename", "replace"])("rejects a changed file identity before publishing: %s", async (change) => {
    let content = "- [ ] Work";
    const file = { path: "Tasks.md", extension: "md" };
    let currentFile = file;
    const rewrite = vi.fn((source: string) => source.replace("[ ]", "[x]"));
    const vault = {
      getAbstractFileByPath: () => currentFile,
      process: async (_file: typeof file, transform: (current: string) => string) => {
        if (change === "rename") file.path = "Renamed.md";
        else currentFile = { ...file };
        content = transform(content);
        return content;
      },
    };
    const port = new ObsidianTaskFilePort(vault as never, { getLeavesOfType: () => [] } as never);

    await expect(port.process("Tasks.md", rewrite)).rejects.toThrow("note changed during task update");
    expect(rewrite).not.toHaveBeenCalled();
    expect(content).toBe("- [ ] Work");
  });

  it("rejects an unverified published value", async () => {
    const file = { path: "Tasks.md", extension: "md" };
    const vault = {
      getAbstractFileByPath: () => file,
      process: async (_file: typeof file, transform: (current: string) => string) => {
        transform("- [ ] Work");
        return "- [ ] Work";
      },
    };
    const port = new ObsidianTaskFilePort(vault as never, { getLeavesOfType: () => [] } as never);
    await expect(port.process("Tasks.md", (source) => source.replace("[ ]", "[x]")))
      .rejects.toThrow("could not be verified");
  });

  it("does not overwrite a buffer changed during the rewrite callback", async () => {
    const value = fixture("- [ ] Work");
    await expect(value.port.process("Tasks.md", (content) => {
      value.replace("- [ ] New unsaved edit");
      return content.replace("[ ]", "[x]");
    })).rejects.toThrow("editor changed before task update");
    expect(value.editor.transaction).not.toHaveBeenCalled();
    expect(value.requestSave).not.toHaveBeenCalled();
    expect(value.vault.process).not.toHaveBeenCalled();
  });
});
