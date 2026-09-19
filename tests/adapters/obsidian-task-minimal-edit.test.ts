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
