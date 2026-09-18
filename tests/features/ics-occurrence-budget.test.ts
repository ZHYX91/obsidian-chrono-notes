import { describe, expect, it, vi } from "vitest";

import { IcsEventIndex } from "../../src/features/calendar/ics-event-index";

function calendar(events: readonly string[]): string {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", ...events, "END:VCALENDAR"].join("\n");
}

function allDay(uid: string, start: string, end: string): string[] {
  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${uid}`,
    "END:VEVENT",
  ];
}

describe("ICS occurrence budget", () => {
  it("publishes an explicit partial result instead of expanding without a global bound", async () => {
    const source = calendar([
      ...allDay("first", "20260101", "20260104"),
      ...allDay("second", "20260104", "20260107"),
      ...allDay("third", "20260107", "20260110"),
    ]);
    const index = new IcsEventIndex({ read: vi.fn(async () => source) }, {
      maxOccurrences: 5,
      now: () => 42,
    });

    await index.refresh({ enabled: true, sources: ["budget.ics"], displayZone: "UTC" });
    const snapshot = index.getSnapshot();

    expect(Object.values(snapshot.eventsByDate).flat()).toHaveLength(5);
    expect(snapshot.truncatedEvents).toBe(2);
    expect(snapshot.errors).toEqual([
      "ICS occurrence limit reached; events omitted.",
    ]);
    expect(snapshot.state).toBe("ready");
    expect(snapshot.refreshedAt).toBe(42);
  });

  it("lets a newer refresh supersede an older expansion at the fixed yield boundary", async () => {
    const first = calendar(Array.from({ length: 65 }, (_, index) =>
      allDay(`old-${index}`, "20260101", "20260102")
    ).flat());
    const second = calendar([
      ...allDay("new", "20260201", "20260202"),
    ]);
    const read = vi.fn(async (source: string) => source === "old.ics" ? first : second);
    const scheduled: Array<() => void> = [];
    vi.stubGlobal("window", {
      setTimeout: (callback: () => void) => {
        scheduled.push(callback);
        return 1;
      },
    });

    try {
      const index = new IcsEventIndex({ read });
      const staleRefresh = index.refresh({
        enabled: true,
        sources: ["old.ics"],
        displayZone: "UTC",
      });
      for (let attempt = 0; attempt < 10 && scheduled.length === 0; attempt += 1) {
        await Promise.resolve();
      }
      expect(scheduled).toHaveLength(1);

      const freshRefresh = index.refresh({
        enabled: true,
        sources: ["new.ics"],
        displayZone: "UTC",
      });
      scheduled[0]?.();
      await Promise.all([staleRefresh, freshRefresh]);

      const snapshot = index.getSnapshot();
      expect(snapshot.eventsByDate["2026-02-01"]?.map((event) => event.id)).toEqual(["new"]);
      expect(snapshot.eventsByDate["2026-01-01"]).toBeUndefined();
      expect(snapshot.eventCount).toBe(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps complete results and no budget error below the configured limit", async () => {
    const source = calendar([
      ...allDay("one", "20260301", "20260303"),
      ...allDay("two", "20260303", "20260304"),
    ]);
    const index = new IcsEventIndex({ read: async () => source }, {
      maxOccurrences: 10,
    });

    await index.refresh({ enabled: true, sources: ["small.ics"], displayZone: "UTC" });
    const snapshot = index.getSnapshot();
    expect(Object.values(snapshot.eventsByDate).flat()).toHaveLength(3);
    expect(snapshot.truncatedEvents).toBe(0);
    expect(snapshot.errors).toEqual([]);
  });
});
