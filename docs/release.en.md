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

An ordinary tag push does not trigger publication. Commit, push, tag, workflow dispatch, GitHub
Release, and production-Vault deployment require separate authorization; no local check implies a
remote write.

## Version and source

`manifest.json`, `package.json`, `package-lock.json`, and `versions.json` bind one canonical `x.y.z`
version, minimum Obsidian version, and exact commit/tree. Run `npm run release:check` from a clean
worktree before release; a same-version tag must be absent or already point at that commit.

## Candidate Bundle v3

The vendored release-core `2.0.0` and thin adapter create the sole Candidate Bundle v3. It binds
source, build toolchain, core/config/workflow, product payload, scenario contract, and fixture
hashes, and contains `main.js`, `manifest.json`, `styles.css`, `chrono-notes-x.y.z.zip`,
`SHA256SUMS`, and `candidate-bundle.json`. There is no second receipt, envelope, or compatibility
candidate object.

## Product acceptance

The same Bundle requires desktop and Android-emulator acceptance covering periodic navigation,
template creation, time-zone and holiday boundaries, commands, and the imperative tabbed settings
surface. Android physical devices and iOS are outside release acceptance. This repository owns the
scenarios and fixtures through `acceptance/product-scenarios.json`.

## Standalone workflow

The generated, checked-in standalone workflow accepts only explicit `workflow_dispatch`. Its
read-only verify job performs one independent install and one complete `release:check` at the exact
commit, rebuilds the Bundle, and source-verifies it. The downstream publish job downloads that same
artifact and performs transport verification without restoring or trusting `dist`.

## Publication and verification

A portable acceptance closure never authorizes publication; separate authorization binds the same
Bundle and closure. Before the first mutation, the workflow deeply validates both records, applies
the equivalent of `--verify-tag`, and performs a read-only preflight. The public Release contains
exactly the three loose assets and versioned ZIP; `SHA256SUMS` and `candidate-bundle.json` remain in
the private Bundle. Post-verification reads back every hosted byte and provenance record.

## Failure, rollback, and deployment

An existing same-tag Release is a zero-write no-op only when metadata, all four asset bytes, and
provenance are exact. Any difference fails without overwriting or patching the Release; fixes use a
new version. Production-Vault deployment still requires separate authorization for the exact Vault
and preserves `data.json`.
