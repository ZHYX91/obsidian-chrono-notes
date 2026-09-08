# Chrono Notes

[English](https://github.com/ZHYX91/obsidian-chrono-notes/blob/main/README.md) · [简体中文](https://github.com/ZHYX91/obsidian-chrono-notes/blob/main/docs/i18n/README.zh-CN.md)

Chrono Notes is an Obsidian calendar workspace for periodic notes, optional calendar extensions, regional holidays, tasks, statistics, and time-range notes.

## Screenshots

### Calendar workspace

See note state, tasks, local ICS events, holidays, and range notes together in the month calendar.

![Chrono Notes desktop range note and month calendar](https://raw.githubusercontent.com/ZHYX91/obsidian-chrono-notes/main/docs/assets/chrono-notes-desktop-en.png)

### Android

The same calendar workspace adapts to touch interaction and narrow screens.

<p align="center">
  <img src="https://raw.githubusercontent.com/ZHYX91/obsidian-chrono-notes/main/docs/assets/chrono-notes-android-en.png" alt="Chrono Notes Android month calendar" width="360">
</p>

## Features

- A century view grouped by decade, with the same periodic-note cells, indicators and interactions as the year overview.
- Year, month, and week calendar views with note state, tasks, holidays, local ICS events, and time-range notes.
- Daily, weekly, monthly, quarterly, yearly, decadal, and century periodic notes with built-in or Templater templates.
- Note Navbar navigation between adjacent notes, higher periods, selected dates, and the calendar workspace.
- Chinese lunar and Ganzhi calendar extensions, including solar terms and traditional festivals.
- Persian (Solar Hijri), Ethiopic, Hebrew, Indian national (Saka), Islamic civil, and Umm al-Qura calendar extensions.
- Mainland China and Singapore holiday extensions.
- Tasks, statistics, month and year heatmaps, note previews, task completion, and due-date adjustments.
- Time-range note creation by date-range dragging, cross-week layouts, templates, and a searchable range-note list.
- Local, read-only ICS calendar sources.
- Configurable display formats for Obsidian Date and Date & time properties while preserving ISO YAML, native segmented editing, and optional daily-note opening.
- English, Simplified Chinese, Traditional Chinese, Arabic, Persian, Hebrew, Amharic, and Hindi UI, including right-to-left layout where applicable.

Source notes and plugin settings stay inside the Vault. Read-only ICS sources may be Vault files or explicitly configured local desktop paths; they are never uploaded by the plugin. Chrono Notes keeps only a derived NoteIndex cache in device-local IndexedDB; that cache is not written into the Vault or sent to a remote service. No account is required.

## Requirements and compatibility

- Obsidian 1.12.7 or later on desktop or mobile.
- Local ICS sources inside the Vault work across supported platforms; explicitly configured paths outside the Vault are desktop-only.
- Optional non-Gregorian calendars depend on the calendar data provided by the Obsidian runtime and are omitted safely when unavailable.

## Installation

### Manual installation

Download `chrono-notes-<version>.zip` from the [latest release](https://github.com/ZHYX91/obsidian-chrono-notes/releases/latest) and extract it into `Vault/.obsidian/plugins/`. The archive contains the `chrono-notes/` directory with `main.js`, `manifest.json`, and `styles.css`. Reload Obsidian, then enable Chrono Notes under Community plugins.

### Upgrade

Back up and preserve `Vault/.obsidian/plugins/chrono-notes/data.json` when it exists. Replace only `main.js`, `manifest.json`, and `styles.css`; delete `data.json` only when you explicitly want to reset all plugin preferences.

## Usage

1. Enable the periodic-note types you use and confirm their path patterns in Chrono Notes settings.
2. Open the calendar from the ribbon or command palette.
3. Optionally enable calendar and holiday extensions or add local ICS sources.
4. Select a date to open or create its periodic note.

### Decadal and century notes

The century view places each decade beside two rows of five years; narrow layouts move the decade above them. Years outside the century leave empty slots. Entering the view reveals the selected year’s decade; This century returns to the current decade. Navigation stays visible while the years scroll.

Enable these note types in settings, then select Century in the sidebar. Use the decade cells on the left to access decadal notes; the enabled century note has its own cell. The view tabs are Week, Month, Year and Century. Period cells share the year view's note dots, task progress, selection and preview. Click to select; double-click or press Enter to open or create the note. Ctrl/Cmd-click or middle-click opens a new tab; touch supports long press. Use the view tabs to browse the selected period. Default paths are `[diary]/DEC[s]` (2020s) and `[diary]/[C]CEN` (C21).

Decades span 2020–2029; century 21 spans 2001–2100. `DEC` and `CEN` are Chrono Notes extensions that output fixed digits. Prefer either century or decade folders: 2000s crosses C20/C21, and its decade note uses the first year (2000, in C20). Existing notes stay in place.

Templates use the same formats: `{{date:DEC[s]}}`, `{{date:[C]CEN}}`, and `{{start:YYYY}}–{{end:YYYY}}`. All periodic templates support start/end dates and inclusive `{{days}}`; each note settings page lists its placeholders, meanings, examples, and Templater equivalents. General > Template settings explains shared syntax and default formats.

### Range-note recognition

A range note must contain valid `start` and `end` properties. New range notes created by Chrono
Notes also write `chrono-notes: interval` and are recognized anywhere in the Vault. A note without
the `chrono-notes` property is recognized only within the configured unmarked range-note scope. A
different `chrono-notes` value excludes the note from range-note recognition. Existing notes are
not modified automatically.

## Settings

Settings cover periodic-note paths and templates, calendar and holiday extensions, task and statistics display, local ICS sources, time-range notes, and Obsidian Date and Date & time property display. Defaults are stored in the plugin's `data.json`; note content and frontmatter remain in the Vault.

## Limitations

- ICS sources are local read-only files; remote calendar subscriptions are not fetched directly.
- Holiday availability depends on verified official data. Unpublished future schedules are shown as unavailable rather than predicted.
- Non-Gregorian calendar extensions are backed by the runtime's Unicode calendar data. Gregorian dates remain the note-path, navigation, and indexing anchor; unavailable runtime calendars are omitted safely.
- Some mobile interaction and layout details depend on the Obsidian app and device input stack.

## Privacy and security

Chrono Notes enumerates Markdown files and reads relevant Vault notes to build its note, calendar, task, statistics, and path-suggestion indexes. It also reads user-selected local ICS files through the local filesystem boundary. It does not upload notes, tasks, calendars, or ICS data and does not require an account. Its derived NoteIndex cache stays in device-local IndexedDB and can be rebuilt from the source notes. The plugin writes a formatted date to the system clipboard only after the user chooses **Copy date**; it never reads the clipboard.

## Development

Development requires exactly Node.js 24.19.0 and npm 11.17.0.

```bash
npm ci
npm run check
```

Developer references:

- [Product requirements](https://github.com/ZHYX91/obsidian-chrono-notes/blob/main/docs/product-requirements.en.md)
- [UX specification](https://github.com/ZHYX91/obsidian-chrono-notes/blob/main/docs/ux-spec.en.md)
- [Architecture](https://github.com/ZHYX91/obsidian-chrono-notes/blob/main/docs/architecture.en.md)
- [Testing strategy](https://github.com/ZHYX91/obsidian-chrono-notes/blob/main/docs/testing-strategy.en.md)
- [Changelog](https://github.com/ZHYX91/obsidian-chrono-notes/blob/main/CHANGELOG.md)
- [Contributing guide](https://github.com/ZHYX91/obsidian-chrono-notes/blob/main/CONTRIBUTING.md)
- [Security policy](https://github.com/ZHYX91/obsidian-chrono-notes/blob/main/SECURITY.md)

## Support

- Use [General](https://github.com/ZHYX91/obsidian-chrono-notes/discussions/categories/general) for workflow ideas and general feedback.
- Use [Q&A](https://github.com/ZHYX91/obsidian-chrono-notes/discussions/categories/q-a) for usage and configuration questions.
- Use the structured [GitHub issue forms](https://github.com/ZHYX91/obsidian-chrono-notes/issues/new/choose) for reproducible bugs and concrete feature requests.
- Report vulnerabilities only through GitHub's [private vulnerability reporting](https://github.com/ZHYX91/obsidian-chrono-notes/security/advisories/new); see the [security policy](https://github.com/ZHYX91/obsidian-chrono-notes/security/policy) for details.

Never post real private Vault paths, note or task content, calendar or ICS data, source URLs, credentials, or personal information publicly.

## License

[MIT](https://github.com/ZHYX91/obsidian-chrono-notes/blob/main/LICENSE) © ZhengYX

## Acknowledgements

Chrono Notes draws inspiration from:

- Liam Cain: [Calendar](https://github.com/liamcain/obsidian-calendar-plugin)
- a-nano-dust (纳米级尘埃): [Dust Calendar](https://github.com/a-nano-dust/dust-obsidian-calendar)
