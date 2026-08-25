import { describe, expect, it } from "vitest";

import type { IcsEventIndexSnapshot } from "../../src/features/calendar/ics-event-index";
import { createTranslator } from "../../src/shared/i18n";
import {
  formatIcsSourceStatus,
  formatIcsStatus,
  formatNoteIndexCacheStatus,
  formatNoteIndexStatus,
  getSettingsTabLabels,
  periodicNoteLabel,
} from "../../src/ui/settings/settings-presentation";

function snapshot(
  overrides: Partial<IcsEventIndexSnapshot> = {},
): IcsEventIndexSnapshot {
  return Object.freeze({
    version: 1,
    contentVersion: 1,
    state: "ready",
    enabled: true,
    totalSources: 2,
    loadedSources: 1,
    eventCount: 3,
    skippedRecurring: 4,
    skippedInvalid: 5,
    truncatedEvents: 0,
    refreshedAt: 1,
    sourceStatuses: Object.freeze([]),
    errors: Object.freeze(["broken"]),
    eventsByDate: Object.freeze({}),
    ...overrides,
  });
}

describe("settings presentation", () => {
  it("builds all five translated tab labels and periodic note headings", () => {
    const t = createTranslator("zh-CN", "en").t;

    expect(getSettingsTabLabels(t).map((tab) => tab.label)).toEqual([
      "常规",
      "外观与视图",
      "周期笔记",
      "区间笔记",
      "扩展与集成",
    ]);
    expect(periodicNoteLabel("quarterly", t)).toBe("季度笔记");
  });

  it("formats disabled, refreshing, empty, and ready ICS summaries", () => {
    const t = createTranslator("en", "en").t;

    expect(formatIcsStatus(null, t)).toBe("ICS display is disabled.");
    expect(formatIcsStatus(snapshot({ state: "refreshing" }), t))
      .toBe("Refreshing local calendar sources.");
    expect(formatIcsStatus(snapshot({ totalSources: 0 }), t))
      .toBe("No ICS sources configured.");
    expect(formatIcsStatus(snapshot(), t)).toBe(
      "1/2 sources, 3 events, 4 recurring and 5 invalid skipped, 1 errors.",
    );
  });

  it("formats per-source success and error state in the selected locale", () => {
    const t = createTranslator("zh-TW", "en").t;

    expect(formatIcsSourceStatus({
      source: "team.ics",
      sourceLabel: "team.ics",
      eventCount: 3,
      skippedRecurring: 2,
      skippedInvalid: 1,
      error: null,
    }, t)).toBe("team.ics：3 個事件，已略過 2 個重複規則和 1 個無效事件");
    expect(formatIcsSourceStatus({
      source: "broken.ics",
      sourceLabel: "broken.ics",
      eventCount: 0,
      skippedRecurring: 0,
      skippedInvalid: 0,
      error: "無法讀取",
    }, t)).toBe("broken.ics：無法讀取");
  });

  it("formats the minimal note-index and current-Vault cache health states", () => {
    const t = createTranslator("en", "en").t;
    const ready = {
      active: true,
      readiness: "ready",
      noteCount: 12,
      errorCount: 1,
      cacheConfigured: true,
      rebuildingCache: false,
    } as const;

    expect(formatNoteIndexStatus(ready, t)).toBe(
      "Ready. 12 notes indexed; 1 read errors.",
    );
    expect(formatNoteIndexStatus({
      ...ready,
      active: false,
      rebuildingCache: true,
    }, t)).toContain("Rebuilding from Vault files");
    expect(formatNoteIndexCacheStatus({
      state: "stored",
      entryCount: 12,
    }, t)).toBe("Derived index data for 12 notes is stored for this Vault.");
    expect(formatNoteIndexCacheStatus({ state: "unavailable" }, t))
      .toBe("Persistent cache is unavailable in this environment.");
    expect(formatNoteIndexCacheStatus({ state: "legacy" }, t))
      .toContain("legacy cache");
  });

  it.each([
    ["zh-CN", "当前预览："],
    ["en", "Current preview:"],
    ["zh-TW", "目前預覽："],
  ] as const)("translates the periodic path preview label in %s", (locale, expected) => {
    expect(createTranslator(locale, "en").t("settings.periodic.pathPreviewLabel"))
      .toBe(expected);
  });

  it("explains the shared Obsidian/Moment path syntax", () => {
    const english = createTranslator("en", "en").t("settings.periodic.pathsDesc");
    const chinese = createTranslator("zh-CN", "en").t("settings.periodic.pathsDesc");

    expect(english).toContain("Obsidian/Moment");
    expect(english).toContain("[diary]/YYYY/YYYY-MM/YYYY-MM-DD");
    expect(english).toContain("square brackets");
    expect(chinese).toContain("Obsidian/Moment");
    expect(chinese).toContain("英文方括号");
  });

  it("names three ordered holiday-extension regions", () => {
    const t = createTranslator("zh-CN", "en").t;

    expect([
      t("settings.extensions.holidayRegionSlot1"),
      t("settings.extensions.holidayRegionSlot2"),
      t("settings.extensions.holidayRegionSlot3"),
    ]).toEqual(["第一个地区", "第二个地区", "第三个地区"]);
  });

  it("names calendar slots by calendar rather than generic extension", () => {
    const t = createTranslator("zh-CN", "en").t;

    expect([
      t("settings.extensions.calendarSlot1"),
      t("settings.extensions.calendarSlot2"),
    ]).toEqual(["第一个历法", "第二个历法"]);
  });
});
