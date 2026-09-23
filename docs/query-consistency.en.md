---
source_language: zh-CN
translation_of: query-consistency.zh-CN.md
translation_status: synced
---

# Calendar query consistency

## 1. Single rules

Periodic-note queries and dependency collection use the same `resolveIndexedPeriodicNotePath()` and pass the complete `PeriodicNoteRule`, including `pathLocale`. The interface language does not replace the file-path language. Relevant dependency keys include the path locale; cached data must refer to the same path as the active query.

The range list, calendar queries, and calendar cache dependencies share `isIntervalNoteInScope()`. Valid explicitly marked `chrono-notes: interval` notes are visible throughout the Vault; scan folders constrain only unmarked compatibility notes. An empty scan folder does not exclude explicit ranges. Other explicit markers are already excluded during parsing and must not re-enter as unmarked ranges.

## 2. Creation and scanning

New range notes write the explicit range marker. Their destination must satisfy the existing creation configuration requirements, but need not be inside the unmarked-note scan folder. An empty or missing scan folder may produce a diagnostic, but must not replace a valid creation action with a settings action. A missing creation destination still requires setup.

## 3. Cache and memory

NoteIndex is the sole derived note index. Query caches retain immutable index entries and dependency references, never reread the Vault, and own no second copy of note facts. NoteIndex live no-op detection retains fixed-size canonical-document fingerprints rather than long-lived body or frontmatter strings for that detection. Persistent caching stores only discardable derived data.

## 4. Regression verification

`calendar-query-consistency.test.ts` compares cached business values with direct selector results. Provenance version fields are excluded from the business comparison; all other values must agree. Tests cover non-English paths across periodic-note types, modifications and deletions while readiness remains ready, and month/week updates to out-of-scope explicit range boundaries, moves, deletions, and marker changes. `interval-list-setup.test.ts` independently verifies that unmarked scanning does not block creation eligibility.

Full verification still requires `npm run check` and editing, moving, and deleting notes while the calendar remains open in real Obsidian, observing previews, statistics, and Gantt updates. Source tests do not substitute for host interaction verification.
