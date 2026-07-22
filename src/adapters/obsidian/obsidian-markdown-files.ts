import type { TAbstractFile, TFile } from "obsidian";

export function isMarkdownFile(file: TAbstractFile | null): file is TFile {
  return (
    file !== null &&
    "extension" in file &&
    typeof file.extension === "string" &&
    file.extension.toLowerCase() === "md"
  );
}
