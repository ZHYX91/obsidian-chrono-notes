import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

  it("leaves non-publication commands and explicit notes untouched", async () => {
    await expect(prepareReleaseArgs(".", ["validate"], {})).resolves.toEqual(["validate"]);
    await expect(prepareReleaseArgs(".", [
      "publish-github-event", "--notes-file", "custom.md",
    ], {})).resolves.toEqual([
      "publish-github-event", "--notes-file", "custom.md",
    ]);
  });
});
