import esbuild from "esbuild";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  artifactPaths,
  createJavascriptBuildOptions,
} from "./scripts/build-contract.mjs";

const production = process.argv[2] === "production";

await mkdir(artifactPaths.directory, { recursive: true });
await copyFile("manifest.json", artifactPaths.manifest);

const scriptContext = await esbuild.context(
  createJavascriptBuildOptions({ production }),
);

const styleContext = await esbuild.context({
  entryPoints: ["src/ui/styles/index.css"],
  bundle: true,
  charset: "utf8",
  outfile: artifactPaths.styles,
  minify: production,
  logLevel: "info",
});

if (production) {
  await mkdir(path.dirname(artifactPaths.metafile), { recursive: true });
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
