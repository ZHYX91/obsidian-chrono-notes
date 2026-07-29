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
    expect(workflow).toContain("dist/main.js");
    expect(workflow).toContain("dist/manifest.json");
    expect(workflow).toContain("dist/styles.css");
    expect(workflow).toContain("chrono-notes-${GITHUB_REF_NAME}.zip");
    expect(workflow).toContain("node scripts/release-assets.mjs archive");
  });

  it("treats an existing tagged Release as immutable", () => {
    expect(workflow).toContain('release_status="$(curl');
    expect(workflow).toContain('200)');
    expect(workflow).toContain('404)');
    expect(workflow).toContain('GitHub Release query failed with HTTP ${release_status}.');
    expect(workflow.match(/--json isImmutable/gu)).toHaveLength(2);
    expect(workflow).toContain('exists but is not immutable; publish a new version.');
    expect(workflow).toContain('Published Release ${GITHUB_REF_NAME} is not immutable.');
    expect(workflow).toContain('gh release download "$GITHUB_REF_NAME"');
    expect(workflow).toContain("node scripts/release-assets.mjs compare");
    expect(workflow).toContain('echo "exists=true" >> "$GITHUB_OUTPUT"');
    expect(workflow).toContain("if: steps.release_state.outputs.exists != 'true'");
    expect(workflow).toContain('gh release create "$GITHUB_REF_NAME"');
    expect(workflow).not.toContain("gh release upload");
    expect(workflow).not.toContain("--clobber");
    expect(workflow).not.toMatch(/if gh release view[\s\S]*?else/gu);
  });

  it("attests every published release asset", () => {
    expect(workflow).toContain("attestations: write");
    expect(workflow).toContain("id-token: write");
    expect(workflow).toContain("uses: actions/attest@v4");
    expect(workflow).toContain("dist/main.js");
    expect(workflow).toContain("dist/manifest.json");
    expect(workflow).toContain("dist/styles.css");
    expect(workflow).toContain(
      "dist/chrono-notes-${{ github.ref_name }}.zip",
    );
  });
});
