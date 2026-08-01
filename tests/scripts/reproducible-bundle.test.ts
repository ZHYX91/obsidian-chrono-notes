import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

// @ts-expect-error The production rebuild gate is implemented in JavaScript.
import { verifyProductionBundleRebuild } from "../../scripts/verify-production-rebuild.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const productionOutputPath = path.join(projectRoot, "dist", "main.js");
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true })
    ),
  );
});

describe("production bundle byte rebuild gate", () => {
  it("uses the controlled production configuration and compares an in-memory output", async () => {
    const expectedPath = await writeExpectedBundle("exact bytes\n");
    let receivedOptions: Record<string, unknown> | undefined;

    await expect(verifyProductionBundleRebuild({
      build: async (options: Record<string, unknown>) => {
        receivedOptions = options;
        return {
          outputFiles: [{
            contents: Buffer.from("exact bytes\n"),
            path: productionOutputPath,
          }],
        };
      },
      expectedPath,
    })).resolves.toBe(12);

    expect(receivedOptions).toMatchObject({
      bundle: true,
      charset: "utf8",
      entryPoints: ["main.ts"],
      format: "cjs",
      metafile: true,
      minify: true,
      outfile: "dist/main.js",
      platform: "browser",
      sourcemap: false,
      target: "es2022",
      write: false,
    });
  });

  it("fails when the independent in-memory rebuild differs by one byte", async () => {
    const expectedPath = await writeExpectedBundle("expected\n");

    await expect(verifyProductionBundleRebuild({
      build: async () => ({
        outputFiles: [{
          contents: Buffer.from("expecteD\n"),
          path: productionOutputPath,
        }],
      }),
      expectedPath,
    })).rejects.toThrow(
      "Independent production rebuild differs byte-for-byte from dist/main.js",
    );
  });
});

async function writeExpectedBundle(content: string): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "chrono-bundle-rebuild-"));
  temporaryDirectories.push(directory);
  const expectedPath = path.join(directory, "main.js");
  await writeFile(expectedPath, content, "utf8");
  return expectedPath;
}
