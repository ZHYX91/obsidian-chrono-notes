import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifest = JSON.parse(
  readFileSync(path.join(projectRoot, "manifest.json"), "utf8"),
) as { version: string };
const manifestVersion = manifest.version;
const differentVersion = manifestVersion.replace(
  /(\d+)$/u,
  (patch) => String(Number(patch) + 1),
);
const checkReleaseVersion = (...arguments_: string[]) => execFileSync(
  process.execPath,
  ["scripts/check-release-version.mjs", ...arguments_],
  {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: "pipe",
  },
);

describe("release version contract", () => {
  it("accepts the exact manifest version", () => {
    expect(checkReleaseVersion(manifestVersion)).toContain(
      `Release version contract passed for ${manifestVersion}.`,
    );
  });

  it("rejects a v-prefixed tag", () => {
    expect(() => checkReleaseVersion(`v${manifestVersion}`)).toThrow();
  });

  it("rejects a different semantic version", () => {
    expect(() => checkReleaseVersion(differentVersion)).toThrow();
  });

  it("requires a release tag", () => {
    expect(() => checkReleaseVersion()).toThrow();
  });
});
