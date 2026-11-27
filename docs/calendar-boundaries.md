---
source_language: zh-CN
translation_of: calendar-boundaries.zh-CN.md
translation_status: synced
---

# Chrono Notes — Calendar identity and time boundaries

## 1. Periodic-note paths

A path pattern must contain the identity fields required by its note period, whether or not it uses `DEC` or `CEN`. Daily notes need a year, month and day, or a complete ISO week-year, week number and weekday; weekly notes need a complete date or an ISO week-year and week number; monthly notes need a year and month; quarterly notes need a year and quarter or month; yearly notes need a year. Decadal and century notes use `DEC`, `CEN` respectively, or a year.

For example, `[Daily]/YYYY-MM` is not a daily-note path and `[Monthly]/YYYY` is not a monthly-note path. Invalid rules are inactive in both queries and open/create commands, so they cannot open a same-named file belonging to a different period. Path generation must parse its output and verify that the result belongs to the original period, not merely that it is parseable. Previews, queries, and creation share this rule. Two-digit years retain their existing parsing rules; a preview must not label a result in another century as valid. Prefer four-digit years for long-lived notes.

Existing periodic notes can use any capitalization of the Markdown extension. Folder names and filename stems must match exactly. An explicitly requested spelling wins. Calendar actions prefer `.md`, then `.MD`, `.Md` and `.mD` when a case-sensitive Vault contains several spellings. The calendar opens the selected physical file. New notes use `.md`. Built-in and Templater template paths accept the same extension spellings, including when the setting omits the extension.

Filename/path locale is a stable identity setting for each period, separate from interface and template/display locale. Missing `pathLocale` means English. The schema-19 upgrade pins the effective previous locale for every period, including localized digits, and preserves explicitly configured path locales. Formatting and parsing use the same numbering system. Changing the interface language afterwards does not change filename identity. Each period displays its own path language; check its preview and existing filenames before changing it. A change affects lookup and creation without automatically renaming or migrating existing notes.

Larger-note cascading returns a structured created, existing or failed result for each target. Failure does not undo the opened primary note or successful larger notes; later enabled periods are still attempted. The interface presents one localized partial-success notice listing created, preserved and failed targets with error details, without representing partial failure as failure to create the primary note.

Configuration validation does not migrate or rename existing notes. Users with invalid rules must correct the pattern and independently confirm which dates their existing files belong to.

## 2. ICS time semantics

A malformed event property increments the invalid-event count while neighboring events load. Cancelled events are ignored first. Other events with `RRULE` or `RDATE` count as skipped recurring events even when the rule value is unreadable. Event dates, date-times and durations must match the complete ICS field syntax. An explicit numeric UTC offset or trailing text makes the event invalid. Broken component boundaries can still prevent the whole source from loading.

Embedded `VTIMEZONE` accepts only a unique `TZID` and complete, valid `STANDARD`/`DAYLIGHT` observances. `DTSTART` and every `RDATE` value must be valid local `DATE-TIME` values without `Z` or `TZID`; `TZOFFSETFROM`/`TZOFFSETTO` support valid second-precision offsets. A found embedded definition that is duplicate, invalid, contains any invalid transition rule, or exceeds its budget must not fall back to IANA or UTC. Only events depending on that zone are skipped and counted in `skippedUnsupportedTimezone`; other events continue.

Time-zone transition `RRULE` supports only `FREQ=YEARLY`, with a positive `INTERVAL`, mutually exclusive `COUNT` or UTC `UNTIL`, and `BYMONTH`, `BYMONTHDAY`, `BYYEARDAY`, `BYDAY`, `BYHOUR`, `BYMINUTE`, `BYSECOND`, and `BYSETPOS`. A valid `WKST` is accepted; `BYWEEKNO`, non-yearly frequencies, and unknown or duplicate rule parts are unsupported. `DTSTART`, every comma-separated `RDATE` value, and generated yearly transitions are merged and deduplicated; cross-year `RDATE` values must not be dropped. The compiled year range follows event starts, ends, and nominal-duration endpoints using that `TZID`, plus the following year, within `0000–9999`. Conflicting transitions or overlapping local transition windows do not guess an offset.

Before iteration, time-zone compilation estimates and reserves an upper-bound budget per ICS source: 100,000 candidate work units (year/month/day checks and expanded candidates), and 10,000 transition candidates before deduplication. These conservative acceptance limits do not promise support for every valid time-zone definition. Compilation never invokes implicit `ical.js` expansion or registers global time zones. This budget is separate from daily event expansion and adds no recurring `VEVENT` expansion.

