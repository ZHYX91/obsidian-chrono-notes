# Repository Guidelines

## Project Scope

Chrono Notes is an Obsidian workspace for periodic notes, calendar extensions, regional holidays, tasks, statistics, and time ranges. Keep all implementation and documentation self-contained within this repository.

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

## Settings surface policy

Declarative settings are intentionally disabled because Obsidian 1.13 bypasses `display()` for
non-empty definitions, which removes Chrono Notes' five-tab settings layout and degrades the user
experience. Preserve the imperative `PluginSettingTab.display()` surface and keep
`getSettingDefinitions()` empty. Dormant declarative builders and tests may remain, but must not be
activated accidentally. Do not flag the `display()` deprecation, empty definitions, the disabled
feature switch, or missing settings search, and do not propose a declarative migration unless the
user explicitly asks to revisit this decision. Documentation that describes the 1.13 declarative
surface as active is stale and must not override this policy.

## Manual installation release policy

The versioned `chrono-notes-<version>.zip` is an intentional required public release asset for
users who install without the Obsidian Community marketplace. Community ignores it during plugin
ingestion, so the automated-review `extra unsupported files` recommendation is expected and must
not be treated as a defect or a reason to remove the archive. The deterministic ZIP contains one
`chrono-notes/` directory with `main.js`, `manifest.json`, and `styles.css`, byte-identical to the
three loose release assets. Release checks must preserve and verify all four public assets.

## Commands

- `npm run dev`: development bundle in watch mode.
- `npm run typecheck`: strict TypeScript validation.
- `npm run test`: run Vitest once.
- `npm run build`: type-check and create the standard plugin assets at `dist/`.
- `npm run check`: lint, source-format checks, strict type checking, the complete Vitest suite, production bundling, and artifact contracts.
- `npm run release:check`: `npm run check` plus time-zone tests, the quick benchmark, and the annual holiday-data gate.

## Code Style

Use TypeScript with strict types, two-space indentation, double quotes, semicolons, and trailing commas in multiline structures. Prefer named exports for reusable domain helpers. React components use PascalCase; functions, variables, and hooks use camelCase; hooks start with `use`.

Keep pure rules in `core`, orchestration in `features`, external APIs in `adapters`, and rendering in `ui`. Do not introduce generic abstractions without at least two real consumers.

## Parsing and Cache Rules

Markdown parsing must cover UTF-8 BOM, LF, CRLF, CR, mixed endings, a closing frontmatter delimiter at EOF, `---`, and YAML `...`. Add regression tests for every discovered boundary case.

Vault indexing must handle `create`, `modify`, `rename`, and `delete`, deduplicate in-flight reads, and prevent an older asynchronous computation from overwriting a newer file revision.

## Documentation

Simplified Chinese is the source language for product and architecture decisions. Stable user and design documents use paired `.zh-CN.md` and `.en.md` files with matching section structure and translation metadata. The root `README.md` is English; translations use `docs/i18n/README.<locale>.md`. Every README variant starts with the canonical product title followed by the same native-language navigation order. Because the Obsidian plugin catalog renders only the English root README without rewriting repository-relative URLs, root navigation and repository-document links use canonical GitHub `blob/main` URLs and root images use canonical `raw.githubusercontent.com` URLs. Translated READMEs use repository-relative navigation, document, image, and license targets so GitHub resolves them naturally. Release, Issues, Discussions, Security, acknowledgements, and other external resources remain absolute HTTPS URLs in every language. `npm run check:readme-i18n` enforces this split offline, including target existence and repository-boundary checks. The current capability checklist may remain Chinese-only. Never place two full languages in the same Markdown document.

Documentation describes current behavior and current verification requirements. Remove superseded plans, handoff notes, progress logs, dated audit narratives, and obsolete alternatives after their durable decisions have been incorporated into stable documents.

`CHANGELOG.md` is the only public document that records release history. README and user help
describe the product as it works now: compatibility, installation, usage, settings, limitations,
privacy, and support. Do not add version banners, dated acceptance evidence, release-status
narratives, or superseded plans outside the changelog. Keep migration or deprecation guidance only
when users still need to act, and state the required action directly. Engineering documents describe
the current contract and repeatable process rather than past executions.

When changing a paired stable document, update its translation in the same change or mark its `translation_status` as `outdated`.

## Testing

Tests live in `tests/` and mirror source areas. Prioritize contract and boundary tests over superficial component snapshots. Critical areas include document parsing, periodic date anchors, path resolution, settings normalization, Vault event ordering, stale async results, templates, task dates, interval notes, and ICS parsing.

Before handoff, run `npm run check`.

## Deployment and host acceptance

Deploy to a production Vault only when the user explicitly names and authorizes the exact target. Before copying, resolve the target plugin directory, record or back up the currently installed runtime assets, and hash `data.json` when present. Replace only the verified production assets declared by the release contract, preserve `data.json` unless the user explicitly authorizes a reset, and verify the installed hashes after copying.

Acceptance fixtures, cleanup scripts, and destructive test operations may target only explicitly identified temporary Vaults; never point them at an ordinary or production Vault. Source checks, packaged-candidate checks, deployed-host behavior, and Android emulator evidence remain separate claims. Because this plugin is mobile-capable, an exact release candidate requires current desktop and Android emulator passes. Android physical devices and iOS are out of scope.

## Git and Generated Files

Use Conventional Commit subjects. Do not commit `node_modules/`, `dist/`, coverage output, vault data, private calendars, local paths, or generated plugin caches. Production plugin files are build artifacts unless a release process explicitly asks for them.
