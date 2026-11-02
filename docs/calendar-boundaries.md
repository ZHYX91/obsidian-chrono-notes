---
source_language: zh-CN
translation_of: calendar-boundaries.zh-CN.md
translation_status: synced
---

# Chrono Notes — Calendar identity and time boundaries

## 1. Periodic-note paths

A path pattern must contain the identity fields required by its note period, whether or not it uses `DEC` or `CEN`. Daily notes need a year, month and day, or a complete ISO week-year, week number and weekday; weekly notes need a complete date or an ISO week-year and week number; monthly notes need a year and month; quarterly notes need a year and quarter or month; yearly notes need a year. Decadal and century notes use `DEC`, `CEN` respectively, or a year.

For example, `[Daily]/YYYY-MM` is not a daily-note path and `[Monthly]/YYYY` is not a monthly-note path. Invalid rules are inactive in both queries and open/create commands, so they cannot open a same-named file belonging to a different period. Path generation must parse its output and verify that the result belongs to the original period, not merely that it is parseable. Previews, queries, and creation share this rule. Two-digit years retain their existing parsing rules; a preview must not label a result in another century as valid. Prefer four-digit years for long-lived notes.

Filename/path locale is a stable identity setting for each period, separate from interface and template/display locale. Missing `pathLocale` means English. The schema-19 upgrade pins the effective previous locale for every period, including localized digits, and preserves explicitly configured path locales. Formatting and parsing use the same numbering system. Changing the interface language afterwards does not change filename identity. Each period displays its own path language; check its preview and existing filenames before changing it. A change affects lookup and creation without automatically renaming or migrating existing notes.

Larger-note cascading returns a structured created, existing or failed result for each target. Failure does not undo the opened primary note or successful larger notes; later enabled periods are still attempted. The interface presents one localized partial-success notice listing created, preserved and failed targets with error details, without representing partial failure as failure to create the primary note.

Configuration validation does not migrate or rename existing notes. Users with invalid rules must correct the pattern and independently confirm which dates their existing files belong to.

## 2. ICS time semantics

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

The primary calendar and note identity use Gregorian dates. The lunar library does not accept the historical reform gap from `1582-10-05` through `1582-10-14`. On those dates, only the Chinese lunar and Ganzhi dates and events that depend on that library are omitted; the original Gregorian date, note state, and other available calendars remain visible. Direct and cached queries use the same support boundary without shifting to a neighboring date or another calendar. Known unsupported dates are handled separately from programming errors; other conversion failures still propagate.

## 6. Regression verification

Path tests cover missing period fields, literal text resembling format tokens, valid-rule priority, leap days, month/year boundaries, Sunday-start cross-year weeks, stable localized filename identity across interface-language changes, migration of each period's path language while preserving explicit values, and the requirement that invalid rules never call file or workspace ports. Preview tests distinguish parseability from period identity. Cascade tests cover the target list shown before creation, including existing larger notes, cancellation without writes and execution-time existence checks. A pre-creation failure leaves that larger target absent while the primary and later successful periods remain on disk; the failure is surfaced after the primary opens. Failures after creation retain the target and concurrent edits, as defined by the creation contract.

ICS tests cover spring and autumn daylight-saving transitions, different source and display zones, `P1D`, `PT24H`, `P1W`, mixed durations, floating times, UTC sources, points at and just before midnight, and exclusive all-day ends. Existing invalid-end and cancelled/recurring-event tests remain in place.

Year-boundary tests cover duration and time-zone overflows at both bounds, valid first and last dates, an exclusive end exactly at next-year midnight, refresh completion, skip counts, and retention of valid neighboring events. Calendar-extension tests cover every date in the historical gap, both adjacent supported dates, ordinary modern dates, cached and direct month/week queries, preserved note identity and other extensions, and propagation of unexpected conversion failures.

Task tests cover masked date markers, UTF-16 coordinates, line endings, minimal editor transactions, no-op updates and refused writes. Century-view tests cover one tab stop, arrow navigation with five or two columns, Home/End, Enter, RTL, refresh retention and cross-century fallback.

Run `npm run check` and `npm run test:timezones` to verify source contracts and deterministic date behavior. They do not replace desktop, mobile or theme acceptance in real Obsidian.

Reference: [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545.html).
