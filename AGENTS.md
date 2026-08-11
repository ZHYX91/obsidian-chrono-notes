# Repository Guidelines

## Project Scope

Chrono Notes is an Obsidian workspace for periodic notes, calendar extensions, regional holidays, tasks, statistics, and time ranges. The sibling project at `../obsidian-calendar` is read-only reference material. Do not modify it while working in this repository.

Current date, note, task, template, interval-note, holiday, and ICS semantics are defined by the stable product, architecture, UX, and testing documents. Preserve them unless a documented decision changes them; do not expand the plugin into unrelated product scope.

## Architecture

Source code lives in `src/`:

- `src/app/`: plugin lifecycle, registration, and dependency composition.
- `src/core/`: pure domain models, parsing, and date/statistics algorithms. It must not import Obsidian.
- `src/features/`: user-facing use cases, controllers, and query stores.
- `src/adapters/`: Obsidian and external-system adapters.
- `src/ui/`: React calendar UI and native Obsidian settings UI.
- `src/shared/`: plugin-local settings, i18n, and small cross-feature types.

`NoteIndex` is the single source of truth for note existence, parsed document state, tasks, previews, statistics, and range-note projections. Views must not read Vault files directly.

## Commands

- `pnpm dev`: development bundle in watch mode.
- `pnpm typecheck`: strict TypeScript validation.
- `pnpm test`: run Vitest once.
- `pnpm build`: type-check and create the standard plugin assets at `dist/`.
- `pnpm check`: lint, source-format checks, strict type checking, the complete Vitest suite, production bundling, and artifact contracts.
- `pnpm release:check`: `pnpm check` plus time-zone tests, the quick benchmark, and the annual holiday-data gate.

## Code Style

Use TypeScript with strict types, two-space indentation, double quotes, semicolons, and trailing commas in multiline structures. Prefer named exports for reusable domain helpers. React components use PascalCase; functions, variables, and hooks use camelCase; hooks start with `use`.

Keep pure rules in `core`, orchestration in `features`, external APIs in `adapters`, and rendering in `ui`. Do not introduce generic abstractions without at least two real consumers.

## Parsing and Cache Rules

Markdown parsing must cover UTF-8 BOM, LF, CRLF, CR, mixed endings, a closing frontmatter delimiter at EOF, `---`, and YAML `...`. Add regression tests for every discovered boundary case.

Vault indexing must handle `create`, `modify`, `rename`, and `delete`, deduplicate in-flight reads, and prevent an older asynchronous computation from overwriting a newer file revision.

## Documentation

Simplified Chinese is the source language for product and architecture decisions. Stable user and design documents use paired `.zh-CN.md` and `.en.md` files with matching section structure and translation metadata. The root `README.md` is English; translations use `docs/i18n/README.<locale>.md`. Every README variant starts with the canonical product title followed by the same native-language navigation order. Because the Obsidian plugin catalog renders only the English root README without rewriting repository-relative URLs, root navigation and repository-document links use canonical GitHub `blob/main` URLs and root images use canonical `raw.githubusercontent.com` URLs. Translated READMEs use repository-relative navigation, document, image, and license targets so GitHub resolves them naturally. Release, Issues, Discussions, Security, acknowledgements, and other external resources remain absolute HTTPS URLs in every language. `pnpm check:readme-i18n` enforces this split offline, including target existence and repository-boundary checks. The current capability checklist may remain Chinese-only. Never place two full languages in the same Markdown document.

Documentation describes current behavior and current verification requirements. Remove superseded plans, handoff notes, progress logs, dated audit narratives, and obsolete alternatives after their durable decisions have been incorporated into stable documents.

When changing a paired stable document, update its translation in the same change or mark its `translation_status` as `outdated`.

## Testing

Tests live in `tests/` and mirror source areas. Prioritize contract and boundary tests over superficial component snapshots. Critical areas include document parsing, periodic date anchors, path resolution, settings normalization, Vault event ordering, stale async results, templates, task dates, interval notes, and ICS parsing.

Before handoff, run `pnpm check`.

## Deployment and host acceptance

Deploy to a production Vault only when the user explicitly names and authorizes the exact target. Before copying, resolve the target plugin directory, record or back up the currently installed runtime assets, and hash `data.json` when present. Replace only the verified production assets declared by the release contract, preserve `data.json` unless the user explicitly authorizes a reset, and verify the installed hashes after copying.

Acceptance fixtures, cleanup scripts, and destructive test operations may target only explicitly identified temporary Vaults; never point them at an ordinary or production Vault. Source checks, packaged-candidate checks, deployed-host behavior, emulator evidence, and physical-device evidence remain separate claims.

## Git and Generated Files

Use Conventional Commit subjects. Do not commit `node_modules/`, `dist/`, coverage output, vault data, private calendars, local paths, or generated plugin caches. Production plugin files are build artifacts unless a release process explicitly asks for them.
