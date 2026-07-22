import type { TFile, Vault } from "obsidian";

import type { IcsSourceReader } from "../../features/calendar/ics-event-index";

export interface ObsidianIcsSourceReaderOptions {
  readonly readLocal?: (source: string) => Promise<string>;
  readonly resolveLocal?: (basePath: string, source: string) => string | Promise<string>;
}

interface VaultFileAdapter {
  readonly exists?: (path: string) => Promise<boolean>;
  readonly read?: (path: string) => Promise<string>;
  readonly getBasePath?: () => string;
}

export class ObsidianIcsSourceReader implements IcsSourceReader {
  private readonly readLocal: (source: string) => Promise<string>;
  private readonly resolveLocal: (basePath: string, source: string) => string | Promise<string>;

  constructor(
    private readonly vault: Vault,
    options: ObsidianIcsSourceReaderOptions = {},
  ) {
    this.readLocal = options.readLocal ?? readLocalFile;
    this.resolveLocal = options.resolveLocal ?? resolveLocalPath;
  }

  async read(source: string): Promise<string> {
    const trimmed = source.trim();
    if (trimmed.length === 0) throw new Error("ICS source is empty");

    const vaultEntry = this.vault.getAbstractFileByPath(trimmed);
    if (
      vaultEntry !== null &&
      "extension" in vaultEntry &&
      typeof vaultEntry.extension === "string"
    ) {
      return this.vault.cachedRead(vaultEntry as TFile);
    }
    if (isAbsoluteLocalPath(trimmed)) return this.readLocal(trimmed);

    const adapter = this.vault.adapter as unknown as VaultFileAdapter;
    if (
      typeof adapter.exists === "function" &&
      typeof adapter.read === "function" &&
      await adapter.exists(trimmed)
    ) {
      return adapter.read(trimmed);
    }
    if (typeof adapter.getBasePath !== "function") {
      throw new Error("Relative local ICS paths require a filesystem vault");
    }
    return this.readLocal(await this.resolveLocal(adapter.getBasePath(), trimmed));
  }
}

function isAbsoluteLocalPath(source: string): boolean {
  return source.startsWith("/") || source.startsWith("\\\\") || /^[A-Za-z]:[\\/]/.test(source);
}

async function readLocalFile(source: string): Promise<string> {
  const { readFile } = getDesktopRequire()("node:fs/promises") as {
    readFile(path: string, encoding: "utf8"): Promise<string>;
  };
  return readFile(source, "utf8");
}

async function resolveLocalPath(basePath: string, source: string): Promise<string> {
  const path = getDesktopRequire()("node:path") as {
    resolve(basePath: string, source: string): string;
  };
  return path.resolve(basePath, source);
}

function getDesktopRequire(): (moduleId: string) => unknown {
  const runtimeRequire = (globalThis as { require?: unknown }).require;
  if (typeof runtimeRequire !== "function") {
    throw new Error("Local ICS files require desktop filesystem access");
  }
  return runtimeRequire as (moduleId: string) => unknown;
}
