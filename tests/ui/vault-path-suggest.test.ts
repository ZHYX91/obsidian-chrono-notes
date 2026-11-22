import { describe, expect, it, vi } from "vitest";
import { AbstractInputSuggest, prepareFuzzySearch } from "obsidian";
import { yieldToHost } from "../../src/shared/yield-to-host";

const stats = vi.hoisted(() => ({ scores: 0 }));


vi.mock("obsidian", () => {
  class AbstractInputSuggest {
    protected readonly app: unknown;
    limit = 100;
    private value: string;

    constructor(app: unknown, private readonly inputEl: HTMLInputElement) {
      this.app = app;
      this.value = inputEl.value;
    }

    getValue(): string {
      return this.value;
    }

    setValue(value: string): void {
      this.value = value;
      this.inputEl.value = value;
    }

    close(): void {}
  }

  return {
    AbstractInputSuggest,
    prepareFuzzySearch: (query: string) => (value: string) => {
      stats.scores++;
      const index = value.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
      return index === -1 ? null : { matches: [[index, index + query.length]], score: -index };
    },
    renderResults: vi.fn(),
  };
});

import {
  MarkdownFileSuggest,
  PeriodicNoteFolderSuggest,
  VaultFolderSuggest,
  VaultPathSuggestionCatalog,
} from "../../src/ui/settings/vault-path-suggest";

function createInput(value: string): HTMLInputElement {
  const input = new EventTarget() as EventTarget & {
    ownerDocument: { defaultView: { Event: typeof Event } };
    value: string;
  };
  input.ownerDocument = { defaultView: { Event } };
  input.value = value;
  return input as HTMLInputElement;
}

describe("Vault folder suggestions", () => {
  it("uses the host keyboard suggestion controls for each path input", () => {
    for (const control of [PeriodicNoteFolderSuggest, VaultFolderSuggest, MarkdownFileSuggest]) {
      expect(control.prototype).toBeInstanceOf(AbstractInputSuggest);
    }
  });
  it("filters existing folders without constraining new folder input", () => {
    const input = createInput("New/Folder");
    const app = {
      vault: {
        getAllFolders: () => [
          { path: "Archive" },
          { path: "Projects/Chrono" },
        ],
      },
    } as never;
    const suggest = new VaultFolderSuggest(
      app,
      input,
      new VaultPathSuggestionCatalog(app),
    );

    expect(suggest.getSuggestions(" projects ")).toEqual([
      { path: "Projects/Chrono" },
    ]);
    expect(suggest.getSuggestions("New/Folder")).toEqual([]);
    expect(input.value).toBe("New/Folder");
  });

  it("writes a selected Vault-relative path and emits an input event", () => {
    const input = createInput("");
    const changed = vi.fn();
    input.addEventListener("input", changed);
    const app = {
      vault: { getAllFolders: () => [] },
    } as never;
    const suggest = new VaultFolderSuggest(
      app,
      input,
      new VaultPathSuggestionCatalog(app),
    );

    suggest.selectSuggestion({ path: "Ranges/Projects" } as never);

    expect(input.value).toBe("Ranges/Projects");
    expect(changed).toHaveBeenCalledOnce();
  });
});

