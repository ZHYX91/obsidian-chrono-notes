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
  if (creationFolder.length === 0) {
    return freezeSetup(false, "creation-not-configured");
  }

  // Newly created notes are explicitly marked and visible outside the unmarked
  // scan scope. Scan diagnostics must not disable this independent action.
  const scanFolder = getIntervalNoteScanFolder(settings);
  if (scanFolder === null) return freezeSetup(true, null);
  if (scanFolder.length === 0) return freezeSetup(true, "scan-not-configured");
  return freezeSetup(true, scanFolderExists ? null : "scan-folder-missing");
}

function freezeSetup(
  canCreateVisibleItem: boolean,
  issue: IntervalListSetupIssue | null,
): IntervalListSetup {
  return Object.freeze({ canCreateVisibleItem, issue });
}
