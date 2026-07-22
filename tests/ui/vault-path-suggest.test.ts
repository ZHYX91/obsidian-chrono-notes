import { describe, expect, it, vi } from "vitest";

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
      const index = value.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
      return index === -1 ? null : { matches: [[index, index + query.length]], score: -index };
    },
    renderResults: vi.fn(),
  };
});

import {
  MarkdownFileSuggest,
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
  it("returns only the best one hundred fuzzy matches", () => {
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
    expect(suggest.getSuggestions("match").map(({ path }) => path)).toEqual(
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
    catalog.start();

    expect(catalog.getMarkdownFiles().map(({ path }) => path)).toEqual(["A.md", "Z.md"]);
    expect(catalog.getMarkdownFiles().map(({ path }) => path)).toEqual(["A.md", "Z.md"]);
    expect(getMarkdownFiles).toHaveBeenCalledOnce();
    listeners[0]?.();
    catalog.getMarkdownFiles();
    expect(getMarkdownFiles).toHaveBeenCalledTimes(2);

    catalog.dispose();
    expect(offref).toHaveBeenCalledTimes(3);
  });
});
