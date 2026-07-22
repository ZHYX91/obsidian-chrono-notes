import { describe, expect, it } from "vitest";

import type { IcsEventIndexSnapshot } from "../../src/features/calendar/ics-event-index";
import { createTranslator } from "../../src/shared/i18n";
import {
  formatIcsSourceStatus,
  formatIcsStatus,
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
      "集成",
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

  it.each([
    ["zh-CN", "当前预览："],
    ["en", "Current preview:"],
    ["zh-TW", "目前預覽："],
  ] as const)("translates the periodic path preview label in %s", (locale, expected) => {
    expect(createTranslator(locale, "en").t("settings.periodic.pathPreviewLabel"))
      .toBe(expected);
  });

  it("explains Luxon literals and case sensitivity in the selected locale", () => {
    const english = createTranslator("en", "en").t("settings.periodic.pathsDesc");
    const chinese = createTranslator("zh-CN", "en").t("settings.periodic.pathsDesc");

    expect(english).toContain("case-sensitive Luxon date formatting");
    expect(english).toContain("single quotes");
    expect(chinese).toContain("区分大小写");
    expect(chinese).toContain("纯中文文本通常可以直接写");
  });

  it("names three neutral ordered holiday-region slots", () => {
    const t = createTranslator("zh-CN", "en").t;

    expect([
      t("settings.appearance.holidayRegionSlot1"),
      t("settings.appearance.holidayRegionSlot2"),
      t("settings.appearance.holidayRegionSlot3"),
    ]).toEqual(["地区 1", "地区 2", "地区 3"]);
  });
});
