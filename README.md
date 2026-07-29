# Chrono Notes Calendar

[English](https://github.com/ZHYX91/obsidian-chrono-notes/blob/main/README.md) · [简体中文](https://github.com/ZHYX91/obsidian-chrono-notes/blob/main/docs/i18n/README.zh-CN.md)

Chrono Notes Calendar is an Obsidian calendar workspace for periodic notes, optional calendar extensions, regional holidays, tasks, statistics, and time-range notes.

## Screenshots

### Periodic note navigation

Move between adjacent periodic notes, jump to the parent period, or return to the calendar without leaving the note.

![Chrono Notes Calendar periodic note navigation and month calendar](https://raw.githubusercontent.com/ZHYX91/obsidian-chrono-notes/main/docs/assets/chrono-notes-navigation-en.png)

### Calendar workspace

See note state, tasks, local ICS events, holidays, and range notes together in the month calendar.

![Chrono Notes Calendar desktop range note and month calendar](https://raw.githubusercontent.com/ZHYX91/obsidian-chrono-notes/main/docs/assets/chrono-notes-desktop-en.png)

### Android

The same calendar workspace adapts to touch interaction and narrow screens.

<p align="center">
  <img src="https://raw.githubusercontent.com/ZHYX91/obsidian-chrono-notes/main/docs/assets/chrono-notes-android-en.png" alt="Chrono Notes Calendar Android month calendar" width="360">
</p>

## Features

- Year, month, and week calendar views with note state, tasks, holidays, local ICS events, and time-range notes.
- Daily, weekly, monthly, quarterly, and yearly periodic notes with built-in or Templater templates.
- Note Navbar navigation between adjacent notes, higher periods, selected dates, and the calendar workspace.
- Chinese lunar and Ganzhi calendar extensions, including solar terms and traditional festivals.
- Persian (Solar Hijri), Ethiopic, Hebrew, Indian national (Saka), Islamic civil, and Umm al-Qura calendar extensions.
- Mainland China and Singapore holiday extensions.
- Tasks, statistics, month and year heatmaps, note previews, task completion, and due-date adjustments.
- Time-range note creation by date-range dragging, cross-week layouts, templates, and a searchable range-note list.
- Local, read-only ICS calendar sources.
- Configurable display formats for Obsidian Date and Date & time properties while preserving ISO YAML, native segmented editing, and optional daily-note opening.
- English, Simplified Chinese, Traditional Chinese, Arabic, Persian, Hebrew, Amharic, and Hindi UI, including right-to-left layout where applicable.

Source notes and plugin settings stay inside the Vault. Read-only ICS sources may be Vault files or explicitly configured local desktop paths; they are never uploaded by the plugin. Chrono Notes Calendar keeps only a derived NoteIndex cache in device-local IndexedDB; that cache is not written into the Vault or sent to a remote service. No account is required.

## Getting started

1. Enable the periodic-note types you use and confirm their path patterns in Chrono Notes Calendar settings.
2. Open the calendar from the ribbon or command palette.
3. Optionally enable calendar and holiday extensions or add local ICS sources.
4. Select a date to open or create its periodic note.

## Limitations

- ICS sources are local read-only files; remote calendar subscriptions are not fetched directly.
- Holiday availability depends on verified official data. Unpublished future schedules are shown as unavailable rather than predicted.
- Non-Gregorian calendar extensions are backed by the runtime's Unicode calendar data. Gregorian dates remain the note-path, navigation, and indexing anchor; unavailable runtime calendars are omitted safely.
- Some mobile interaction and layout details depend on the Obsidian app and device input stack.

## Manual installation

Download `chrono-notes-<version>.zip` from the [latest release](https://github.com/ZHYX91/obsidian-chrono-notes/releases/latest) and extract it into `Vault/.obsidian/plugins/`. The archive already contains the `chrono-notes/` directory and its three plugin files. Reload Obsidian, then enable Chrono Notes Calendar under Community plugins.

## Development

```bash
pnpm install
pnpm check
```

Development requires Node.js 22.13 or later in the 22.x line, or Node.js 24 and later, plus pnpm 11.7.0. See the [developer documentation](https://github.com/ZHYX91/obsidian-chrono-notes/blob/main/docs/architecture.en.md) for architecture and testing details.

Questions, usage help, and general feedback are welcome in [GitHub Discussions](https://github.com/ZHYX91/obsidian-chrono-notes/discussions). Please use the structured [GitHub issue forms](https://github.com/ZHYX91/obsidian-chrono-notes/issues/new/choose) for reproducible bugs and concrete feature requests. Report vulnerabilities only through GitHub's [private vulnerability reporting](https://github.com/ZHYX91/obsidian-chrono-notes/security/advisories/new); see the [security policy](https://github.com/ZHYX91/obsidian-chrono-notes/security/policy) for details. Never post real private Vault paths, note or task content, calendar or ICS data, source URLs, credentials, or personal information publicly.

## Acknowledgements

Chrono Notes Calendar draws inspiration from:

- Liam Cain: [Calendar](https://github.com/liamcain/obsidian-calendar-plugin)
- a-nano-dust (纳米级尘埃): [Dust Calendar](https://github.com/a-nano-dust/dust-obsidian-calendar)
