import { describe, expect, it } from "vitest";

import { ObsidianNoteIndexCache } from "../../src/adapters/obsidian/obsidian-note-index-cache";
import { createPersistedNoteIndexSnapshot } from "../../src/features/notes/note-index-cache";

describe("ObsidianNoteIndexCache", () => {
  it("fails open when IndexedDB is unavailable", async () => {
    const cache = new ObsidianNoteIndexCache({
      adapter: {
        getBasePath: () => "D:/Vault",
        getResourcePath: () => "app://vault/.obsidian",
      },
      configDir: ".obsidian",
      getName: () => "Vault",
    } as never);
    const snapshot = createPersistedNoteIndexSnapshot([]);

    await expect(cache.load()).resolves.toBeNull();
    await expect(cache.save(snapshot)).resolves.toBeUndefined();
    await expect(cache.clear()).resolves.toBeUndefined();
  });
});
