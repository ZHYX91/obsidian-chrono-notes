import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { ObsidianIcsSourceReader } from "../../src/adapters/obsidian/obsidian-ics-source-reader";

class FakeVault {
  readonly files = new Map<string, { path: string; extension: string }>();
  readonly cachedRead = vi.fn(async (file: { path: string }) => `vault:${file.path}`);

  constructor(readonly adapter: object) {}

  getAbstractFileByPath(source: string): { path: string; extension: string } | null {
    return this.files.get(source) ?? null;
  }
}

describe("ObsidianIcsSourceReader", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads an existing Vault file through cachedRead", async () => {
    const vault = new FakeVault({});
    vault.files.set("Calendar/team.ics", { path: "Calendar/team.ics", extension: "ics" });
    const readLocal = vi.fn<() => Promise<string>>();
    const reader = new ObsidianIcsSourceReader(vault as never, { readLocal });

    await expect(reader.read(" Calendar/team.ics ")).resolves.toBe("vault:Calendar/team.ics");
    expect(vault.cachedRead).toHaveBeenCalledOnce();
    expect(readLocal).not.toHaveBeenCalled();
  });

  it("reads absolute and desktop-vault-relative local paths", async () => {
    const basePath = path.resolve("D:/Vault");
    const vault = new FakeVault({ getBasePath: () => basePath });
    const readLocal = vi.fn(async (source: string) => `local:${source}`);
    const reader = new ObsidianIcsSourceReader(vault as never, {
      readLocal,
      resolveLocal: path.resolve,
    });
    const absolute = path.resolve("D:/Calendars/team.ics");

    await expect(reader.read(absolute)).resolves.toBe(`local:${absolute}`);
    await expect(reader.read("External/team.ics")).resolves.toBe(
      `local:${path.resolve(basePath, "External/team.ics")}`,
    );
  });

  it("reads an unindexed Vault file through the adapter before local fallback", async () => {
    const adapter = {
      exists: vi.fn(async (source: string) => source === "Fixtures/sample.ics"),
      read: vi.fn(async (source: string) => `adapter:${source}`),
      getBasePath: vi.fn(() => "D:/Vault"),
    };
    const vault = new FakeVault(adapter);
    const readLocal = vi.fn(async () => "local");
    const reader = new ObsidianIcsSourceReader(vault as never, { readLocal });

    await expect(reader.read("Fixtures/sample.ics")).resolves.toBe(
      "adapter:Fixtures/sample.ics",
    );
    expect(adapter.read).toHaveBeenCalledWith("Fixtures/sample.ics");
    expect(readLocal).not.toHaveBeenCalled();
  });

  it("uses desktop require for local paths without browser dynamic imports", async () => {
    const readFile = vi.fn(async (source: string) => `desktop:${source}`);
    const resolve = vi.fn((basePath: string, source: string) => `${basePath}/${source}`);
    const desktopRequire = vi.fn((moduleId: string) => {
      if (moduleId === "node:fs/promises") return { readFile };
      if (moduleId === "node:path") return { resolve };
      throw new Error(`Unexpected module: ${moduleId}`);
    });
    vi.stubGlobal("require", desktopRequire);
    const vault = new FakeVault({ getBasePath: () => "D:/Vault" });
    const reader = new ObsidianIcsSourceReader(vault as never);

    await expect(reader.read("External/team.ics")).resolves.toBe(
      "desktop:D:/Vault/External/team.ics",
    );
    expect(desktopRequire).toHaveBeenCalledWith("node:path");
    expect(desktopRequire).toHaveBeenCalledWith("node:fs/promises");
  });

  it("rejects empty sources and relative local paths for non-filesystem vaults", async () => {
    const vault = new FakeVault({});
    const reader = new ObsidianIcsSourceReader(vault as never);

    await expect(reader.read(" ")).rejects.toThrow("ICS source is empty");
    await expect(reader.read("missing.ics")).rejects.toThrow(
      "Relative local ICS paths require a filesystem vault",
    );
  });
});
