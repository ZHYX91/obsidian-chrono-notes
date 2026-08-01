import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

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
  it("is valid YAML with the three explicit release jobs", () => {
    const parsed = parseYaml(workflow) as { jobs?: Record<string, unknown> };
    expect(Object.keys(parsed.jobs ?? {})).toEqual([
      "preflight",
      "prepare-release",
      "publish",
    ]);
  });

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
    const prepareStart = workflow.indexOf("\n  prepare-release:");
    const publishStart = workflow.indexOf("\n  publish:");
    expect(preflightStart).toBeGreaterThan(-1);
    expect(prepareStart).toBeGreaterThan(preflightStart);
    expect(publishStart).toBeGreaterThan(prepareStart);
    const preflightJob = workflow.slice(preflightStart, prepareStart);
    const prepareJob = workflow.slice(prepareStart, publishStart);
    const publishJob = workflow.slice(publishStart);

    expect(preflightJob).toContain("if: github.event_name == 'workflow_dispatch'");
    expect(preflightJob).toContain("permissions:\n      contents: read");
    expect(preflightJob).not.toContain("attestations: write");
    expect(preflightJob).not.toContain("contents: write");
    expect(preflightJob).not.toContain("id-token: write");
    expect(preflightJob).toContain("Validate published version history and release-notes baseline");
    expect(prepareJob).toContain("permissions:\n      contents: read");
    expect(prepareJob).not.toContain("contents: write");
    expect(prepareJob).toContain("persist-credentials: false");
    expect(publishJob).toContain("if: github.event_name == 'push'");
    expect(publishJob).toContain("needs: prepare-release");
    expect(publishJob).toContain("attestations: write");
    expect(publishJob).toContain("contents: write");
    expect(publishJob).toContain("id-token: write");
    expect(publishJob).not.toContain("actions/checkout@");
    expect(publishJob).not.toContain("actions/setup-node@");
    expect(publishJob).not.toContain("pnpm install");
    expect(publishJob).not.toContain("node scripts/");
    expect(publishJob).toMatch(
      /steps:\n\s+- name: Reverify release identity before using write credentials/u,
    );
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
    expect(workflow).toContain(".immutable == true and .draft == false and .prerelease == false");
    expect(workflow).toContain('gh release download "$RELEASE_VERSION"');
    expect(workflow).toContain('cmp "$RUNNER_TEMP/release-candidate/$asset" "$existing/$asset"');
    expect(workflow).toContain('gh attestation verify "$existing/$asset"');
    expect(workflow).toContain(
      '--signer-workflow "github.com/${GITHUB_REPOSITORY}/.github/workflows/release.yml"',
    );
    expect(workflow.match(/--deny-self-hosted-runners/gu)).toHaveLength(2);
    expect(workflow).toContain('--source-digest "$RELEASE_COMMIT"');
    expect(workflow).toContain('echo "exists=true" >> "$GITHUB_OUTPUT"');
    expect(workflow).toContain("if: steps.release_state.outputs.exists != 'true'");
    expect(workflow).toContain("Reverify tag after accepting an existing no-op");
    expect(workflow).toContain('gh release create "$RELEASE_VERSION"');
    expect(workflow).not.toContain("gh release upload");
    expect(workflow).not.toContain("--clobber");
    expect(workflow).not.toContain("--draft");
    expect(workflow).not.toContain("gh release edit");
  });

  it("requires the existing Release asset inventory to be exactly four unique files", () => {
    expect(workflow).toContain('archive_name="chrono-notes-${RELEASE_VERSION}.zip"');
    expect(workflow).toContain(
      '([.assets[].name] | sort) == (["main.js", "manifest.json", "styles.css", $archive_name] | sort)',
    );
    expect(workflow).toContain('([.assets[].name] | unique | length) == 4');
    expect(workflow).toContain(
      '"The tagged Release is not the exact immutable stable contract; publish a new version."',
    );
  });

  it("verifies the exact published immutable asset bytes after publication", () => {
    expect(workflow).toContain('gh release create "$RELEASE_VERSION" "${assets[@]}"');
    expect(workflow).not.toContain("--draft");
    expect(workflow).not.toContain("gh release edit");
    expect(workflow).toContain("for attempt in {1..10}");
    expect(workflow).toContain('$release_status" != "404"');
    expect(workflow).toContain("non-retryable HTTP");
    expect(workflow).toContain("after bounded retries");
    expect(workflow).toContain('cmp "$candidate/$asset" "$remote/$asset"');
    expect(workflow).toContain('gh attestation verify "$remote/$asset"');
    expect(workflow).toContain("The release tag changed after publication verification.");
  });

  it("fails closed when the pushed version tag no longer identifies the event commit", () => {
    expect(workflow).toContain('git rev-parse "${GITHUB_SHA}^{commit}"');
    expect(workflow).toContain('git rev-parse "HEAD^{commit}"');
    expect(workflow).toContain(
      'git ls-remote --exit-code origin "$tag_ref" "${tag_ref}^{}"',
    );
    expect(workflow).toContain('awk -v peeled="${tag_ref}^{}"');
    expect(workflow).toContain(
      '"The remote release tag no longer points to the pushed event commit."',
    );
    expect(workflow).toContain("Reverify release identity before using write credentials");
    expect(workflow).toContain("Reverify tag after accepting an existing no-op");
  });

  it("generates notes from the highest older real stable Release", () => {
    expect(workflow.match(/gh api --paginate --slurp/gu)).toHaveLength(2);
    expect(workflow.match(/scripts\/release-notes-baseline\.mjs/gu)).toHaveLength(2);
    expect(workflow).toContain('--current-version "$RELEASE_VERSION"');
    expect(workflow).toContain(
      'notes_arguments+=(--notes-start-tag "$PREVIOUS_RELEASE_TAG")',
    );
    expect(workflow).toContain(
      "The previous published Release is not an ancestor of this release.",
    );
  });

  it("hands an exact current-attempt candidate from read-only prepare to publish", () => {
    expect(workflow).toContain(
      'artifact_name="release-candidate-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"',
    );
    expect(workflow).toContain(
      "candidate_artifact_id: ${{ steps.upload_candidate.outputs.artifact-id }}",
    );
    expect(workflow).toContain(
      "candidate_artifact_digest: ${{ steps.upload_candidate.outputs.artifact-digest }}",
    );
    expect(workflow).toContain(
      'expected_artifact_name="release-candidate-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"',
    );
    expect(workflow).toContain(
      '"/repos/${GITHUB_REPOSITORY}/actions/artifacts/${CANDIDATE_ARTIFACT_ID}"',
    );
    expect(workflow).toContain(".workflow_run.id == $run_id");
    expect(workflow).toContain(".workflow_run.head_sha == $release_commit");
    expect(workflow).toContain(
      '"${GITHUB_API_URL}/repos/${GITHUB_REPOSITORY}/actions/artifacts/${CANDIDATE_ARTIFACT_ID}/zip"',
    );
    expect(workflow).toContain(
      'if [[ "$downloaded_digest" != "$CANDIDATE_ARTIFACT_DIGEST" ]]',
    );
    expect(workflow).toContain(
      'if [[ ! "$CANDIDATE_ARTIFACT_DIGEST" =~ ^[0-9a-f]{64}$ ]]',
    );
    expect(workflow).toContain(
      '(.digest == $artifact_digest or .digest == ("sha256:" + $artifact_digest))',
    );
    expect(workflow).toContain(
      'python3 - "$artifact_zip" "$candidate" "$RELEASE_VERSION"',
    );
    expect(workflow).not.toContain('unzip -q "$artifact_zip"');
    expect(workflow).not.toContain('gh run download "$GITHUB_RUN_ID"');
  });

  it("keeps one extractable inline validator as the publish ZIP trust boundary", () => {
    expect(workflow.match(/# RELEASE_ZIP_VALIDATOR_BEGIN/gmu)).toHaveLength(1);
    expect(workflow.match(/# RELEASE_ZIP_VALIDATOR_END/gmu)).toHaveLength(1);
    expect(workflow).not.toContain("extractall(");
    expect(workflow).not.toContain("unzip -p");
  });

  it("attests every published release asset", () => {
    expect(workflow).toContain("attestations: write");
    expect(workflow).toContain("id-token: write");
    expect(workflow).toContain("${{ runner.temp }}/release-candidate/main.js");
    expect(workflow).toContain("${{ runner.temp }}/release-candidate/manifest.json");
    expect(workflow).toContain("${{ runner.temp }}/release-candidate/styles.css");
    expect(workflow).toContain(
      "${{ runner.temp }}/release-candidate/chrono-notes-${{ env.RELEASE_VERSION }}.zip",
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
