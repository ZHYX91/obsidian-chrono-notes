# Contributing to Chrono Notes

Thank you for improving Chrono Notes. Keep every contribution narrowly scoped, reproducible, and safe for users' Vault data.

## Before starting

- Use GitHub Discussions for questions and early workflow ideas.
- Search existing issues before filing a concrete bug or feature request.
- Report security vulnerabilities privately according to [SECURITY.md](SECURITY.md).
- Remove private Vault paths, note and task content, calendar and ICS data, source URLs, credentials, screenshots, logs, and personal information from public reports and fixtures.

## Development setup

This repository is independently buildable. It requires the exact runtime versions declared by the repository:

- Node.js `24.19.0`, also recorded in `.node-version` and `package.json`.
- npm `11.9.0`, recorded in `package.json`.

Install dependencies with:

```sh
npm ci
```

Useful commands include:

```sh
npm run dev
npm run typecheck
npm run test
npm run check
npm run release:check
```

Run commands from this repository root. `npm run check` is the required handoff gate; `npm run release:check` adds time-zone tests, performance guardrails, and holiday-data coverage.

## Change boundaries

- Preserve the architecture described in `AGENTS.md` and the paired stable documents under `docs/`.
- Keep pure domain logic in `src/core`, orchestration in `src/features`, host integration in `src/adapters`, and rendering in `src/ui`.
- Add a focused regression test for every parsing, cache, event-ordering, or data-safety bug.
- Do not point fixtures or cleanup operations at an ordinary or production Vault.
- Do not commit generated bundles, dependency directories, coverage output, private data, local paths, plugin caches, or deployment evidence.
- Treat local checks, a packaged candidate, hosted release assets, and behavior inside Obsidian as separate evidence.

## Documentation and translations

Simplified Chinese is the source language for stable product and design documents. Update both `docs/<name>.zh-CN.md` and `docs/<name>.en.md` in the same change with matching heading structure, and keep the English document at `translation_status: synced`. An incomplete translation pair is not ready for handoff. Keep the root README in English and its translation under `docs/i18n/`.

Record notable user-visible changes under `Unreleased` in `CHANGELOG.md`. Do not add release dates or claim publication without repository evidence.

## Pull requests

Before requesting review:

1. Rebase or merge the current default branch without discarding unrelated work.
2. Run `npm run check` with the exact repository runtime.
3. Describe the user-visible behavior, safety boundary, tests run, and anything not verified.
4. Keep commits reviewable and use Conventional Commit subjects.

Do not publish tags, releases, or deployment artifacts from a contribution branch. The maintainer release procedure is documented in [docs/release.en.md](docs/release.en.md).
