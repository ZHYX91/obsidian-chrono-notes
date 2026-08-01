import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const workflow = readFileSync(
  path.join(projectRoot, ".github", "workflows", "release.yml"),
  "utf8",
);
const ciWorkflow = readFileSync(
  path.join(projectRoot, ".github", "workflows", "ci.yml"),
  "utf8",
);

describe("release workflow contract", () => {
  it("keeps the loose Obsidian assets and adds one install-ready archive", () => {
    expect(workflow).toContain("dist/main.js");
    expect(workflow).toContain("dist/manifest.json");
    expect(workflow).toContain("dist/styles.css");
    expect(workflow).toContain("chrono-notes-${RELEASE_VERSION}.zip");
    expect(workflow).toContain("node scripts/release-assets.mjs archive");
  });

  it("offers a default-branch-only pre-tag preflight without publishing", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("version:");
    expect(workflow).toContain("Release preflight must run from the repository default branch.");
    expect(workflow).toContain(
      "Release preflight must run at the current remote default-branch HEAD.",
    );
    expect(workflow).toContain(
      "Release preflight requires a version whose remote tag does not exist.",
    );
    expect(workflow).toMatch(
      /Run release gates[\s\S]*Build manual installation archive[\s\S]*Verify read-only preflight source identity/u,
    );
  });

  it("keeps dispatch preflight read-only and grants writes only to tag publication", () => {
    const preflightStart = workflow.indexOf("\n  preflight:");
    const publishStart = workflow.indexOf("\n  publish:");
    expect(preflightStart).toBeGreaterThan(-1);
    expect(publishStart).toBeGreaterThan(preflightStart);
    const preflightJob = workflow.slice(preflightStart, publishStart);
    const publishJob = workflow.slice(publishStart);

    expect(preflightJob).toContain("if: github.event_name == 'workflow_dispatch'");
    expect(preflightJob).toContain("permissions:\n      contents: read");
    expect(preflightJob).not.toContain("attestations: write");
    expect(preflightJob).not.toContain("contents: write");
    expect(preflightJob).not.toContain("id-token: write");
    expect(publishJob).toContain("if: github.event_name == 'push'");
    expect(publishJob).toContain("attestations: write");
    expect(publishJob).toContain("contents: write");
    expect(publishJob).toContain("id-token: write");
  });

  it("serializes all release versions for the repository", () => {
    expect(workflow).toContain("group: release-${{ github.repository }}");
    expect(workflow).toContain("cancel-in-progress: false");
    expect(workflow).not.toContain("group: release-${{ github.ref }}");
  });

  it("pins one exact runtime contract in CI and release", () => {
    expect(ciWorkflow).toContain("node-version-file: .node-version");
    expect(workflow).toContain("node-version-file: .node-version");
    expect(workflow).toContain("version: 11.9.0");
    expect(workflow).toContain("fetch-depth: 0");
    expect(ciWorkflow).toMatch(/Verify runtime contract[\s\S]*pnpm install --frozen-lockfile/u);
    expect(workflow).toMatch(/Verify runtime contract[\s\S]*pnpm install --frozen-lockfile/u);
    expect(workflow).not.toMatch(/node-version:\s*24\s*$/mu);
  });

  it("requires a release commit to remain reachable from the remote default branch", () => {
    expect(workflow).toContain(
      "DEFAULT_BRANCH: ${{ github.event.repository.default_branch }}",
    );
    expect(workflow).toContain('git ls-remote --exit-code origin "$remote_default_ref"');
    expect(workflow).toContain(
      'git merge-base --is-ancestor "$expected_commit" "$remote_default_commit"',
    );
    expect(workflow).toContain(
      "The release commit is not reachable from the current remote default branch.",
    );
  });

  it("treats only an explicit REST 404 as a missing tagged Release", () => {
    expect(workflow.match(/releases\/tags\/\$\{RELEASE_VERSION\}/gu)).toHaveLength(2);
    expect(workflow).toContain('--write-out "%{http_code}"');
    expect(workflow).toContain('case "$release_status" in');
    expect(workflow).toContain('"404")');
    expect(workflow).toContain('"Could not query the tagged Release (HTTP ${release_status})."');
    expect(workflow).not.toContain('gh release view "$RELEASE_VERSION"');
  });

  it("accepts an existing tagged Release only when immutable assets match", () => {
    expect(workflow).toContain(
      "'.immutable == true and .draft == false and .prerelease == false'",
    );
    expect(workflow).toContain('gh release download "$RELEASE_VERSION"');
    expect(workflow).toContain("node scripts/release-assets.mjs compare");
    expect(workflow).toContain('echo "exists=true" >> "$GITHUB_OUTPUT"');
    expect(workflow).toContain(
      "if: github.event_name == 'push' && steps.release_state.outputs.exists != 'true'",
    );
    expect(workflow).toContain('gh release create "$RELEASE_VERSION"');
    expect(workflow).not.toContain("gh release upload");
    expect(workflow).not.toContain("--clobber");
    expect(workflow).not.toContain("--draft");
    expect(workflow).not.toContain("gh release edit");
  });

  it("requires the existing Release asset inventory to be exactly four unique files", () => {
    expect(workflow).toContain('archive_name="chrono-notes-${RELEASE_VERSION}.zip"');
    expect(workflow).toContain('(.assets | type == "array")');
    expect(workflow).toContain(
      '([.assets[].name] | sort) ==\n                  (["main.js", "manifest.json", "styles.css", $archive_name] | sort)',
    );
    expect(workflow).toContain('([.assets[].name] | unique | length) == 4');
    expect(workflow).toContain(
      '"The tagged Release asset inventory is not exactly the four expected files; publish a new version."',
    );
  });

  it("verifies the exact published immutable asset bytes after publication", () => {
    expect(workflow).toContain('gh release create "$RELEASE_VERSION" "${assets[@]}"');
    expect(workflow).not.toContain("--draft");
    expect(workflow).not.toContain("gh release edit");
    expect(workflow).toContain("verify_release_assets() {");
    expect(workflow).toContain(".draft == $expected_draft");
    expect(workflow).toContain(".immutable == $expected_immutable");
    expect(workflow).toContain(".prerelease == false and");
    expect(workflow).toContain('"published"');
    expect(workflow).toContain("Release supply-chain verification failed");
    expect(workflow.match(/node scripts\/release-assets\.mjs compare/gu)).toHaveLength(2);
    expect(workflow).toMatch(
      /gh release create[\s\S]*?verify_release_assets[\s\S]*?verify_release_tag_identity/u,
    );
  });

  it("fails closed when the pushed version tag no longer identifies the event commit", () => {
    expect(workflow).toContain('git rev-parse "${GITHUB_SHA}^{commit}"');
    expect(workflow).toContain('git rev-parse "HEAD^{commit}"');
    expect(workflow).toContain(
      'git ls-remote --exit-code origin "$tag_ref" "${tag_ref}^{}"',
    );
    expect(workflow).toContain('awk -v ref="${tag_ref}^{}"');
    expect(workflow).toContain(
      '"The remote release tag no longer points to the pushed event commit."',
    );
    expect(workflow.match(/^\s+verify_release_tag_identity$/gmu)).toHaveLength(4);
  });

  it("generates notes from the highest older real stable Release", () => {
    expect(workflow).toContain("gh api --paginate --slurp");
    expect(workflow).toContain("scripts/release-notes-baseline.mjs");
    expect(workflow).toContain('--current-version "$RELEASE_VERSION"');
    expect(workflow).toContain(
      'notes_arguments+=(--notes-start-tag "$PREVIOUS_RELEASE_TAG")',
    );
    expect(workflow).toContain(
      "The previous published Release is not an ancestor of this release.",
    );
  });

  it("attests every published release asset", () => {
    expect(workflow).toContain("attestations: write");
    expect(workflow).toContain("id-token: write");
    expect(workflow).toContain("dist/main.js");
    expect(workflow).toContain("dist/manifest.json");
    expect(workflow).toContain("dist/styles.css");
    expect(workflow).toContain(
      "dist/chrono-notes-${{ env.RELEASE_VERSION }}.zip",
    );
  });

  it("pins every third-party Action to a full commit SHA", () => {
    for (const source of [ciWorkflow, workflow]) {
      const actionUses = [...source.matchAll(/^\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/gmu)].map(
        (match) => match[1],
      );
      expect(actionUses.length).toBeGreaterThan(0);
      expect(
        actionUses.every((value) => /@[a-f\d]{40}$/u.test(value ?? "")),
      ).toBe(true);
    }
  });
});
