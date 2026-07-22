import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
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
    expect(checkReleaseVersion("0.1.1")).toContain(
      "Release version contract passed for 0.1.1.",
    );
  });

  it("rejects a v-prefixed tag", () => {
    expect(() => checkReleaseVersion("v0.1.1")).toThrow();
  });

  it("rejects a different semantic version", () => {
    expect(() => checkReleaseVersion("0.1.2")).toThrow();
  });

  it("requires a release tag", () => {
    expect(() => checkReleaseVersion()).toThrow();
  });
});
