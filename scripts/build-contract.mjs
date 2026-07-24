export const artifactPaths = Object.freeze({
  directory: "dist",
  main: "dist/main.js",
  manifest: "dist/manifest.json",
  metafile: "dist/chrono-notes.meta.json",
  styles: "dist/styles.css",
});

export const externalModules = Object.freeze([
  "obsidian",
  "electron",
  "@electron/remote",
]);

// Explicit MessageKey mappings add about 52 KB over the positional 0.2.0
// catalogs. The 1.25 MB gate leaves roughly 5-10% maintenance headroom after
// that measured correctness improvement without making dependency growth free.
export const productionJavascriptBudgetBytes = 1_250_000;

// Published 0.1.2 production artifact before the multilingual 0.2.0 work.
export const productionJavascriptReferenceBytes = 991_182;
