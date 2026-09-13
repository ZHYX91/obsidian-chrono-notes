---
source_language: zh-CN
translation_of: calendar-boundaries.zh-CN.md
translation_status: synced
---

# Chrono Notes — Calendar identity and time boundaries

## 1. Periodic-note paths

A path pattern must contain the identity fields required by its note period, whether or not it uses `DEC` or `CEN`. Daily notes need a year, month and day, or a complete ISO week-year, week number and weekday; weekly notes need a complete date or an ISO week-year and week number; monthly notes need a year and month; quarterly notes need a year and quarter or month; yearly notes need a year. Decadal and century notes use `DEC`, `CEN` respectively, or a year.

For example, `[Daily]/YYYY-MM` is not a daily-note path and `[Monthly]/YYYY` is not a monthly-note path. Invalid rules are inactive in both queries and open/create commands, so they cannot open a same-named file belonging to a different period. Settings previews must also verify that the parsed result belongs to the original period, not merely that the path can be parsed. Two-digit years retain their existing parsing rules; a preview must not label a result in another century as valid. Prefer four-digit years for long-lived notes.

Validation does not migrate or rename existing notes. Users with invalid rules must correct the pattern and independently confirm which dates their existing files belong to. The existing coupling between interface language and localized month names in paths is unchanged here.

## 2. ICS time semantics

Under RFC 5545 section 3.3.6, duration weeks and days are added as calendar units in the event's source zone, followed by hours, minutes and seconds. `P1D` and `PT24H` can differ across daylight-saving transitions. Start and end values are converted to the display zone only after this calculation. UTC sources retain UTC arithmetic; floating times are interpreted in the display zone; all-day dates retain zone-free date semantics.

Under RFC 5545 section 3.6.1, a DATE-TIME event without `DTEND` or `DURATION` is a point and is not extended by a minute. The index places it exactly once on its start date in the display zone, including when it starts precisely at midnight. All-day events without end fields still last one calendar day, and all-day end dates remain exclusive.

Explicit equal or reversed `DTEND`, zero or negative `DURATION`, simultaneous end fields and mismatched date types remain isolated by the existing invalid-event rules. This does not add recurring-event expansion or change existing ICS input and event-span limits.

## 3. Regression verification

Path tests cover missing period fields, literal text resembling format tokens, valid-rule priority, leap days, month/year boundaries, Sunday-start cross-year weeks, and the requirement that invalid rules never call file or workspace ports. Preview tests distinguish parseability from period identity.

ICS tests cover spring and autumn daylight-saving transitions, different source and display zones, `P1D`, `PT24H`, `P1W`, mixed durations, floating times, UTC sources, points at and just before midnight, and exclusive all-day ends. Existing invalid-end and cancelled/recurring-event tests remain in place.

Run `npm run check` and `npm run test:timezones` to verify source contracts and deterministic date behavior. They do not replace desktop, mobile or theme acceptance in real Obsidian.

Reference: [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545.html).
