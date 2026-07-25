# Chrono Notes

Chrono Notes is an Obsidian calendar workspace for periodic notes, optional calendar extensions, regional holidays, tasks, statistics, and time-range notes.

## Screenshots

<table>
  <thead>
    <tr>
      <th>Desktop</th>
      <th>Android</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td width="70%"><img src="https://raw.githubusercontent.com/ZHYX91/obsidian-chrono-notes/main/docs/assets/chrono-notes-desktop-en.png" alt="Chrono Notes desktop interval note and month calendar"></td>
      <td width="30%"><img src="https://raw.githubusercontent.com/ZHYX91/obsidian-chrono-notes/main/docs/assets/chrono-notes-android-en.png" alt="Chrono Notes Android month calendar"></td>
    </tr>
  </tbody>
</table>

## Features

- Year, month, and week calendar views.
- Daily, weekly, monthly, quarterly, and yearly periodic notes.
- Chinese lunar and Ganzhi calendar extensions, including solar terms and traditional festivals.
- Persian (Solar Hijri), Ethiopic, Hebrew, Indian national (Saka), Islamic civil, and Umm al-Qura calendar extensions.
- Mainland China and Singapore holiday extensions.
- Tasks, statistics, heatmaps, time-range notes, templates, and previews.
- Local, read-only ICS calendar sources.
- English, Simplified Chinese, Traditional Chinese, Arabic, Persian, Hebrew, Amharic, and Hindi UI, including right-to-left layout where applicable.

Source notes, calendar files, and plugin settings stay inside the Vault. Chrono Notes keeps only a derived NoteIndex cache in device-local IndexedDB; that cache is not written into the Vault or sent to a remote service. No account is required.

## Getting started

1. Enable the periodic-note types you use and confirm their path patterns in Chrono Notes settings.
2. Open the calendar from the ribbon or command palette.
3. Optionally enable calendar and holiday extensions or add local ICS sources.
4. Select a date to open or create its periodic note.

## Limitations

- ICS sources are local read-only files; remote calendar subscriptions are not fetched directly.
- Holiday availability depends on verified official data. Unpublished future schedules are shown as unavailable rather than predicted.
- Non-Gregorian calendar extensions are backed by the runtime's Unicode calendar data. Gregorian dates remain the note-path, navigation, and indexing anchor; unavailable runtime calendars are omitted safely.
- Some mobile interaction and layout details depend on the Obsidian app and device input stack.

## Manual installation

Download `chrono-notes-<version>.zip` from the [latest release](https://github.com/ZHYX91/obsidian-chrono-notes/releases/latest) and extract it into `Vault/.obsidian/plugins/`. The archive already contains the `chrono-notes/` directory and its three plugin files. Reload Obsidian, then enable Chrono Notes under Community plugins.

## Development

```bash
pnpm install
pnpm check
```

Development requires Node.js 22.13 or later in the 22.x line, or Node.js 24 and later, plus pnpm 11.7.0. See the [developer documentation](https://github.com/ZHYX91/obsidian-chrono-notes/blob/main/docs/architecture.md) for architecture and testing details.

Questions and general feedback are welcome in [GitHub Discussions](https://github.com/ZHYX91/obsidian-chrono-notes/discussions). Please use the structured [GitHub issue forms](https://github.com/ZHYX91/obsidian-chrono-notes/issues/new/choose) for reproducible bugs and concrete feature requests. Remove private Vault, note, task, calendar, and ICS data before posting.

## Acknowledgements

Chrono Notes draws inspiration from:

- Liam Cain: [Calendar](https://github.com/liamcain/obsidian-calendar-plugin)
- a-nano-dust (纳米级尘埃): [Dust Calendar](https://github.com/a-nano-dust/dust-obsidian-calendar)

## 中文

查看[简体中文说明](https://github.com/ZHYX91/obsidian-chrono-notes/blob/main/README.zh-CN.md)。
