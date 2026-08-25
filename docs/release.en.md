---
source_language: zh-CN
translation_of: release.zh-CN.md
translation_status: synced
---

# Release procedure

## 1. Purpose and boundary

This procedure defines the candidate, preflight, publication, hosted-asset verification, and recovery boundary for stable Chrono Notes versions. It is a maintainer operating contract; it does not mean that any version has been published and does not authorize deployment to an ordinary or production Vault.

Releases use numeric stable versions in the form `x.y.z`. Source checks, candidate artifacts, GitHub-hosted artifacts, Obsidian host acceptance, and production-Vault deployment are separate evidence layers. Passing one layer does not establish any later layer.

## 2. Version consistency

Before publication, choose one new exact `x.y.z` version and make these values identical:

- `version` in `manifest.json`;
- `version` in `package.json`;
- the minimum Obsidian version mapped from that version in `versions.json`;
- the numeric Git tag to be created;
- `dist/manifest.json`;
- the manual-installation archive name, `chrono-notes-x.y.z.zip`.

`.node-version` and `package.json` pin Node.js, while `package.json` pins npm. Do not run release gates with different versions. A changelog version without a corresponding local tag remains under `Unreleased`; advancing source manifests does not establish publication.

Run `node scripts/check-release-version.mjs "x.y.z"` to validate the version contract; omitting the argument checks the version in `manifest.json`. The checker validates the manifest, package, package-lock.json, and `versions.json`. A missing local same-version tag is allowed, but an existing one must resolve exactly to `HEAD`, so `npm run release:check` cannot approve reuse of a tag from another commit. The version must be strictly newer than existing published versions and the remote tag must not exist. Preflight must also establish that the candidate commit is the current remote default-branch HEAD and that the preceding published Release is its ancestor.

## 3. Exact candidate

A candidate is built from one identified commit by one workflow attempt. The preparation stage installs the frozen dependency graph and runs the complete release gates:

```sh
npm ci
npm run release:check
node scripts/release-assets.mjs archive --version "x.y.z"
```

The standard candidate contains exactly `main.js`, `manifest.json`, `styles.css`, and `chrono-notes-x.y.z.zip`. The archive contains only the first three installable assets, byte-identical to their loose counterparts. Preparation generates `SHA256SUMS` for all four assets and binds the candidate artifact ID, name, server digest, workflow run, attempt, and release commit. Publication must not rebuild it or substitute artifacts from another attempt.

If an immutable same-tag Release already exists, it is an acceptable no-op only when its tag commit, four asset names and bytes, and provenance all match exactly. Any difference requires a new version; an existing stable Release must not be overwritten.

## 4. Read-only preflight

Before creating a tag, manually dispatch the Release workflow from the exact candidate commit on the remote default branch and enter the planned version. Preflight is read-only and must complete:

1. version, runtime, and frozen-lockfile contracts;
2. every `npm run release:check` gate;
3. the deterministic manual-installation archive;
4. equality among the workflow event commit, checkout commit, and remote default-branch HEAD;
5. absence of the remote same-name tag;
6. valid published-version ordering and release-notes baseline.

Retain the workflow run URL, run ID and attempt, candidate commit SHA, version, and complete gate results. A successful read-only preflight still has not created a tag or Release.

## 5. Publish

Only after reviewing preflight evidence may a maintainer create and push the numeric version tag at the same exact commit. The tag push triggers the Release workflow. The verify job rebuilds, verifies, and uploads the exact candidate under read-only permissions; the publish job receives write permission only when the same-tag Release is explicitly absent.

The publish job must reverify that the remote tag resolves to the prepared commit, download the candidate from the same workflow attempt, validate artifact metadata, server digest, safe paths, the exact file set, `SHA256SUMS`, archive contents, and the candidate manifest version, and then create provenance attestations for all four assets. It finally creates a non-draft, non-prerelease, immutable GitHub Release.

Do not manually replace assets, move the tag, or run a different build to “repair” an already published version. After a publication failure, first preserve evidence and determine whether the write boundary was crossed.

## 6. Hosted bytes and hash verification

A green workflow is not sufficient post-publication evidence. Query and download the hosted GitHub Release objects again and verify:

- the Release is immutable, non-draft, and non-prerelease;
- its assets are exactly `main.js`, `manifest.json`, `styles.css`, and `chrono-notes-x.y.z.zip`, without omissions or duplicates;
- every hosted asset is byte-identical to the prepared candidate, with retained SHA-256 values;
- each attestation binds this repository's Release workflow, the numeric tag ref, and the exact release commit;
- the remote tag still resolves to the same release commit after publication;
- the three installable assets inside the ZIP are byte-identical to the loose assets.

Until hosted verification completes, report only that publication was attempted or that the workflow completed, not that the release was verified.

## 7. Rollback and recovery

Do not overwrite, move, or delete a stable tag or immutable Release as a rollback mechanism. When a defect is discovered:

1. stop further deployment and retain failed-workflow, candidate-hash, hosted-object, and host evidence;
2. determine which tags, Releases, attestations, and assets became public;
3. fix the default branch and pass the complete gates;
4. run a new preflight and publication with a strictly increasing version;
5. identify the affected and replacement versions in release notes or a security advisory.

Rolling back a production Vault is a separate explicitly authorized operation. Record and back up the installed assets first, replace only `main.js`, `manifest.json`, and `styles.css`, preserve plugin `data.json`, and recalculate installed byte hashes after copying. GitHub Release recovery evidence does not replace Vault data protection or post-restart host acceptance.

## 8. Evidence layers

Every release record distinguishes at least these states:

- **Source evidence**: commit SHA, worktree state, version files, and `npm run release:check` output;
- **Candidate evidence**: workflow run and attempt, artifact ID and digest, four SHA-256 values, and archive-internal equivalence;
- **Publication evidence**: tag resolution, Release state, hosted asset set, downloaded bytes, and attestations;
- **Host evidence**: installation, startup, and critical behavior in an isolated Vault;
- **Production-deployment evidence**: authorized-Vault backup, preserved `data.json`, installed hashes, and restart acceptance;
- **Human or device evidence**: explicit desktop, emulator, or physical-device acceptance results.

Every report lists layers that were not run or not verified. Local tests, a successful build, screenshots, or a displayed version do not substitute for hosted bytes, real-host behavior, or production-deployment evidence.
