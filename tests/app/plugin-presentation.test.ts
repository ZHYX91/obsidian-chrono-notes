import { describe, expect, it } from "vitest";

import type { IcsEventIndexSnapshot } from "../../src/features/calendar/ics-event-index";
import { createTranslator } from "../../src/shared/i18n";
import {
  formatIcsRefreshNotice,
  formatPeriodicNotConfiguredNotice,
  formatPluginErrorNotice,
  getPluginCommandMessages,
  getTaskCommandNotice,
} from "../../src/app/plugin-presentation";

function snapshot(overrides: Partial<IcsEventIndexSnapshot>): IcsEventIndexSnapshot {
  return Object.freeze({
    version: 1,
    contentVersion: 1,
    state: "ready",
    enabled: true,
    totalSources: 1,
    loadedSources: 1,
    eventCount: 0,
    skippedRecurring: 0,
    skippedInvalid: 0,
    truncatedEvents: 0,
    refreshedAt: 0,
    sourceStatuses: [],
    errors: [],
    eventsByDate: {},
    ...overrides,
  });
}

describe("plugin presentation", () => {
  it("translates command, ribbon, and periodic-note names", () => {
    const messages = getPluginCommandMessages(createTranslator("zh-CN", "en").t);

    expect(messages).toMatchObject({
      ribbonCalendar: "打开 Chrono Notes 日历",
      openCalendar: "打开日历",
      openRangeList: "打开区间笔记列表",
      openMiniCalendar: "打开迷你日历",
      jumpToDate: "跳转到日期",
    });
    expect(messages.openPeriodic("daily")).toBe("打开当前日记");
    expect(messages.openPeriodic("quarterly")).toBe("打开当前季度笔记");
  });

  it("preserves dynamic periodic types and raw error details", () => {
    const t = createTranslator("zh-TW", "en").t;

    expect(formatPeriodicNotConfiguredNotice("weekly", t)).toBe("請先設定並啟用週記。");
    expect(formatPluginErrorNotice("permission denied", t)).toBe(
      "Chrono Notes：permission denied",
    );
    expect(getTaskCommandNotice("stale", t)).toBe(
      "任務在更新前已變更，請重新整理後再試。",
    );
    expect(getTaskCommandNotice("line-missing", t)).toBe(
      getTaskCommandNotice("stale", t),
    );
    expect(getTaskCommandNotice("updated", t)).toBeNull();
  });

  it("formats ICS refresh states with English singular and plural counts", () => {
    const t = createTranslator("en", "en").t;

    expect(formatIcsRefreshNotice(snapshot({ enabled: false }), t)).toBe(
      "ICS display is disabled.",
    );
    expect(formatIcsRefreshNotice(snapshot({ totalSources: 0 }), t)).toBe(
      "No ICS sources configured.",
    );
    expect(formatIcsRefreshNotice(snapshot({
      loadedSources: 1,
      totalSources: 2,
      eventCount: 1,
      errors: ["broken.ics"],
    }), t)).toBe("ICS partially refreshed: 1/2 sources, 1 event, 1 error.");
    expect(formatIcsRefreshNotice(snapshot({
      eventCount: 2,
      skippedRecurring: 1,
      skippedInvalid: 2,
    }), t)).toBe(
      "ICS refreshed: 1 source, 2 events. Skipped 1 recurring event. Skipped 2 invalid events.",
    );
  });
});