Under RFC 5545 section 3.3.6, duration weeks and days are added as calendar units in the event's source zone, followed by hours, minutes and seconds. `P1D` and `PT24H` can differ across daylight-saving transitions. Start and end values are converted to the display zone only after this calculation. UTC sources retain UTC arithmetic; floating times are interpreted in the display zone; all-day dates retain zone-free date semantics.

Under RFC 5545 section 3.6.1, a DATE-TIME event without `DTEND` or `DURATION` is a point and is not extended by a minute. The index places it exactly once on its start date in the display zone, including when it starts precisely at midnight. All-day events without end fields still last one calendar day, and all-day end dates remain exclusive.

Explicit equal or reversed `DTEND`, zero or negative `DURATION`, simultaneous end fields and mismatched date types remain isolated by the existing invalid-event rules. This does not add recurring-event expansion or change existing ICS input and event-span limits.

The index accepts only events whose occupied display-zone dates are within `0000–9999`. If duration arithmetic or time-zone conversion moves the start date or last occupied date outside that range, the event counts toward `skippedInvalid`; valid events in the same and other sources continue indexing, and the refresh completes. An exclusive end exactly at midnight on `10000-01-01` can still represent the final valid day, `9999-12-31`, and must not be rejected as an overflow.

One runtime owner maintains the ICS index. All sources share a budget of 100,000 daily occurrences; expansion yields in batches and discards work superseded by a newer refresh. At the limit, the index retains bounded partial results. Both settings and refresh notifications explain the limit, the number of events not fully displayed, and the option to reduce sources or event spans before refreshing. Successful source reads do not imply complete event expansion.

## 3. Task edits

Editor updates distinguish an unchanged source, an exact intended result and an unconfirmed third state, including when a host transaction throws. An exact applied result may request saving only while the captured file/view/editor binding remains valid. A save-request failure is a warning, not a reason to repeat the edit; requesting a save is not a durability guarantee. An occupied path without a unique usable editor target is refused without a disk fallback.

Task rescheduling locates the due date in the latest Markdown projection's semantic text, using the same masking semantics as task parsing. Only the date characters are replaced; lookalike markers in preceding inline code, HTML comments, or Obsidian `%%` comments, marker spacing, original line endings and unrelated text remain unchanged.

A single open Markdown editor receives a minimal-range transaction instead of a full-document replacement. Closed files still use `Vault.process` for atomic validation and replacement. Multiple editors, changed editor identities and a buffer changed during rewriting still refuse the write. Event-driven task indexing and latest-task identity checks remain intact.

## 4. Century keyboard navigation

The century view has one Tab stop, preferring a still-visible keyboard focus, the selected period, the current year, then the first period. Tab is not intercepted and can leave the calendar.

Horizontal arrows traverse periods in display order and respect RTL direction. Vertical arrows follow the rendered year-column count, moving five years in the regular layout or two in the narrow two-column layout; on century/decade headings they move between headings. Home/End reach the first/last period. Moving focus neither creates nor opens a note and does not change semantic selection. Enter retains selection and opening; mouse and long-press behavior remain unchanged. Note refreshes retain a visible focus stop, while changing centuries provides a valid fallback.

## 5. Calendar extension date support

The primary calendar and note identity use proleptic Gregorian dates. Through 1582-10-04, the lunar and Ganzhi extensions convert each Gregorian date to its Julian equivalent before passing it to the lunar library. For example, Gregorian 1582-10-04 corresponds to Julian 1582-09-24 and the eighth day of the ninth lunar month. The lunar library does not accept the historical reform gap from `1582-10-05` through `1582-10-14`. On those dates, only the Chinese lunar and Ganzhi dates and events that depend on that library are omitted; the original Gregorian date, note state, and other available calendars remain visible. Direct and cached queries use the same support boundary without shifting to a neighboring date or another calendar. Known unsupported dates are handled separately from programming errors; other conversion failures still propagate.

The grid, festival row and full date use the effective plugin interface language. Simplified and Traditional Chinese have separate displays. Japanese, Korean and Vietnamese interfaces use the local names for their respective lunisolar calendars. Other interfaces use English when viewing those calendars. French Republican months have Chinese names. Indian Panchanga distinguishes the waxing and waning fortnights. Chol Q’ij retains all 20 K’iche’ day names and explains the sign and its number in Chinese, English or Spanish.

