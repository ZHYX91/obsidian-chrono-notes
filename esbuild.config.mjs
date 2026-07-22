import esbuild from "esbuild";
import { copyFile, mkdir, writeFile } from "node:fs/promises";

import {
  artifactPaths,
  externalModules,
} from "./scripts/build-contract.mjs";

const production = process.argv[2] === "production";
const nodeEnvironment = production ? "production" : "development";

await mkdir(artifactPaths.directory, { recursive: true });
await copyFile("manifest.json", artifactPaths.manifest);

const scriptContext = await esbuild.context({
  entryPoints: ["main.ts"],
  bundle: true,
  charset: "utf8",
  define: {
    "process.env.NODE_ENV": JSON.stringify(nodeEnvironment),
  },
  external: externalModules,
  format: "cjs",
  platform: "browser",
  target: "es2022",
  outfile: artifactPaths.main,
  sourcemap: production ? false : "inline",
  minify: production,
  metafile: production,
  logLevel: "info",
});

const styleContext = await esbuild.context({
  entryPoints: ["src/ui/styles/index.css"],
  bundle: true,
  charset: "utf8",
  outfile: artifactPaths.styles,
  minify: production,
  logLevel: "info",
});

if (production) {
  const [scriptResult] = await Promise.all([
    scriptContext.rebuild(),
    styleContext.rebuild(),
  ]);
  if (scriptResult.metafile === undefined) {
    throw new Error("Production build did not produce an esbuild metafile");
  }
  await writeFile(
    artifactPaths.metafile,
    `${JSON.stringify(scriptResult.metafile, null, 2)}\n`,
    "utf8",
  );
  await Promise.all([
    scriptContext.dispose(),
    styleContext.dispose(),
  ]);
} else {
  await Promise.all([
    scriptContext.watch(),
    styleContext.watch(),
  ]);
}
