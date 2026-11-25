import { compactMessageKeys } from "./compact-message-keys.mjs";

export const artifactPaths = Object.freeze({
  directory: "dist",
  main: "dist/main.js",
  manifest: "dist/manifest.json",
  metafile: "build/chrono-notes.meta.json",
  styles: "dist/styles.css",
});

export const externalModules = Object.freeze([
  "obsidian",
  "electron",
  "@electron/remote",
]);

export function createJavascriptBuildOptions({
  production,
  logLevel = "info",
} = {}) {
  const nodeEnvironment = production ? "production" : "development";
  return {
    bundle: true,
    charset: "utf8",
    define: {
      "process.env.NODE_ENV": JSON.stringify(nodeEnvironment),
    },
    entryPoints: ["main.ts"],
    external: externalModules,
    format: "cjs",
    logLevel,
    metafile: production,
    minify: production,
    outfile: artifactPaths.main,
    platform: "browser",
    plugins: production ? [compactMessageKeys()] : [],
    sourcemap: production ? false : "inline",
    target: "es2022",
  };
}

// Keep bounded headroom for the complete language catalogs and maintained
// features. Review dependency growth using the production build metafile.
export const productionJavascriptBudgetBytes = 1_900_000;

// Published 0.1.2 production artifact before the multilingual 0.2.0 work.
export const productionJavascriptReferenceBytes = 991_182;
