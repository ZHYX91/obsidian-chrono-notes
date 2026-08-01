import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import esbuild from "esbuild";

import {
  artifactPaths,
  createJavascriptBuildOptions,
} from "./build-contract.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const productionOutputPath = path.resolve(projectRoot, artifactPaths.main);

export async function verifyProductionBundleRebuild({
  build = esbuild.build,
  expectedPath = productionOutputPath,
} = {}) {
  const expected = await readFile(expectedPath);
  const result = await build({
    ...createJavascriptBuildOptions({ logLevel: "silent", production: true }),
    write: false,
  });
  const rebuilt = result.outputFiles?.find(
    (output) => path.resolve(output.path) === productionOutputPath,
  );
  assert.ok(rebuilt, "Independent production rebuild did not return main.js in memory");
  assert.deepEqual(
    Buffer.from(rebuilt.contents),
    expected,
    "Independent production rebuild differs byte-for-byte from dist/main.js",
  );
  return expected.length;
}
