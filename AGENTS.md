# Repository Guidelines

## Project Scope

Chrono Notes Calendar is an Obsidian workspace for periodic notes, calendar extensions, regional holidays, tasks, statistics, and time ranges. The sibling project at `../obsidian-calendar` is read-only reference material. Do not modify it while working in this repository.

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

Simplified Chinese is the source language for product and architecture decisions. Stable user and design documents use paired `.zh-CN.md` and `.en.md` files with matching section structure and translation metadata. The root `README.md` is English; its Simplified Chinese counterpart lives at `docs/i18n/README.zh-CN.md`, and their language links use absolute GitHub URLs so they also work in the Obsidian plugin catalog. The current capability checklist may remain Chinese-only. Never place two full languages in the same Markdown document.

Documentation describes current behavior and current verification requirements. Remove superseded plans, handoff notes, progress logs, dated audit narratives, and obsolete alternatives after their durable decisions have been incorporated into stable documents.

When changing a paired stable document, update its translation in the same change or mark its `translation_status` as `outdated`.

## Testing

Tests live in `tests/` and mirror source areas. Prioritize contract and boundary tests over superficial component snapshots. Critical areas include document parsing, periodic date anchors, path resolution, settings normalization, Vault event ordering, stale async results, templates, task dates, interval notes, and ICS parsing.

Before handoff, run `pnpm check`.

## Git and Generated Files

Use Conventional Commit subjects. Do not commit `node_modules/`, `dist/`, coverage output, vault data, private calendars, local paths, or generated plugin caches. Production plugin files are build artifacts unless a release process explicitly asks for them.