| Calendar | Gregorian dates covered | Meaning of the displayed day |
| --- | --- | --- |
| Vietnamese lunar | 1976–2050 | Modern nationwide convention, with new moons and principal solar terms evaluated in UTC+7. Tết, the Hùng Kings’ commemoration and Mid-Autumn use regular lunar months. |
| Korean lunar | 1962–2050 | Modern Korean time, UTC+9. Seollal is 1/1 and Chuseok is 8/15 in regular lunar months. The supported period covers complete years under modern time through the final year of the [KASI converter](https://astro.kasi.re.kr/life/pageView/8). |
| Japanese Kyūreki | 1900–2099 | Modern reconstruction in UTC+9. For the ambiguous 2033–34 span the adopted convention places leap month 11 on 22 December 2033. Moon viewing follows the regular eighth month’s fifteenth day. [NAOJ](https://www.nao.ac.jp/news/blog/2023/20230829-koyomi.html) |
| Japanese era years | From 1 January 1873 | The grid shows the era name and year. Details include the Gregorian month and day. The host supplies era names and transitions; future dates use its latest known era. |
| French Republican | 22 September 1792 – 31 December 1805 | The national period includes the retrospective beginning of year I and ends on 10 nivôse XIV. The five or six complementary days follow fructidor. The historical lengths follow the [Gard departmental archives](https://archives.gard.fr/fileadmin/mediatheque-satellite/archives/documents/02_RECHERCHER/01_Boite-a-outils/Calendrier-republicain/Archives-dep-Gard_Calendrier-republicain_Tableau-complet.pdf). |
| K’iche’ Chol Q’ij | Gregorian years 0000–9999 | A continuous 260-day count displayed as a number from 1 to 13 and one of 20 modern K’iche’ day names. Projection onto a Gregorian date uses the correlation 21 December 2012 = 4 Ajpu’. [Guatemala’s cultural information system](https://www.sicultura.gob.gt/wp-content/uploads/2021/06/Armonizacion-de-los-Calendarios-Mayas-1.pdf) |
| Indian Panchanga | 22 March 2026 – 21 March 2027 | Sunrise tithi at the national almanac’s central reference station (23°11′ N, 82°30′ E), from the published 1948 Saka edition. A tithi can repeat at consecutive sunrises or fall between them. The Indian national (Saka) date is a separate option. [India Meteorological Department](https://packolkata.imd.gov.in/panchang/en/explanation) |

A date outside a provider’s coverage omits that provider’s date and events. Regional work and rest markers come from the separate holiday settings. Regenerate the East Asian month tables with `node scripts/generate-east-asian-lunar-years.mjs` and verify them with `--check`. The generator computes new moon and solar term instants with the pinned ephemeris, then applies each calendar’s civil-day and leap-month rules. The Indian sunrise series can be regenerated using the sources and instructions in `scripts/import-imd-panchanga.mjs`.

## 6. Regression verification

Path tests cover missing period fields, literal text resembling format tokens, valid-rule priority, leap days, month/year boundaries, Sunday-start cross-year weeks, stable localized filename identity across interface-language changes, migration of each period's path language while preserving explicit values, and the requirement that invalid rules never call file or workspace ports. Preview tests distinguish parseability from period identity. Cascade tests cover the target list shown before creation, including existing larger notes, cancellation without writes and execution-time existence checks. A pre-creation failure leaves that larger target absent while the primary and later successful periods remain on disk; the failure is surfaced after the primary opens. Failures after creation retain the target and concurrent edits, as defined by the creation contract.

ICS tests cover spring and autumn daylight-saving transitions, different source and display zones, `P1D`, `PT24H`, `P1W`, mixed durations, floating times, UTC sources, points at and just before midnight, and exclusive all-day ends. Existing invalid-end and cancelled/recurring-event tests remain in place.

Year-boundary tests cover duration and time-zone overflows at both bounds, valid first and last dates, an exclusive end exactly at next-year midnight, refresh completion, skip counts, and retention of valid neighboring events. Calendar-extension tests cover every date in the historical gap, both adjacent supported dates, ordinary modern dates, cached and direct month/week queries, preserved note identity and other extensions, and propagation of unexpected conversion failures.

Task tests cover masked date markers, UTF-16 coordinates, line endings, minimal editor transactions, no-op updates and refused writes. Century-view tests cover one tab stop, arrow navigation with five or two columns, Home/End, Enter, RTL, refresh retention and cross-century fallback.

Run `npm run check` and `npm run test:timezones` to verify source contracts and deterministic date behavior. They do not replace desktop, mobile or theme acceptance in real Obsidian.

Reference: [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545.html).
