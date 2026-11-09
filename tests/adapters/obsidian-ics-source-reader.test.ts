import { createRequire } from "node:module";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const { MockTFile } = vi.hoisted(() => ({
  MockTFile: class MockTFile {
    constructor(
      readonly path: string,
      readonly extension: string,
    ) {}
  },
}));

vi.mock("obsidian", () => ({ TFile: MockTFile }));

import { MAX_ICS_SOURCE_BYTES } from "../../src/core/calendar/ics-calendar";
import { ObsidianIcsSourceReader } from "../../src/adapters/obsidian/obsidian-ics-source-reader";

class FakeVault {
  readonly files = new Map<string, unknown>();
  readonly cachedRead = vi.fn(async (file: { path: string }) => `vault:${file.path}`);

  constructor(readonly adapter: object) {}

  getAbstractFileByPath(source: string): object | null {
    return this.files.get(source) ?? null;
  }
}

describe("ObsidianIcsSourceReader", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads an existing Vault file through cachedRead", async () => {
    const vault = new FakeVault({ stat: async () => ({ type: "file", size: 10 }) });
    vault.files.set("Calendar/team.ics", new MockTFile("Calendar/team.ics", "ics"));
    const readLocal = vi.fn<() => Promise<string>>();
    const reader = new ObsidianIcsSourceReader(vault as never, { readLocal });

    await expect(reader.read(" Calendar/team.ics ")).resolves.toBe("vault:Calendar/team.ics");
    expect(vault.cachedRead).toHaveBeenCalledOnce();
    expect(readLocal).not.toHaveBeenCalled();
  });

  it("does not treat a non-file Vault entry as a readable file", async () => {
    const vault = new FakeVault({});
    vault.files.set("Calendar", { path: "Calendar", extension: "ics" });
    const reader = new ObsidianIcsSourceReader(vault as never);

    await expect(reader.read("Calendar")).rejects.toThrow(
      "Relative local ICS paths require a filesystem vault",
    );
    expect(vault.cachedRead).not.toHaveBeenCalled();
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
      stat: vi.fn(async () => ({ type: "file", size: 10 })),
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

  it("reads local files through desktop require, preserving UTF-8 and BOM", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "chrono-ics-"));
    try {
      vi.stubGlobal("window", { require: createRequire(import.meta.url) });
      const vault = new FakeVault({ getBasePath: () => directory });
      const reader = new ObsidianIcsSourceReader(vault as never);
      const content = "\ufeffBEGIN:VCALENDAR\r\n中文📅\r\nEND:VCALENDAR";
      await writeFile(path.join(directory, "sample.ics"), content);
      await expect(reader.read("sample.ics")).resolves.toBe(content);
      if (process.platform !== "win32") {
        await symlink(path.join(directory, "sample.ics"), path.join(directory, "linked.ics"));
        await expect(reader.read("linked.ics")).resolves.toBe(content);
      }
      await expect(reader.read(directory)).rejects.toThrow("regular file");
      await writeFile(path.join(directory, "large.ics"), "a".repeat(MAX_ICS_SOURCE_BYTES + 1));
      await expect(reader.read("large.ics")).rejects.toThrow("exceeds");
      await writeFile(path.join(directory, "limit.ics"), "a".repeat(MAX_ICS_SOURCE_BYTES));
      expect((await reader.read("limit.ics")).length).toBe(MAX_ICS_SOURCE_BYTES);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it.each([true, false])("rejects oversized Vault files before reading (indexed=%s)", async (indexed) => {
    const adapter = {
      stat: vi.fn(async () => ({ type: "file", size: MAX_ICS_SOURCE_BYTES + 1 })),
      read: vi.fn(async () => "unused"),
    };
    const vault = new FakeVault(adapter);
    if (indexed) vault.files.set("large.ics", new MockTFile("large.ics", "ics"));
    const reader = new ObsidianIcsSourceReader(vault as never);
    await expect(reader.read("large.ics")).rejects.toThrow("exceeds");
    expect(vault.cachedRead).not.toHaveBeenCalled();
    expect(adapter.read).not.toHaveBeenCalled();
  });

  it.each([true, false])("checks returned UTF-8 bytes after Vault stat (indexed=%s)", async (indexed) => {
    const content = "中".repeat(Math.ceil(MAX_ICS_SOURCE_BYTES / 3));
    const adapter = {
      stat: vi.fn(async () => ({ type: "file", size: 10 })),
      read: vi.fn(async () => content),
    };
    const vault = new FakeVault(adapter);
    vault.cachedRead.mockResolvedValue(content);
    if (indexed) vault.files.set("growing.ics", new MockTFile("growing.ics", "ics"));
    const reader = new ObsidianIcsSourceReader(vault as never);
    await expect(reader.read("growing.ics")).rejects.toThrow("exceeds");
  });

  it.each([null, { type: "file", size: NaN }, { type: "file", size: -1 }])(
    "fails closed for invalid indexed Vault metadata: %j", async (stat) => {
      const vault = new FakeVault({ stat: async () => stat });
      vault.files.set("sample.ics", new MockTFile("sample.ics", "ics"));
      const reader = new ObsidianIcsSourceReader(vault as never);
      await expect(reader.read("sample.ics")).rejects.toThrow();
      expect(vault.cachedRead).not.toHaveBeenCalled();
    },
  );

  it("propagates Vault metadata errors without reading", async () => {
    const vault = new FakeVault({ stat: async () => { throw new Error("permission denied"); } });
    vault.files.set("sample.ics", new MockTFile("sample.ics", "ics"));
    const reader = new ObsidianIcsSourceReader(vault as never);
    await expect(reader.read("sample.ics")).rejects.toThrow("permission denied");
    expect(vault.cachedRead).not.toHaveBeenCalled();
  });

  it.each(["folder", "device"])("rejects Vault %s entries without reading", async (type) => {
    const adapter = { stat: async () => ({ type, size: 0 }), read: vi.fn() };
    const reader = new ObsidianIcsSourceReader(new FakeVault(adapter) as never);
    await expect(reader.read("source.ics")).rejects.toThrow("regular file");
    expect(adapter.read).not.toHaveBeenCalled();
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
