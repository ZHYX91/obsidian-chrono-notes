export const artifactPaths = Object.freeze({
  directory: "dist/chrono-notes",
  main: "dist/chrono-notes/main.js",
  manifest: "dist/chrono-notes/manifest.json",
  metafile: "dist/chrono-notes.meta.json",
  styles: "dist/chrono-notes/styles.css",
});

export const externalModules = Object.freeze([
  "obsidian",
  "electron",
  "@electron/remote",
]);

// 0.2.0 adds five complete static UI catalogs. Their measured contribution is
// about 97 KB; the budget keeps roughly 50 KB of headroom without hiding that
// intentional product cost behind an arbitrary dependency increase.
export const productionJavascriptBudgetBytes = 1_150_000;

// Published 0.1.2 production artifact before the multilingual 0.2.0 work.
export const productionJavascriptReferenceBytes = 991_182;
