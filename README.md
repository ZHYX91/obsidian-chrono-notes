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
- Mainland China and Singapore holiday extensions.
- Tasks, statistics, heatmaps, time-range notes, templates, and previews.
- Local, read-only ICS calendar sources.
- English, Simplified Chinese, and Traditional Chinese UI.

Calendar information and plugin settings stay inside the Vault. Chrono Notes does not require an account or send calendar and note data to a remote service.

## Getting started

1. Enable the periodic-note types you use and confirm their path patterns in Chrono Notes settings.
2. Open the calendar from the ribbon or command palette.
3. Optionally enable calendar and holiday extensions or add local ICS sources.
4. Select a date to open or create its periodic note.

## Limitations

- ICS sources are local read-only files; remote calendar subscriptions are not fetched directly.
- Holiday availability depends on verified official data. Unpublished future schedules are shown as unavailable rather than predicted.
- Some mobile interaction and layout details depend on the Obsidian app and device input stack.

## Manual installation

Download `chrono-notes-<version>.zip` from the [latest release](https://github.com/ZHYX91/obsidian-chrono-notes/releases/latest) and extract it into `Vault/.obsidian/plugins/`. The archive already contains the `chrono-notes/` directory and its three plugin files. Reload Obsidian, then enable Chrono Notes under Community plugins.

## Development

```bash
pnpm install
pnpm check
```

Development requires Node.js 22.13 or later in the 22.x line, or Node.js 24 and later, plus pnpm 11.7.0. See the [developer documentation](https://github.com/ZHYX91/obsidian-chrono-notes/blob/main/docs/architecture.md) for architecture and testing details. Bugs and feature requests are welcome in [GitHub Issues](https://github.com/ZHYX91/obsidian-chrono-notes/issues).

## 中文

查看[简体中文说明](https://github.com/ZHYX91/obsidian-chrono-notes/blob/main/README.zh-CN.md)。
