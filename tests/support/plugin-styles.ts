import { readFileSync } from "node:fs";

const STYLE_ENTRY = new URL("../../src/ui/styles/index.css", import.meta.url);

export function readPluginStyles(): string {
  return expandStyleSheet(STYLE_ENTRY, new Set<string>());
}

function expandStyleSheet(file: URL, activeFiles: Set<string>): string {
  if (activeFiles.has(file.href)) {
    throw new Error(`Circular CSS import: ${file.pathname}`);
  }

  activeFiles.add(file.href);
  try {
    const source = readFileSync(file, "utf8");
    return source.replace(
      /^\s*@import\s+["']([^"']+)["']\s*;\s*$/gm,
      (_statement, importPath: string) => {
        if (!importPath.startsWith(".")) {
          throw new Error(`Unsupported CSS import: ${importPath}`);
        }
        return expandStyleSheet(new URL(importPath, file), activeFiles);
      },
    );
  } finally {
    activeFiles.delete(file.href);
  }
}
