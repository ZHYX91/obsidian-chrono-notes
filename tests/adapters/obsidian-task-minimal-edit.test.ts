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
    transaction: vi.fn((transaction: { changes: Array<{
      from: { line: number; ch: number }; to: { line: number; ch: number }; text: string;
    }> }) => {
      const offset = ({ line, ch }: { line: number; ch: number }) =>
        content.split("\n").slice(0, line).reduce((sum, value) => sum + value.length + 1, 0) + ch;
      for (const change of transaction.changes) {
        content = content.slice(0, offset(change.from)) + change.text + content.slice(offset(change.to));
      }
    }),
  };
  const requestSave = vi.fn();
  const leaf = { view: { file, editor, requestSave } };
  const workspace = { getLeavesOfType: vi.fn(() => [leaf]) };
  return {
    port: new ObsidianTaskFilePort(vault as never, workspace as never),
    vault, editor, requestSave, file, leaf, workspace,
    replace: (next: string) => { content = next; },
  };
}

describe("minimal task editor transactions", () => {
  it.each(["requestSave", "editor", "transaction"])("never falls back to disk for a matching pane without %s", async (capability) => {
    const value = fixture("- [ ] Unsaved work");
    if (capability === "transaction") Reflect.deleteProperty(value.editor, capability);
    else Reflect.deleteProperty(value.leaf.view, capability);
    const update = vi.fn((content: string) => content.replace("[ ]", "[x]"));
    await expect(value.port.process("Tasks.md", update)).rejects.toThrow("editor is unavailable");
    expect(value.vault.process).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects a writable editor when another matching pane has no editor capabilities", async () => {
    const value = fixture("- [ ] Unsaved work");
    value.workspace.getLeavesOfType.mockReturnValue([value.leaf, { view: { file: value.file } } as typeof value.leaf]);
    await expect(value.port.process("Tasks.md", (content) => content.replace("[ ]", "[x]")))
      .rejects.toThrow("multiple editors");
    expect(value.editor.transaction).not.toHaveBeenCalled();
    expect(value.vault.process).not.toHaveBeenCalled();
  });

  it("blocks disk publication when an unavailable matching pane opens before its callback", async () => {
    const value = fixture("- [ ] Work");
    value.workspace.getLeavesOfType.mockReturnValue([]);
    value.vault.process.mockImplementation((_file: unknown, update: (content: string) => string) => {
      value.workspace.getLeavesOfType.mockReturnValue([{ view: { file: value.file } } as typeof value.leaf]);
      return update("- [ ] Work");
    });
    const update = vi.fn((content: string) => content.replace("[ ]", "[x]"));
    await expect(value.port.process("Tasks.md", update)).rejects.toThrow("editor opened before");
    expect(update).not.toHaveBeenCalled();
    expect(value.editor.transaction).not.toHaveBeenCalled();
  });

  it("warns without calling a replaced save callback after the task edit was applied", async () => {
    const value = fixture("- [ ] Work");
    const otherSave = vi.fn();
    value.editor.transaction.mockImplementation(() => {
      value.replace("- [x] Work");
      value.leaf.view.requestSave = otherSave;
    });
    await expect(value.port.process("Tasks.md", (content) => content.replace("[ ]", "[x]")))
      .resolves.toEqual({ warning: "save-not-confirmed" });
    expect(value.requestSave).not.toHaveBeenCalled();
    expect(otherSave).not.toHaveBeenCalled();
  });
  it.each(["silent", "throw"])("does not report success when a transaction leaves the original text: %s", async (kind) => {
    const value = fixture("- [ ] Work");
    value.editor.transaction.mockImplementation(() => {
      if (kind === "throw") throw new Error("host refused");
    });
    await expect(value.port.process("Tasks.md", (content) => content.replace("[ ]", "[x]")))
      .rejects.toMatchObject({ outputState: "not-applied" });
    expect(value.requestSave).not.toHaveBeenCalled();
    expect(value.editor.transaction).toHaveBeenCalledOnce();
  });

  it("preserves a third editor state and never retries an uncertain task edit", async () => {
    const value = fixture("- [ ] Work");
    value.editor.transaction.mockImplementation(() => { value.replace("- [ ] Changed by another plugin"); });
    await expect(value.port.process("Tasks.md", (content) => content.replace("[ ]", "[x]")))
      .rejects.toMatchObject({ outputState: "unconfirmed" });
    expect(value.editor.getValue()).toBe("- [ ] Changed by another plugin");
    expect(value.requestSave).not.toHaveBeenCalled();
    expect(value.editor.transaction).toHaveBeenCalledOnce();
  });

  it("treats a callback throw after exact publication as applied with a warning", async () => {
    const value = fixture("- [ ] Work");
    value.editor.transaction.mockImplementation(() => {
      value.replace("- [x] Work");
      throw new Error("host callback");
    });
    await expect(value.port.process("Tasks.md", (content) => content.replace("[ ]", "[x]")))
      .resolves.toEqual({ warning: "editor-reported-error" });
    expect(value.requestSave).toHaveBeenCalledOnce();
  });

  it("retains the applied edit when scheduling a save fails", async () => {
    const value = fixture("- [ ] Work");
    value.requestSave.mockImplementation(() => { throw new Error("save"); });
    await expect(value.port.process("Tasks.md", (content) => content.replace("[ ]", "[x]")))
      .resolves.toEqual({ warning: "save-not-confirmed" });
    expect(value.editor.getValue()).toBe("- [x] Work");
    expect(value.editor.transaction).toHaveBeenCalledOnce();
  });

  it("rejects a same-path replacement file in an open view", async () => {
    const value = fixture("- [ ] Work");
    value.leaf.view.file = { ...value.file };
    await expect(value.port.process("Tasks.md", (content) => content.replace("[ ]", "[x]")))
      .rejects.toThrow("editor changed before");
    expect(value.editor.transaction).not.toHaveBeenCalled();
  });
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
