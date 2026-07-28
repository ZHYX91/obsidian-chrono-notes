---
source_language: zh-CN
translation_of: product-requirements.zh-CN.md
translation_status: synced
---

# Product requirements

## 1. Positioning

Chrono Notes Calendar is a periodic-note workspace rather than a date picker. Year, month, and week calendars organize daily through yearly notes, tasks, time-range notes, and read-only external events.

The product remains focused on periodic-note calendar workflows, with consistency, accessibility, narrow-sidebar usability, and data reliability as standing requirements. It does not expand into general project management or network-calendar subscription.

## 2. Calendar views

- Navigation: the main header is ordered as previous period, compact period selectors, next period, flexible whitespace, and the current-period action. Arrows use a small gap from their selectors, while the trailing action has a distinct minimum separation without symmetric filler. Month uses year/month selectors and Today; week uses ISO week-year/week selectors and Today; year uses a year selector and This month. Year, month, ISO week-year, and week-number popovers share one independent state grammar: current uses only accent text plus `aria-current`, with no dot; selected uses only a `2px` inset outline plus `aria-pressed`, without changing text color or background; focus uses a separate outer outline, and current may coexist with selected. A month is current only while browsing the current year, and a week is current only while browsing the current ISO week-year.

### 2.1 Month view

- Month: a boundary-week grid containing every complete week that intersects the target month, producing four to six rows without a row wholly owned by an adjacent month. Its week-number rail selects a week and opens its weekly note. Weekly-note state or task progress is a non-layout top overlay; an unconfigured or hidden state reserves no empty row, so the week label remains centered against the complete control. The main grid uses a `6px` gap by default and `4px` at `≤360px`; an additional stable spacer separates the week-number rail from the seven date columns without a divider. Every week-number entry is an independent cell with the same `5px` rounding on all four corners as a date cell, rather than retaining a square trailing edge from a continuous rail. Each date cell has a fixed top row with note state or horizontal task progress on the left and one regional marker on the right; the centered date owns the next row and keeps `3px` of effective spacing before details. A normal cell uses a `56px` base minimum, while holiday and ICS content grows only its complete week. A day containing local today uses a compact inverse-color rounded label around its date number, and the containing week number uses the same treatment. Selection uses an accent `2px` frame genuinely outside the cell boundary, and focus remains an independent outermost frame; current and selected coexist through label plus frame rather than competing cell borders. A month heatmap retains its four data backgrounds, centers the date both horizontally and vertically, renders no range Gantt, and marks today with a centered inverse-color dot. Leading and trailing outside-month dates fade as complete cells while today, selection, range preview, hover, and keyboard focus retain full contrast.

### 2.2 Week view

- Week: the seven detailed day cells reuse the month day model in the order status/work-rest, weekday, date, calendar extensions, holidays, and ICS. Wide, medium, and narrow container tiers progressively fold visible details without losing accessible information. Its main grid uses a `6px` gap by default and `4px` at `≤360px`, while the date keeps `3px` of effective spacing before details. Today uses the compact inverse-color rounded date label, selection uses the independent accent `2px` outer frame, and focus remains an independent outermost frame. The view also provides task aggregation, due-date overdue semantics, due-date rescheduling, a compact weekly-note row, and a range Gantt aligned to the same seven columns with the same `6px / 4px` column gaps in an independent normal-flow sibling section after the day buttons, outside the day cells. Empty tasks and ranges avoid redundant explanatory paragraphs.
- Week navigation: week year and week number are separate ISO selectors rather than a mini calendar that changes view mode. Each target week year exposes 52 or 53 weeks dynamically, and an unavailable W53 clamps to the final week when the year changes. Selection stays in Week and preserves the selected weekday offset when possible; a Sunday-first display changes only the visible seven-day boundary, not the ISO identity. The week popover uses one complete, at-least-44px button per week with `W01` and a compact range, three columns normally and two below 360px with vertical scrolling. Current, selected, and focus states remain distinct, with arrow, Home, End, Page Up/Down, numeric typeahead, Escape, and focus restoration support.

### 2.3 Year view

- Year: quarter/month summary plus a full-year daily heatmap. Summary cells use a regular `6px` gap and `4px` at `≤360px`; summary status is a non-layout top overlay, and the entry reserves clear vertical separation between that indicator and its centered title. Unconfigured or hidden status reserves no empty row. A quarter or month containing local today uses a compact inverse title; selection uses an accent `2px` frame genuinely outside the cell boundary, and focus remains an independent outermost frame beyond selection. A selected day or week remains available in the accessible name without a visible corner badge. Daily heatmap cells retain their statistic background, mark today with a centered inverse dot, and use a regular `4px` gap or `3px` at `≤360px`.
- Year home action: This month selects day one of the local current month using month-selection semantics and stays in Year. From another year it also returns to the current year and reveals the target month.

