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

// The pre-maintenance HEAD produced 1,247,458 B, leaving only 2,542 B (0.20%)
// under the old gate. The 1.35 MB gate restores about 6% measured maintenance
// headroom after the scoped index/cache UI without treating dependency growth as free.
export const productionJavascriptBudgetBytes = 1_350_000;

// Published 0.1.2 production artifact before the multilingual 0.2.0 work.
export const productionJavascriptReferenceBytes = 991_182;
