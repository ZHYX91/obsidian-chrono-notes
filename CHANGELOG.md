# Changelog

Notable changes to Chrono Notes are documented in this file. The repository's numeric Git tags are the evidence for released versions; an entry without a corresponding local tag remains unreleased even if the manifests already contain that version.

## 0.4.3

### Changed

- Streamlined templated periodic and interval note creation while preserving failure rollback behavior.
- Decoupled repository checks from local acceptance orchestration and clarified deployment safeguards.
- Unified task, preview, word/link/tag statistics, attachment, and embed interpretation on one Markdown body projection that masks fenced code, inline code, and HTML comments without losing source lines.
- Serialized Templater's internal render-only boundary and named its compatibility-sensitive create-note run mode.
- Bounded ICS source count, input bytes, event count, and concurrent reads.
- Clarified the interface-language setting in every supported locale, including the explicit Follow Obsidian choice.
- Refined settings guidance, tab navigation, and compact property-format controls.
- Restored warm note-index caches without rereading unchanged Vault files.
- Recorded exact-candidate desktop acceptance while keeping unavailable Templater and mobile-host coverage explicitly separate.

### Fixed

- Protected future-schema settings from destructive downgrade writes.
- Persisted the first-use guide marker only after the guide is actually displayed.
- Protected editor and deferred template writes from stale runtime operations.
- Stopped standalone Markdown punctuation from inflating word counts.

## 0.4.2

### Added

- Added lightweight opt-in index diagnostics.

## 0.4.1

### Fixed

- Restored the Chrono Notes product name and hardened the large-Vault performance gate.

## 0.4.0

### Changed

- Centralized runtime composition and added performance guardrails.
- Hardened immutable release publication, candidate binding, archive validation, settings recovery, and cache recovery.
- Hardened marketplace README links.

## 0.3.0

### Added

- Added property-date display and native settings integration.

### Changed

- Standardized README localization and community support documentation.
- Hardened runtime and release boundaries.

### Fixed

- Improved localized settings controls and property date/time editing and format handling.

## 0.2.2

### Changed

- Refined settings, calendar details, acceptance workflow, and internal module boundaries.

## 0.2.1

### Added

- Added persistent startup caching, unified extension events and previews, aligned periodic formats, and shared template configuration.

### Changed

- Simplified task progress controls, renamed the plugin, and standardized feedback and security channels.

### Fixed

- Hardened cache validation, calendar rendering, preview behavior, release handling, and settings migration.

## 0.2.0

### Added

- Added multilingual calendar extensions and a reproducible acceptance Vault.

### Fixed

- Preserved language autonyms and physical calendar status-slot placement.

## 0.1.2

### Changed

- Strengthened repository publishing and generalized calendar-extension positioning.

### Fixed

- Hardened ICS and host integration.

## 0.1.1

### Added

- Synchronized the calendar with periodic notes.

### Fixed

- Prevented mobile interval overflow overlap.

## 0.1.0

### Added

- Established the initial Chrono Notes baseline.