## 3. Periodic notes

- Daily, weekly, monthly, quarterly, and yearly notes.
- Independent enablement and path patterns, with each template file configured beside the note type that consumes it.
- One date model for path generation, reverse recognition, navigation, and template context.
- Built-in periodic and range-note templates plus an explicit Templater adapter with no silent fallback; range creation always enforces canonical `start`/`end` metadata after rendering.
- Periodic-note and range-note creation confirmations are configured independently. Confirming a creation may disable later confirmations for that category; cancellation, closing, or Escape never changes settings. A periodic-note cascade is covered by its single primary confirmation rather than prompting for every larger period.

## 4. Calendar and holiday extensions

### 4.1 Calendar extensions

The plugin implements eight optional calendar extensions: Chinese lunar dates with solar terms and traditional festivals; Ganzhi with day pillars and solar-term month transitions; Persian (Solar Hijri); Ethiopic; Hebrew; the Indian national (Saka) calendar; Islamic civil; and Umm al-Qura. The two Islamic choices remain explicit because one is a rule-based civil calculation and the other follows Saudi Umm al-Qura data. Users choose at most two extensions in display order.

Gregorian dates remain the base calendar and the sole anchor for periodic-note identity, paths, navigation, indexing, tasks, and ranges. Extensions are display-only and cannot change note identity. The six new providers prefer the host runtime's `Intl.DateTimeFormat` and Unicode calendar data instead of maintaining religious or national authority tables. Unsupported runtime calendars are omitted from choices, retained settings are marked unavailable, and queries fail open. Providers live in an explicit static registry; runtime file discovery and unimplemented choices are out of scope. Settings label the two ordered slots First calendar and Second calendar. Every provider returns one primary date expression and zero or more events with stable semantic IDs, localized text, event kind, and source calendar. The shared day query merges equal IDs across enabled calendars while retaining all distinct events and every source. At regular widths two primary dates use equal inline slots; narrow layouts stack them. Deduplicated events always follow those dates in a separate full-width centered row, so they never appear between calendars.

The date cell owns the only calendar hover/focus preview. Calendar-extension children expose no native `title`. The unified preview and the cell ARIA retain every primary calendar date, every deduplicated event with its source calendars and transition time, and the existing note, task, holiday, and ICS information. Disabling hover previews prevents this calendar detail from reappearing through a child tooltip.

### 4.2 Holiday extensions

Holiday extensions implement only Mainland China public holidays/workday adjustments and Singapore public holidays. Calendar extensions and holiday extensions remain independent settings under Extensions & integrations. Holiday extensions use three ordered First/Second/Third region slots, but only implemented providers appear, so the third slot can remain empty today. Slot order controls names and ordinary holiday markers, while adjusted-workday markers always take priority. Marker text follows the resolved plugin language through complete message catalogs. Each holiday provider maintains official or locally conventional and English names, plus only selected high-value translations; a missing name locale falls back to English rather than requiring a region-by-language translation matrix. Adding a calendar never infers religious observances or adds a corresponding legal-holiday dataset.

## 5. Documents, tasks, and statistics

- Note states include transient indexing, missing, empty, YAML-only, body content, and read failure. An unknown path while NoteIndex is updating must remain indexing rather than being reported as missing or offered for creation.
- State, preview, tasks, and statistics come from one parsed document.
- Parsing covers BOM, LF, CRLF, CR, mixed endings, and closing YAML delimiters at EOF.
- Statistics cover word, link, tag, and task-completion dimensions with one shared display contract.
- Month and year heatmap enablement remains independent. When the active view's heatmap is enabled, its trailing tool group shows the shared statistic selector, a 0–4 legend whose palette matches that view's actual cells, and the heatmap toggle; when disabled, only the toggle remains. Week has no heatmap controls. Narrow containers hide the legend first, then allow the complete group to wrap while keeping it right-aligned.

## 6. Range notes

- Range notes use `start` and `end` frontmatter and support lightweight calendar display, creation, search, filtering, and sorting. Disabling range-creation confirmation does not skip date entry, path-conflict handling, or error feedback. Normal Month view and Week view use simplified Gantt lanes across date columns, while Month heatmap renders no range Gantt: overlapping ranges separate, non-overlapping ranges reuse a lane, and cross-week segments retain a stable identity color.

## 7. External calendars

- ICS integration reads local files only. It does not subscribe over the network, expand recurrence, use CalDAV, or write events back. A regular-width month cell shows at most three event summaries before `+N`; narrow layouts may fold visible summaries while preserving complete accessible information.

## 8. Interaction and auxiliary entry points

