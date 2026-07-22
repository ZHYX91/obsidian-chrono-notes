import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const workflow = readFileSync(
  path.join(projectRoot, ".github", "workflows", "release.yml"),
  "utf8",
);

describe("release workflow contract", () => {
  it("keeps the loose Obsidian assets and adds one install-ready archive", () => {
    expect(workflow).toContain("dist/chrono-notes/main.js");
    expect(workflow).toContain("dist/chrono-notes/manifest.json");
    expect(workflow).toContain("dist/chrono-notes/styles.css");
    expect(workflow).toContain("chrono-notes-${GITHUB_REF_NAME}.zip");
    expect(workflow).toContain("chrono-notes/main.js");
    expect(workflow).toContain("chrono-notes/manifest.json");
    expect(workflow).toContain("chrono-notes/styles.css");
  });

  it("updates an existing tagged release without duplicating it", () => {
    expect(workflow).toContain('gh release view "$GITHUB_REF_NAME"');
    expect(workflow).toContain('gh release upload "$GITHUB_REF_NAME"');
    expect(workflow).toContain("--clobber");
    expect(workflow).toContain('gh release create "$GITHUB_REF_NAME"');
  });
});
