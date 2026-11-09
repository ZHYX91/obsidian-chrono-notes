import { TFile, type Vault } from "obsidian";

import { MAX_ICS_SOURCE_BYTES } from "../../core/calendar/ics-calendar";
import type { IcsSourceReader } from "../../features/calendar/ics-event-index";
import { OperationError } from "../../shared/operation-error";

export interface ObsidianIcsSourceReaderOptions {
  readonly readLocal?: (source: string) => Promise<string>;
  readonly resolveLocal?: (basePath: string, source: string) => string | Promise<string>;
}

interface VaultFileAdapter {
  readonly stat?: (path: string) => Promise<{ type: string; size: number } | null>;
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
    if (trimmed.length === 0) throw new OperationError("icsEmptySource", "ICS source is empty");

    const vaultEntry = this.vault.getAbstractFileByPath(trimmed);
    const adapter = this.vault.adapter as unknown as VaultFileAdapter;
    if (vaultEntry instanceof TFile) {
      await checkVaultFile(adapter, trimmed);
      return checkContent(await this.vault.cachedRead(vaultEntry));
    }
    if (isAbsoluteLocalPath(trimmed)) return checkContent(await this.readLocal(trimmed));

    if (
      typeof adapter.stat === "function" &&
      typeof adapter.read === "function" &&
      await adapter.stat(trimmed) !== null
    ) {
      await checkVaultFile(adapter, trimmed);
      return checkContent(await adapter.read(trimmed));
    }
    if (typeof adapter.getBasePath !== "function") {
      throw new OperationError(
        "icsVaultFileRequired", "Relative local ICS paths require a filesystem vault",
      );
    }
    return checkContent(await this.readLocal(await this.resolveLocal(adapter.getBasePath(), trimmed)));
  }
}

function isAbsoluteLocalPath(source: string): boolean {
  return source.startsWith("/") || source.startsWith("\\\\") || /^[A-Za-z]:[\\/]/.test(source);
}

function checkSize(size: number): void {
  if (!Number.isSafeInteger(size) || size < 0) throw new Error("Invalid ICS file size");
  if (size > MAX_ICS_SOURCE_BYTES) {
    throw new RangeError(`ICS source exceeds ${MAX_ICS_SOURCE_BYTES} bytes`);
  }
}

function checkContent(content: string): string {
  // Bound the validation allocation too, including when a host returns stale metadata.
  const bytes = new Uint8Array(Math.min(content.length * 3, MAX_ICS_SOURCE_BYTES + 1));
  const { read, written } = new TextEncoder().encodeInto(content, bytes);
  if (read !== content.length || written > MAX_ICS_SOURCE_BYTES) {
    throw new RangeError(`ICS source exceeds ${MAX_ICS_SOURCE_BYTES} bytes`);
  }
  return content;
}

async function checkVaultFile(adapter: VaultFileAdapter, source: string): Promise<void> {
  const stat = await adapter.stat?.(source);
  if (stat?.type !== "file") throw new Error("ICS source must be a regular file");
  checkSize(stat.size);
}

async function readLocalFile(source: string): Promise<string> {
  const desktopRequire = getDesktopRequire();
  const fs = desktopRequire("node:fs/promises") as typeof import("node:fs/promises");
  const { constants } = desktopRequire("node:fs") as typeof import("node:fs");
  // Avoid opening known devices/FIFOs. O_NONBLOCK also protects the stat/open race
  // on POSIX; on Windows this flag is zero and normal file opens remain supported.
  const initial = await fs.stat(source);
  if (!initial.isFile()) throw new Error("ICS source must be a regular file");
  checkSize(initial.size);
  const handle = await fs.open(source, constants.O_RDONLY | constants.O_NONBLOCK);
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error("ICS source must be a regular file");
    checkSize(stat.size);
    const bytes = new Uint8Array(MAX_ICS_SOURCE_BYTES + 1);
    let length = 0;
    while (length < bytes.length) {
      const { bytesRead } = await handle.read(
        bytes, length, Math.min(64 * 1024, bytes.length - length), length,
      );
      if (bytesRead === 0) break;
      length += bytesRead;
    }
    checkSize(length);
    return new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes.subarray(0, length));
  } finally {
    await handle.close();
  }
}

async function resolveLocalPath(basePath: string, source: string): Promise<string> {
  const path = getDesktopRequire()("node:path") as {
    resolve(basePath: string, source: string): string;
  };
  return path.resolve(basePath, source);
}

function getDesktopRequire(): (moduleId: string) => unknown {
  const runtimeRequire = (window as Window & { require?: unknown }).require;
  if (typeof runtimeRequire !== "function") {
    throw new OperationError(
      "icsVaultFileRequired", "Local ICS files require desktop filesystem access",
    );
  }
  return runtimeRequire as (moduleId: string) => unknown;
}