- Click selects; double-click, long press, middle click, or Ctrl/Cmd-click opens notes.
- Context menus, mini calendar, jump-to-date, periodic-note navigation, and new-tab opening are supported. Inside a periodic note, previous/date/next stays centered relative to the editor while calendar and next-enabled-higher-period commands occupy an independent trailing action area, so optional actions cannot shift the center. On mobile, the Navbar stays below the system safe area and Obsidian's native view header but above the editor content; it never covers status indicators, cutouts, or host controls, and every existing action remains reachable.
- The main calendar offers efficient year, month, ISO week-year, and week-number selection plus opening the corresponding yearly, quarterly, or monthly note. Selection surfaces adapt to available width while preserving keyboard operation, new-tab opening, and mutual exclusion between open pickers.
- Status is never communicated by color alone.
- The main calendar consistently uses `is-current-period` for an exact date or period containing local today: exact days use `aria-current="date"`, week/month/quarter entries use `aria-current="true"`, and selection semantics remain independent. In the main grid, current never draws a cell border: Month and Week use compact inverse date labels, Month also inverses the current week number, Year summary inverses current month/quarter titles, and year heatmap uses a centered inverse dot. Selected uses an accent `2px` frame genuinely outside the cell boundary, while focus is an independent outermost frame beyond selection. This main-grid contract is not reused directly by the period picker or mini calendar; the period picker derives current/selected/focus independently from its targets and browsing context, while the mini calendar retains its existing state styling.

## 9. Settings and languages

- Settings use five tabs: General, Appearance & views, Periodic notes, Range notes, and Extensions & integrations.
- Settings are versioned, validated, and migrated; updates refresh only affected consumers.
- Periodic-note settings independently enable daily through yearly notes. Disabled types collapse their dependent path controls; enabled types offer Vault-folder suggestions plus a live full-path preview that must both generate and reverse-recognize through the unified path rules, followed by that type's Markdown template file. Range-note settings likewise keep their template file beside the deterministic creation folder. General owns the global template engine and complete syntax help; every Markdown suggestion writes only the existing template-path field and introduces no parallel configuration.
- Appearance settings retain font sizing that follows Obsidian, follows the sidebar, or uses a fixed factor; a Note status and tasks group; and quarter labels using numbers or the Chinese `春 / 夏 / 秋 / 冬` names. Font sizing defaults to fixed mode with a 0–20 factor and a default of 10. Sidebar following uses discrete container buckets rather than continuous viewport-based scaling. Numeric quarter labels are localized to the interface language and are the default; the Chinese mode applies consistently to the year view and month picker. Show note status hides only visible state dots and progress across month, week, and year; it does not remove NoteIndex data, task statistics, or ARIA. Its dependent Show task progress toggle remains persisted but disabled while note status is off. When both are enabled and a note contains tasks, one outlined warning-color horizontal progress track replaces the top status dot; completed progress uses the success color, and notes without tasks retain the dot. Turning task progress off restores the dot without changing task data. A date cell's top-right region remains reserved for the localized regional marker. Calendar extensions, holiday extensions, and ICS are configured under Extensions & integrations in that order.
- General presents Language, Week starts, Note Navbar, and a Getting started button before an Obsidian Date and Date & time properties group. Its date dropdown offers Follow operating system, `2026-07-31`, `2026/7/31`, `2026/07/31`, `31/07/2026`, `07/31/2026`, and a custom Moment format. A separate time dropdown applies only to Date & time and offers operating-system behavior, 24/12-hour forms with optional seconds, and a custom Moment format. Custom inputs show a live fixed-value preview, accept only local date/time tokens, and reject `Z / ZZ` time-zone tokens. Option labels follow the plugin UI language while examples and persisted selections do not change when that language changes; there is no separate locale/region selector. The plugin overlays only unfocused visible text and restores Obsidian's native segmented editor, keyboard behavior, and picker on focus; input values, frontmatter, and Vault content remain `YYYY-MM-DD` / ISO local date-time. Opening date properties remains independent of formatting in the same group and enabled by default. It captures only the open icon beside a date value and opens the Chrono Notes Calendar daily-note path in the default target or a new tab with `Ctrl / Cmd`. Wiki/Markdown links in Properties and links in note bodies retain Obsidian's behavior.
- UI languages: English, Simplified Chinese, Traditional Chinese, Arabic, Persian, Hebrew, Amharic, and Hindi. Arabic, Persian, and Hebrew use an RTL root direction, and layout relies on logical properties except for the physical day-cell accessory contract: note state/task progress remains top-left and the regional marker remains top-right in every direction.

## 10. Non-goals

No standalone day view, network calendar synchronization, general scripting language, full project/Gantt editor, or placeholder providers.
