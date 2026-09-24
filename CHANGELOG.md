# Changelog

Notable changes to Chrono Notes are documented in this file. The repository's numeric Git tags are the evidence for released versions; an entry without a corresponding local tag remains unreleased even if the manifests already contain that version.

## 0.7.4

### Added

- Open a complete, read-only list of a day's ICS events and sources from the date context menu,
  including when hover previews are disabled or the calendar cell shows `+N`.

### Fixed

- Keep calendar query cache invalidation aligned with localized periodic-note paths and explicitly
  marked range notes outside the unmarked-note scan folder.
- Allow explicit range-note creation when its folder is configured even if the unmarked-note scan
  folder is empty or elsewhere.
- Keep ICS read concurrency bounded across refreshes while promptly cancelling queued reads.
- Sort cross-day ICS continuations by the displayed local day, interpret embedded time zones and
  daylight-saving durations, and report unsupported source time zones separately from invalid events.
- Translate the fallback title for ICS events without a SUMMARY at presentation time.

### Changed

- Split host acceptance into focused scenarios and add a desktop and Android event-detail case.

## 0.7.3

### Fixed

- Keep real ICS source-read failures distinct from source/occurrence limits, and show both failure
  summaries and truncation recovery guidance when they occur together.
- Repair empty and concatenated Arabic interface strings, with a catalog-wide non-empty-message
  regression gate.
- Remove the persistent Enter/return glyph from selected calendar cells while preserving all
  keyboard, pointer, and touch opening gestures.
- Wrap calendar-extension dates in narrow cells so two-digit lunar months and days remain
  complete instead of being replaced with an ellipsis.
- Stretch decade headers across the two year columns in narrow Century calendars.

### Changed

- Use compact numeric Chinese-lunar cell text outside Chinese locales while retaining complete
  lunar wording in accessible text and previews.
- Remove outdated README screenshots and clarify that a single click selects while double-click,
  Enter, or touch long-press opens or creates a periodic note.
- Source future GitHub Release descriptions from the matching version section of `CHANGELOG.md`
  instead of GitHub auto-generated notes; reject missing, empty or duplicate sections during
  source/tag validation, candidate bundling and event preflight.

## 0.7.2

### Fixed

- Revalidate task targets immediately before closed-file writes to avoid overwriting a note
  that was replaced, renamed, or opened in an editor while the write was pending.
- Keep successfully committed task updates successful when the note opens or moves afterwards.
- Explain the 32-source ICS limit, omitted source count, and recovery actions in refresh
  notifications and settings, including when the occurrence limit is also reached.

### Changed

- Document the existing local ICS source limit and unsupported recurring-event expansion.

## 0.7.1

### Fixed

- Reject periodic paths that cannot uniquely identify their configured period, and verify
  that settings previews parse back to the same period.
- Keep each period's filename language stable when the interface language changes, preserving
  legacy localized names and digits without renaming existing files.
- Refresh path-language previews in place without resetting the settings page's scroll position.
- Preserve source-timezone calendar-day semantics across daylight-saving transitions in ICS
  durations, and keep events without an end time as points in time.
- Apply minimal task edits while preserving BOM, line endings, inline code, and comments.
- Report successful, existing, and failed cascade results together without discarding created notes.
- Bound ICS indexing to 100,000 day occurrences, cancel superseded refreshes, and explain omitted
  events and recovery actions in refresh notices and settings.
- Update ICS status and refresh controls in place when background refreshes finish.
- Restore a single keyboard entry point and directional navigation in the century calendar,
  and reserve space for selection and focus outlines beside its scrollbar.
- Reflow century years into two columns in very narrow panes or with enlarged text, keeping full
  years, navigation controls and matching vertical keyboard movement available.

### Changed

- Keep Today readable in narrow calendars, increase auxiliary text floors, and show an opening
  cue for the selected configured date or period.
- Update the vulnerable development-only js-yaml dependency and retain reproducible build checks
  with a practical production bundle budget.

## 0.7.0

### Added

- Added independently configurable decadal and century notes, including commands, templates,
  parent-period navigation, and cascade creation.
- Added fixed-digit `DEC` and `CEN` date-format extensions for note paths, built-in templates,
  and the Templater `tp_calendar` helpers.
- Added a century calendar with decade groups, five years per row, a century picker, and
  automatic navigation to the selected or current decade.

### Changed

- Unified periodic calendar cells, note indicators, task progress, previews, and pointer,
  keyboard, and touch interactions across the year and century views.
- Kept century navigation visible while the years scroll, with responsive decade labels for
  narrow sidebars and larger interface fonts.
- Separated general template syntax, periodic-note paths and placeholders, and range-note
  recognition and placeholders into focused settings guides with examples.
- Clarified complete-period template boundaries and century/decade folder behavior. Existing
  note paths and content remain unchanged; decadal and century notes are disabled by default.

### Fixed

- Centered month, quarter, year, decade, and week labels independently of note enablement or
  indicator visibility, keeping dots and progress bars above the labels.
- Improved release verification recovery for temporary GitHub read failures without retrying
  unconfirmed remote changes.

## 0.6.0

### Added

- Added the `chrono-notes: interval` identity property so explicitly marked range notes are
  recognized anywhere in the Vault.
- Added a localized Range notes guide that explains explicit identity, unmarked-note scope, and
  the no-migration behavior.

### Changed

- New range notes now write `chrono-notes: interval` with canonical `start` and `end`; existing
  notes remain unchanged and continue to use the configured unmarked range-note scope.

### Fixed

- Surfaced settings persistence failures with visible save progress and retry controls, and kept
  settings created by a newer plugin version visibly read-only instead of accepting incompatible
  edits.

## 0.5.0

### Added

- Added every formal, additional, and dynamically calculated traditional festival exposed by the pinned Chinese lunar calendar library, with simplified Chinese, traditional Chinese, and English names.

### Changed

- Limited each date cell to two visible calendar-extension events plus a `+N` summary while retaining every event in hover previews and accessibility text.
- Kept periodic-note navigation available while the note index updates; existing targets open directly and absent targets continue through the normal confirmation, template, and cascade workflow.
- Added a neutral Open or create daily note context action while a target's indexed existence remains unknown.

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
