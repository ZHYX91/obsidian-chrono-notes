import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

// @ts-expect-error The release-note helper is plain ESM.
import { extractReleaseNotes, prepareReleaseArgs } from "../../scripts/release-notes.mjs";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true }),
  ));
});

describe("release notes", () => {
  it("extracts only the requested changelog section", () => {
    expect(extractReleaseNotes([
      "# Changelog",
      "",
      "## 1.2.0",
      "",
      "### Fixed",
      "- Current fix",
      "",
      "## 1.1.0",
      "- Older fix",
      "",
    ].join("\n"), "1.2.0")).toBe("### Fixed\n- Current fix\n");
  });

  it("rejects missing and empty version sections", () => {
    expect(() => extractReleaseNotes("# Changelog\n", "1.2.0"))
      .toThrow("no section for 1.2.0");
    expect(() => extractReleaseNotes("# Changelog\n\n## 1.2.0\n\n## 1.1.0\n", "1.2.0"))
      .toThrow("section for 1.2.0 is empty");
  });

  it("materializes changelog-backed notes for GitHub event publication", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "chrono-release-notes-"));
    temporaryDirectories.push(root);
    const runnerTemp = path.join(root, "runner");
    await writeFile(path.join(root, "CHANGELOG.md"), [
      "# Changelog",
      "",
      "## 1.2.0",
      "",
      "### Fixed",
      "- Current fix",
      "",
    ].join("\n"), "utf8");

    const args = await prepareReleaseArgs(root, [
      "publish-github-event",
      "--bundle-dir", "bundle",
      "--bundle-digest", "digest",
    ], {
      GITHUB_REF_NAME: "1.2.0",
      RUNNER_TEMP: runnerTemp,
    });

    const notesIndex = args.indexOf("--notes-file");
    expect(notesIndex).toBeGreaterThan(0);
    const notesFile = args[notesIndex + 1];
    expect(notesFile).toBe(path.join(runnerTemp, "chrono-notes-1.2.0-release-notes.md"));
    if (notesFile === undefined) throw new Error("Expected generated release notes path");
    expect(await readFile(notesFile, "utf8")).toBe("### Fixed\n- Current fix\n");
  });

  it("rejects ambiguous duplicate sections", () => {
    expect(() => extractReleaseNotes("## 1.2.0\nFirst\n## 1.2.0\nSecond\n", "1.2.0"))
      .toThrow("duplicate sections for 1.2.0");
  });

  it("rejects missing and empty notes before source validation, bundling or event preflight", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "chrono-release-preflight-"));
    temporaryDirectories.push(root);
    await writeFile(path.join(root, "manifest.json"), JSON.stringify({ version: "1.2.0" }));
    const commands = ["validate", "validate-tag", "bundle",
      "event-publication-boundary", "event-publication-preflight", "publish-github-event"];
    for (const body of ["# Changelog\n", "## 1.2.0\n\n## 1.1.0\nOlder\n"]) {
      await writeFile(path.join(root, "CHANGELOG.md"), body);
      for (const command of commands) {
        await expect(prepareReleaseArgs(root, [command], { GITHUB_REF_NAME: "1.2.0" }))
          .rejects.toThrow(/(?:no section for 1\.2\.0|section for 1\.2\.0 is empty)/u);
      }
    }
    expect((await readdir(root)).sort()).toEqual(["CHANGELOG.md", "manifest.json"]);
  });

  it("validates explicit candidate versions and keeps verification read-only", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "chrono-release-validation-"));
    temporaryDirectories.push(root);
    await writeFile(path.join(root, "manifest.json"), JSON.stringify({ version: "1.1.0" }));
    await writeFile(path.join(root, "CHANGELOG.md"), "## 1.2.0\nCurrent fix\n");
    await expect(prepareReleaseArgs(root, ["validate"], {})).rejects.toThrow("no section for 1.1.0");
    const args = ["validate-tag", "--version", "1.2.0"];
    await expect(prepareReleaseArgs(root, args, {})).resolves.toEqual(args);
    const explicit = ["publish-github-event", "--notes-file", "custom.md"];
    await expect(prepareReleaseArgs(root, explicit, { GITHUB_REF_NAME: "1.2.0" }))
      .resolves.toEqual(explicit);
    expect((await readdir(root)).sort()).toEqual(["CHANGELOG.md", "manifest.json"]);
    await expect(prepareReleaseArgs(root, ["verify-transport"], {}))
      .resolves.toEqual(["verify-transport"]);
  });
});
