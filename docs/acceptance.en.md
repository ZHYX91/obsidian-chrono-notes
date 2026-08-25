---
source_language: zh-CN
translation_of: acceptance.zh-CN.md
translation_status: synced
---

# Candidate acceptance record

## 1. Scope

This record pins the evidence boundary for the Chrono Notes 0.4.4 candidate. Source gates, candidate runtime files, desktop-host behavior, mobile-host behavior, public publication, and production-Vault deployment are separate evidence layers. This run did not push, tag, create a GitHub Release, or deploy to a production Vault.

## 2. Exact candidate

The desktop host used these 0.4.4 runtime files. Their bytes matched between the isolated Vault and the host installation:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `main.js` | 1,288,220 | `08a924a23ade3500479bfb004eba0ab5185fe67d560c5a7ebb645a266bae5997` |
| `manifest.json` | 322 | `282ca4d263df91f2d3aece73b154a20ab85ec629c11b02c568e312f2aad9afac` |
| `styles.css` | 62,189 | `bc81a8edac06b3c7a13a52ac3dd47fb087f6123818578a9126cb2d4efc5a3f9e` |

An independent frozen install, complete `release:check`, and second reproducible build produced the candidate. Runtime hashes are the stable binding between host behavior and build evidence; the final local commit identity is reported separately at handoff.

## 3. Desktop-host results

The following checks passed in a one-time isolated Vault on the Obsidian 1.13.7 desktop host:

- The plugin enabled and its settings page reported Chrono Notes 0.4.4. All eight explicit languages and Follow Obsidian were discoverable. Following the host used the host's Chinese locale and persisted as `auto`.
- The first-use guide set `firstUseGuideSeen` to `true` only after the guide was actually displayed, and it did not reappear after restart.
- One shared Markdown projection indexed only one real task. The preview retained only visible text, the real link, the real tag, and one real embed; fenced code, inline code, and HTML comments did not contribute fake tasks, dates, links, tags, or embeds. The calendar reported 18 words, 0/1 completed tasks, and one image. The source-note SHA-256 stayed `f73391c4761337873cd66b7253137c32635ac3948ed6eced3771ddfde4b4c90d` before and after interaction.
- After raising settings to future schema 19 and adding an unknown field, an attempted UI setting change did not write to disk. The settings SHA-256 stayed `ba3caac9d68249113347596d6922362d95906b11ab549c22549485ca36de6b92`, preserving `locale: auto` and the unknown field.
- The calendar displayed all-day, timed, and multi-day events from a local ICS source. A weekly note opened and related three overlapping range notes with correct boundaries. Restart restored the active note, calendar index, range relations, and language setting.

## 4. Deterministic boundary evidence

No reusable local Templater plugin candidate was available, so this record does not claim real-host Templater integration. Adapter and command tests in the complete gate prove explicit failure when Templater is unavailable, serialization of one instance's running-config and parse critical section, and rollback plus retry after deferred periodic or range rendering fails.

A normal ICS source was exercised in the desktop host. Deterministic tests in the complete gate pin the resource limits: at most 32 deduplicated sources, at most four reads in flight globally, and at most 5 MiB of UTF-8 input plus 10,000 `VEVENT` components per source. Oversized input is rejected before component construction, and late results from an older revision cannot replace current state.

## 5. Mobile coverage

An Android 15 / API 35 emulator booted, and the three candidate runtime files matched the hashes in section 2 on the device. The available Obsidian installation in a fresh data image required the system-level all-files permission, while acceptance must not change or bypass system privacy or security settings. The same AVD had no provably clean, already-authorized, restorable `clean_zh_gboard` snapshot. Mobile core-host behavior is therefore infrastructure-not-covered, with no inferred product pass or failure. The isolated Vault and emulator data were cleaned.

## 6. Excluded claims

This record does not claim real-host Templater compatibility, Android-host compatibility, physical-device compatibility, public Release state, or production-Vault deployment state. Any later publication must rebind the exact commit, candidate assets, and hosted bytes under the release procedure.