describe("Vault path suggestion catalog", () => {
  it("returns only the best one hundred fuzzy matches", async () => {
    const files = Array.from(
      { length: 150 },
      (_, index) => ({ path: `Notes/match-${String(index).padStart(3, "0")}.md` }),
    );
    const app = {
      vault: { getMarkdownFiles: () => [...files] },
    } as never;
    const input = createInput("");
    const suggest = new MarkdownFileSuggest(
      app,
      input,
      new VaultPathSuggestionCatalog(app),
    );

    expect(suggest.getSuggestions("match")).toHaveLength(100);
    expect((await suggest.getSuggestions("match")).map(({ path }) => path)).toEqual(
      files.slice(0, 100).map(({ path }) => path),
    );
  });

  it("sorts once until a create, delete, or rename marks the catalog dirty", () => {
    const listeners: Array<() => void> = [];
    const getMarkdownFiles = vi.fn(() => [
      { path: "Z.md" },
      { path: "A.md" },
    ]);
    const offref = vi.fn();
    const app = {
      vault: {
        getMarkdownFiles,
        getAllFolders: () => [],
        on: vi.fn((_event, listener: () => void) => {
          listeners.push(listener);
          return { listener };
        }),
        offref,
      },
    } as never;
    const catalog = new VaultPathSuggestionCatalog(app);
    const suggest = new MarkdownFileSuggest(app, createInput(""), catalog);
    catalog.start();

    expect(suggest.getSuggestions("")).toEqual([{ path: "A.md" }, { path: "Z.md" }]);
    expect(suggest.getSuggestions("")).toEqual([{ path: "A.md" }, { path: "Z.md" }]);
    expect(getMarkdownFiles).toHaveBeenCalledOnce();
    listeners[0]?.();
    expect(suggest.getSuggestions("")).toEqual([{ path: "A.md" }, { path: "Z.md" }]);
    expect(getMarkdownFiles).toHaveBeenCalledTimes(2);

    catalog.dispose();
    expect(offref).toHaveBeenCalledTimes(3);
  });
});

function largePaths(count = 6000) {
  let files = Array.from({ length: count }, (_, i) => ({
    path: (i % 7 === 0 ? "match" : i % 3 === 0 ? "Xmatch" : "Misc") + (count - i) + ".md",
  }));
  const listeners = new Map<string, () => void>();
  const app = { vault: {
    getMarkdownFiles: () => files,
    on: (event: string, listener: () => void) => { listeners.set(event, listener); return { event }; },
    offref: () => {},
  } } as never;
  const catalog = new VaultPathSuggestionCatalog(app);
  catalog.start();
  const suggest = new MarkdownFileSuggest(app, createInput(""), catalog);
  return { suggest, catalog, files, replace: (next: typeof files) => { files = next; listeners.get("rename")?.(); } };
}

describe("cooperative settings path ranking", () => {
  it("yields to other host work and keeps the fuzzy score and path order", async () => {
    const { suggest, files } = largePaths();
    const search = prepareFuzzySearch("match");
    const expected = files.map((file) => ({ file, result: search(file.path) }))
      .filter((match) => match.result !== null)
      .sort((a, b) => b.result!.score - a.result!.score || a.file.path.localeCompare(b.file.path))
      .slice(0, 100).map(({ file }) => file);
    const before = stats.scores;
    const actual = suggest.getSuggestions("match");
    expect(actual).toBeInstanceOf(Promise);
    await yieldToHost();
    expect(stats.scores - before).toBeLessThan(files.length);
    expect(await actual).toEqual(expected);
    expect(stats.scores - before).toBe(files.length);
  });

  it("stops scoring a superseded input and keeps the latest list even when an old response is shown last", async () => {
    const { suggest, files } = largePaths();
    const alphabetical = await suggest.getSuggestions("");
    const before = stats.scores;
    const old = suggest.getSuggestions("Misc");
    expect(stats.scores).toBeGreaterThan(before);
    expect(stats.scores - before).toBeLessThan(files.length);
    const latest = suggest.getSuggestions("");
    expect(latest).toEqual(alphabetical);
    const atSupersession = stats.scores;
    expect(await old).toBe(latest);
    expect(stats.scores).toBe(atSupersession);
  });

  it("adopts a replacement asynchronous query and neither response includes obsolete Vault paths", async () => {
    const { suggest, replace } = largePaths();
    const first = suggest.getSuggestions("Misc");
    const second = suggest.getSuggestions("match");
    const fresh = [{ path: "match-new.md" }];
    replace(fresh);
    expect(await second).toEqual(fresh);
    expect(await first).toEqual(fresh);
  });

  it.each(["close", "dispose"] as const)("stops an in-flight rank on %s", async (action) => {
    const { suggest, catalog } = largePaths();
    await suggest.getSuggestions("");
    const result = suggest.getSuggestions("match");
    if (action === "close") suggest.close();
    else catalog.dispose();
    const before = stats.scores;
    expect(await result).toEqual([]);
    expect(stats.scores).toBe(before);
  });
});
