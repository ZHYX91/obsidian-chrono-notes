import { describe, expect, it, vi } from "vitest";

import { formatIcsRefreshNotice } from "../../src/app/plugin-presentation";
import { IcsEventIndex } from "../../src/features/calendar/ics-event-index";
import { createTranslator } from "../../src/shared/i18n";
import { formatIcsStatus } from "../../src/ui/settings/settings-presentation";

const calendar = [
  "BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", "UID:sample",
  "DTSTART;VALUE=DATE:20260923", "DTEND;VALUE=DATE:20260925", "SUMMARY:Sample",
  "END:VEVENT", "END:VCALENDAR",
].join("\n");

describe("ICS source-limit feedback", () => {
  it("explains default source omissions in both user-facing surfaces", async () => {
    const read = vi.fn(async () => calendar);
    const index = new IcsEventIndex({ read });
    await index.refresh({
      enabled: true,
      sources: Array.from({ length: 35 }, (_, source) => `source-${source}.ics`),
      displayZone: "UTC",
    });

    const snapshot = index.getSnapshot();
    expect(read).toHaveBeenCalledTimes(32);
    expect(snapshot).toMatchObject({ sourceLimit: 32, totalSources: 35, loadedSources: 32 });
    for (const locale of ["en", "zh-CN"] as const) {
      const t = createTranslator(locale, "en").t;
      for (const message of [formatIcsStatus(snapshot, t), formatIcsRefreshNotice(snapshot, t)]) {
        expect(message).toContain(locale === "en" ? "first 32 sources" : "前 32 个来源");
        expect(message).toContain(locale === "en" ? "3 sources were omitted" : "已省略 3 个来源");
        expect(message).toContain(locale === "en" ? "Reduce or reorder" : "减少来源或调整来源顺序");
      }
    }
  });

  it("counts only omitted sources, keeping failed reads separate", async () => {
    const index = new IcsEventIndex({ read: async (source) => {
      if (source === "bad.ics") throw new Error("unreadable");
      return calendar;
    } }, { maxSources: 2 });
    await index.refresh({
      enabled: true, sources: ["a.ics", "bad.ics", "c.ics", " a.ics ", ""], displayZone: "UTC",
    });

    const snapshot = index.getSnapshot();
    expect(snapshot).toMatchObject({ totalSources: 3, loadedSources: 1, sourceLimit: 2 });
    expect(snapshot.errors).toHaveLength(1);
    const zh = createTranslator("zh-CN", "en").t;
    expect(formatIcsStatus(snapshot, zh)).toContain("已省略 1 个来源");
    const notice = formatIcsRefreshNotice(snapshot, createTranslator("en", "en").t);
    expect(notice).toContain("ICS partially refreshed");
    expect(notice).toContain("1 error");
    expect(notice).toContain("first 2 sources");
  });

  it("shows source and occurrence limits together without hiding either recovery action", async () => {
    const index = new IcsEventIndex({ read: async () => calendar }, { maxSources: 1, maxOccurrences: 1 });
    await index.refresh({ enabled: true, sources: ["a.ics", "b.ics"], displayZone: "UTC" });

    const snapshot = index.getSnapshot();
    const t = createTranslator("zh-CN", "en").t;
    for (const message of [formatIcsStatus(snapshot, t), formatIcsRefreshNotice(snapshot, t)]) {
      expect(message).toContain("已省略 1 个来源");
      expect(message).toContain("1 个事件未完整显示");
      expect(message).toContain("调整来源顺序");
      expect(message).toContain("缩短事件跨度");
    }
  });

  it("clears source-limit state at the exact cap and on disable", async () => {
    const index = new IcsEventIndex({ read: async () => calendar }, { maxSources: 1 });
    const options = { enabled: true, sources: ["a.ics", "b.ics"], displayZone: "UTC" };
    await index.refresh(options);
    expect(index.getSnapshot().sourceLimit).toBe(1);
    await index.refresh({ ...options, sources: ["a.ics", " a.ics ", ""] });
    expect(index.getSnapshot().sourceLimit).toBeUndefined();
    expect(index.getSnapshot().errors).toEqual([]);
    await index.refresh(options);
    await index.refresh({ ...options, enabled: false });
    expect(index.getSnapshot().sourceLimit).toBeUndefined();
  });
});
