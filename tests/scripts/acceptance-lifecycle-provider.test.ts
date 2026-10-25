import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import { describe, expect, it } from "vitest";

describe("explicit acceptance lifecycle setup", () => {
  it("waits for the operator interval, reloads only the plugin, and records the pending modal", async () => {
    const commands: Array<{ id: string; callback: () => void }> = [];
    const effects: string[] = [];
    const writes: Array<{ path: string; value: string }> = [];
    let timer: (() => Promise<void>) | undefined;
    let loaded = true;
    class Plugin {
      app = {
        plugins: {
          getPlugin: () => loaded ? {} : null,
          disablePlugin: async (id: string) => { effects.push(`disable:${id}`); loaded = false; },
          enablePlugin: async (id: string) => { effects.push(`enable:${id}`); loaded = true; },
        },
        workspace: { getActiveFile: () => ({ path: "Prior.md" }) },
        vault: { adapter: { write: async (path: string, value: string) => { writes.push({ path, value }); } } },
      };
      addCommand(command: { id: string; callback: () => void }) { commands.push(command); }
      register() {}
    }
    const sandbox = {
      module: { exports: Plugin },
      require: () => ({ Plugin, Notice: class {} }),
      document: { querySelector: () => ({ textContent: "Pending template Submit" }) },
      window: {
        setTimeout: (callback: () => Promise<void>, delay: number) => {
          expect(delay).toBe(30000);
          timer = callback;
          return 1;
        },
        clearTimeout: () => {},
      },
    };
    const source = readFileSync(new URL("../../acceptance/fixtures/.obsidian/plugins/chrono-notes-acceptance-provider/main.js", import.meta.url), "utf8");
    runInNewContext(source, sandbox);
    const Provider = sandbox.module.exports as typeof Plugin & { new(): Plugin & { onload(): void } };
    const provider = new Provider();
    provider.onload();
    const command = commands.find(({ id }) => id === "prepare-lifecycle-reload");
    expect(command).toBeDefined();
    command!.callback();
    expect(effects).toEqual([]);
    expect(writes).toEqual([]);
    command!.callback();
    await timer!();
    expect(effects).toEqual(["disable:chrono-notes", "enable:chrono-notes"]);
    expect(writes).toHaveLength(1);
    expect(writes[0]!.path).toMatch(/^Chrono lifecycle .*\.json$/);
    expect(JSON.parse(writes[0]!.value)).toMatchObject({
      dialogText: "Pending template Submit",
      activePathBefore: "Prior.md",
      activePathAfter: "Prior.md",
      loadedBefore: true,
      loadedAfterDisable: false,
      loadedAfterEnable: true,
    });
  });
});
