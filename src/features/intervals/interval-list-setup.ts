import { normalizeIntervalNoteFolder } from "../../core/note/interval-note-spec";
import type { RangeNoteSettings } from "../../shared/settings";

export type IntervalListSetupIssue =
  | "creation-not-configured"
  | "scan-not-configured"
  | "scan-folder-missing"
  | "creation-outside-scope";

export interface IntervalListSetup {
  readonly canCreateVisibleItem: boolean;
  readonly issue: IntervalListSetupIssue | null;
}

export function getIntervalNoteScanFolder(
  settings: Readonly<RangeNoteSettings>,
): string | null {
  if (settings.scanScope === "entire-vault") return null;
  return normalizeIntervalNoteFolder(
    settings.scanScope === "custom-folder" ? settings.customFolder : settings.folder,
  );
}

export function getIntervalListSetup(
  settings: Readonly<RangeNoteSettings>,
  scanFolderExists: boolean,
): IntervalListSetup {
  const creationFolder = normalizeIntervalNoteFolder(settings.folder);
  const creationConfigured = creationFolder.length > 0;

  if (settings.scanScope === "entire-vault") {
    return freezeSetup(
      creationConfigured,
      creationConfigured ? null : "creation-not-configured",
    );
  }

  if (settings.scanScope === "range-folder") {
    if (!creationConfigured) {
      return freezeSetup(false, "creation-not-configured");
    }
    return freezeSetup(
      true,
      scanFolderExists ? null : "scan-folder-missing",
    );
  }

  const scanFolder = normalizeIntervalNoteFolder(settings.customFolder);
  if (scanFolder.length === 0) {
    return freezeSetup(false, "scan-not-configured");
  }
  if (!creationConfigured) {
    return freezeSetup(false, "creation-not-configured");
  }
  if (!isSameFolderOrNested(creationFolder, scanFolder)) {
    return freezeSetup(false, "creation-outside-scope");
  }
  if (!scanFolderExists) {
    return freezeSetup(true, "scan-folder-missing");
  }
  return freezeSetup(true, null);
}

function freezeSetup(
  canCreateVisibleItem: boolean,
  issue: IntervalListSetupIssue | null,
): IntervalListSetup {
  return Object.freeze({ canCreateVisibleItem, issue });
}

function isSameFolderOrNested(folder: string, scopeFolder: string): boolean {
  return folder === scopeFolder || folder.startsWith(`${scopeFolder}/`);
}
