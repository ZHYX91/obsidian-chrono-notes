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

export const productionJavascriptBudgetBytes = 1_000_000;

// Last verified bundle before package-level attribution was introduced.
export const productionJavascriptReferenceBytes = 978_748;
