import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

// @ts-expect-error The local tag contract is implemented in JavaScript.
import { assertLocalTagPointsToHead } from "../../scripts/local-tag-contract.mjs";
// @ts-expect-error The release contract is implemented in JavaScript.
import { assertReleaseTag } from "../../scripts/release-contract.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifest = JSON.parse(
  readFileSync(path.join(projectRoot, "manifest.json"), "utf8"),
) as { version: string };
const manifestVersion = manifest.version;
const differentVersion = manifestVersion.replace(
  /(\d+)$/u,
  (patch) => String(Number(patch) + 1),
);
const releaseCheckFiles = [
  "manifest.json",
  "package.json",
  "package-lock.json",
  "versions.json",
  "scripts/check-release-version.mjs",
  "scripts/local-tag-contract.mjs",
  "scripts/release-contract.mjs",
];
let isolatedProject: string;

beforeAll(() => {
  isolatedProject = mkdtempSync(path.join(tmpdir(), "chrono-notes-release-version-"));
  for (const relativePath of releaseCheckFiles) {
    const destination = path.join(isolatedProject, relativePath);
    mkdirSync(path.dirname(destination), { recursive: true });
    cpSync(path.join(projectRoot, relativePath), destination);
  }
  execFileSync("git", ["init"], { cwd: isolatedProject, stdio: "pipe" });
  execFileSync("git", ["config", "user.name", "Release Contract Test"], {
    cwd: isolatedProject,
  });
  execFileSync("git", ["config", "user.email", "release-contract@example.invalid"], {
    cwd: isolatedProject,
  });
  execFileSync("git", ["add", "."], { cwd: isolatedProject });
  execFileSync("git", ["commit", "-m", "test fixture"], {
    cwd: isolatedProject,
    stdio: "pipe",
  });
});

afterAll(() => {
  rmSync(isolatedProject, { recursive: true, force: true });
});

const checkReleaseVersion = (...arguments_: string[]) => execFileSync(
  process.execPath,
  ["scripts/check-release-version.mjs", ...arguments_],
  {
    cwd: isolatedProject,
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

  it("rejects leading-zero and prerelease versions", () => {
    expect(() => assertReleaseTag("00.2.1", "00.2.1")).toThrow(/leading zeroes/u);
    expect(() => checkReleaseVersion(`${manifestVersion}-rc.1`)).toThrow();
  });

  it("defaults to the manifest version when no tag is provided", () => {
    expect(checkReleaseVersion()).toContain(
      `Release version contract passed for ${manifestVersion}.`,
    );
  });

  it("allows a missing local tag and an existing tag at HEAD", async () => {
    const missingTag = Object.assign(new Error("missing"), { code: 1 });
    const missingRunner = async (_file: string, arguments_: string[]) => {
      if (arguments_[0] === "rev-parse" && arguments_.at(-1) === "HEAD") return { stdout: "head\n" };
      if (arguments_[0] === "show-ref") throw missingTag;
      throw new Error(`Unexpected git call: ${arguments_.join(" ")}`);
    };
    await expect(assertLocalTagPointsToHead(manifestVersion, missingRunner)).resolves.toBeUndefined();

    const matchingRunner = async (_file: string, arguments_: string[]) => {
      if (arguments_[0] === "show-ref") return { stdout: "" };
      return { stdout: "head\n" };
    };
    await expect(assertLocalTagPointsToHead(manifestVersion, matchingRunner)).resolves.toBeUndefined();
  });

  it("rejects an existing local tag that points to another commit", async () => {
    const runner = async (_file: string, arguments_: string[]) => {
      if (arguments_[0] === "show-ref") return { stdout: "" };
      if (arguments_.at(-1) === "HEAD") return { stdout: "head\n" };
      return { stdout: "older\n" };
    };
    await expect(assertLocalTagPointsToHead(manifestVersion, runner)).rejects.toThrow(
      `Existing tag ${manifestVersion} points to another commit`,
    );
  });
});
