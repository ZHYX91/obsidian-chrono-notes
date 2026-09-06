---
source_language: zh-CN
translation_of: release.zh-CN.md
translation_status: synced
---

# Chrono Notes — Release procedure

This document defines the repeatable Chrono Notes release process. Source checks, the Candidate
Bundle, real Obsidian acceptance, GitHub publication, and production-Vault deployment are separate
evidence and authorization boundaries.

## Boundaries

An authorized stable version tag push triggers publication. Manual dispatch on the same tag supports verify-only or publish mode through the same workflow. Host acceptance is optional; publishing does not deploy to a Vault.

## Version and source

`manifest.json`, `package.json`, `package-lock.json`, and `versions.json` bind one canonical `x.y.z`
version, minimum Obsidian version, and exact commit/tree. Run `npm run release:check` from a clean
worktree before release; a same-version tag must be absent or already point at that commit.

## Candidate Bundle v3

The vendored release-core `3.0.0` and thin adapter create the sole Candidate Bundle v3. It binds
source, build toolchain, core/config/workflow, product payload, scenario contract, and fixture
hashes, and contains `main.js`, `manifest.json`, `styles.css`, `chrono-notes-x.y.z.zip`,
`SHA256SUMS`, and `candidate-bundle.json`. There is no second receipt, envelope, or compatibility
candidate object.

## Optional product acceptance

Use the same Bundle for desktop and Android-emulator acceptance covering periodic navigation,
template creation, time-zone and holiday boundaries, commands, and the imperative tabbed settings
surface. Android physical devices and iOS are outside release acceptance. This repository owns the
scenarios and fixtures through `acceptance/product-scenarios.json`.

## Standalone workflow

Tag push and manual dispatch use the same build, publish, and post-verification jobs. The read-only build job produces and verifies the Bundle. Publication downloads that fixed artifact without rebuilding and verifies the event, tag, commit, and Bundle digest before writing. Manual verify mode performs no publication.

## Publication and verification

Actions generates SLSA build provenance for the four public assets. The publisher verifies their source, tag and workflow, creates a draft, downloads and checks all draft assets, then publishes the immutable Release. A separate job checks the hosted release. Only the three loose files and versioned ZIP are public assets; Bundle metadata stays in the CI artifact. GitHub publication and Community Directory review are separate outcomes.

## Failure, rollback, and deployment

An existing same-tag Release is a zero-write no-op only when metadata, all four asset bytes, and
provenance are exact. Any difference fails without overwriting or patching the Release; fixes use a
new version. Production-Vault deployment still requires separate authorization for the exact Vault
and preserves `data.json`.
