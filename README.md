# Chrono Notes

Chrono Notes is an Obsidian calendar workspace for periodic notes, Chinese lunar dates, regional holidays, tasks, statistics, and time-range notes.

> Status: functional parity and repository-side release hardening are implemented. The full-repository audit fixes have passed the automated release gates, and the latest artifact has been copied to and file-by-file verified in the main and isolated local Vaults. File deployment is not claimed as an explicit Obsidian reload, real-device verification, or a release. The official Mainland China 2027 holiday schedule is not yet published, so the gate preserves `unavailable`, emits a warning, and never substitutes predicted data.

## Product scope

- Year, month, and week views.
- Daily, weekly, monthly, quarterly, and yearly notes.
- Chinese lunar calendar overlay with solar terms and traditional festivals.
- Mainland China and Singapore holiday extensions.
- Tasks, note statistics, heatmaps, range notes, templates, previews, and local read-only ICS files.
- English, Simplified Chinese, and Traditional Chinese UI.

See [Product requirements](docs/product-requirements.md), [Architecture](docs/architecture.md), and the Chinese [feature parity checklist](docs/feature-parity.zh-CN.md).

## Development

```bash
pnpm install
pnpm check
pnpm dev
```

Development requires Node.js 20, 22, or 24 and later, plus pnpm 11.7.0. This range matches the test runner's declared engine support. The minimum Obsidian app version is 1.12.7. Development uses exactly pinned Obsidian API typings 1.12.3; app and typings versions serve different purposes and need not share the patch number.

`pnpm check` runs the source-style gate, strict type checking, the complete Vitest suite, the production build, and artifact contracts. `pnpm release:check` also runs UTC/DST time-zone tests, the deterministic 1,000-note quick benchmark, and current/next-year holiday coverage. A missing current year, published-but-unrecorded following year, or unverified primary source blocks; a following year verified as not yet officially published passes with a warning. Use `pnpm bench:large` for the 10,000-note benchmark. The production plugin bundle is written to `dist/chrono-notes/`. Real minimum/current Obsidian, real mobile, Profiler, and heap checks follow the [manual release gates in the testing strategy](docs/testing-strategy.md#manual-release-gates).

## 中文

简体中文说明见 [README.zh-CN.md](README.zh-CN.md)。
