import { describe, expect, it, vi } from "vitest";

import {
  IcsEventIndex,
  type IcsSourceReader,
} from "../../src/features/calendar/ics-event-index";

const calendar = (uid: string, date: string, title = uid) => [
  "BEGIN:VCALENDAR",
  "BEGIN:VEVENT",
  `UID:${uid}`,
  `DTSTART;VALUE=DATE:${date}`,
  `SUMMARY:${title}`,
  "END:VEVENT",
  "END:VCALENDAR",
].join("\n");

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("IcsEventIndex", () => {
  it("deduplicates sources and preserves successful events beside source errors", async () => {
    const reader: IcsSourceReader = {
      read: vi.fn(async (source) => {
        if (source === "bad.ics") throw new Error("permission denied");
        return calendar("ready", "20260506", "Ready event");
      }),
    };
    const index = new IcsEventIndex(reader, { now: () => 1234 });
    const listener = vi.fn();
    index.subscribe(listener);

    await index.refresh({
      enabled: true,
      sources: [" team.ics ", "team.ics", "", "bad.ics"],
      displayZone: "UTC",
    });

    expect(reader.read).toHaveBeenCalledTimes(2);
    expect(index.getSnapshot()).toMatchObject({
      state: "ready",
      enabled: true,
      totalSources: 2,
      loadedSources: 1,
      eventCount: 1,
      refreshedAt: 1234,
      sourceStatuses: [
        { source: "team.ics", eventCount: 1, error: null },
        { source: "bad.ics", eventCount: 0, error: "permission denied" },
      ],
    });
    expect(index.getSnapshot().eventsByDate["2026-05-06"]?.[0]?.title).toBe("Ready event");
    expect(Object.isFrozen(index.getSnapshot())).toBe(true);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("continues notifying subscribers after one of them throws", async () => {
    const reader: IcsSourceReader = {
      read: vi.fn(async () => calendar("ready", "20260506")),
    };
    const index = new IcsEventIndex(reader);
    const listenerError = new Error("broken subscriber");
    const reportError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failingListener = vi.fn(() => {
      throw listenerError;
    });
    const remainingListener = vi.fn();
    index.subscribe(failingListener);
    index.subscribe(remainingListener);

    await expect(index.refresh({
      enabled: true,
      sources: ["team.ics"],
      displayZone: "UTC",
    })).resolves.toBeUndefined();

    expect(index.getSnapshot().state).toBe("ready");
    expect(failingListener).toHaveBeenCalledTimes(2);
    expect(remainingListener).toHaveBeenCalledTimes(2);
    expect(reportError).toHaveBeenCalledTimes(2);
    expect(reportError).toHaveBeenCalledWith(
      "Chrono Notes: listener notification failed",
      listenerError,
    );
    reportError.mockRestore();
  });

  it("starts a fresh same-source read for the latest overlapping revision", async () => {
    const oldRead = deferred<string>();
    const latestRead = deferred<string>();
    const reader: IcsSourceReader = {
      read: vi.fn()
        .mockReturnValueOnce(oldRead.promise)
        .mockReturnValueOnce(latestRead.promise),
    };
    const index = new IcsEventIndex(reader);
    const options = { enabled: true, sources: ["same.ics"], displayZone: "UTC" } as const;

    const first = index.refresh(options);
    const second = index.refresh(options);
    expect(reader.read).toHaveBeenCalledTimes(2);
    latestRead.resolve(calendar("latest", "20260507"));
    await second;

    expect(index.getSnapshot().eventsByDate["2026-05-06"]).toBeUndefined();
    expect(index.getSnapshot().eventsByDate["2026-05-07"]?.[0]?.id).toBe("latest");
    oldRead.resolve(calendar("old", "20260506"));
    await first;
    expect(index.getSnapshot().eventsByDate["2026-05-07"]?.[0]?.id).toBe("latest");
  });

  it("does not reuse an enabled read after a disable-enable revision boundary", async () => {
    const oldRead = deferred<string>();
    const latestRead = deferred<string>();
    const reader: IcsSourceReader = {
      read: vi.fn()
        .mockReturnValueOnce(oldRead.promise)
        .mockReturnValueOnce(latestRead.promise),
    };
    const index = new IcsEventIndex(reader);
    const options = { enabled: true, sources: ["same.ics"], displayZone: "UTC" } as const;

    const first = index.refresh(options);
    await index.refresh({ ...options, enabled: false });
    const latest = index.refresh(options);
    expect(reader.read).toHaveBeenCalledTimes(2);
    latestRead.resolve(calendar("latest", "20260507"));
    await latest;

    expect(index.getSnapshot().state).toBe("ready");
    expect(index.getSnapshot().eventsByDate["2026-05-06"]).toBeUndefined();
    expect(index.getSnapshot().eventsByDate["2026-05-07"]?.[0]?.id).toBe("latest");
    oldRead.resolve(calendar("old", "20260506"));
    await first;
    expect(index.getSnapshot().eventsByDate["2026-05-07"]?.[0]?.id).toBe("latest");
  });

  it("keeps calendar content identity stable while refreshing unchanged data", async () => {
    const pending = deferred<string>();
    const reader: IcsSourceReader = {
      read: vi.fn()
        .mockResolvedValueOnce(calendar("same", "20260507"))
        .mockReturnValueOnce(pending.promise),
    };
    const index = new IcsEventIndex(reader);
    const options = { enabled: true, sources: ["same.ics"], displayZone: "UTC" } as const;

    await index.refresh(options);
    const ready = index.getSnapshot();
    const secondRefresh = index.refresh(options);
    const refreshing = index.getSnapshot();

    expect(refreshing.state).toBe("refreshing");
    expect(refreshing.contentVersion).toBe(ready.contentVersion);
    expect(refreshing.eventsByDate).toBe(ready.eventsByDate);
    pending.resolve(calendar("same", "20260507"));
    await secondRefresh;

    const unchanged = index.getSnapshot();
    expect(unchanged.version).toBeGreaterThan(ready.version);
    expect(unchanged.contentVersion).toBe(ready.contentVersion);
    expect(unchanged.eventsByDate).toBe(ready.eventsByDate);
    expect(unchanged.eventsByDate["2026-05-07"]).toBe(
      ready.eventsByDate["2026-05-07"],
    );
  });

  it("reuses unchanged date buckets when only one source date changes", async () => {
    let movingDate = "20260508";
    const reader: IcsSourceReader = {
      read: vi.fn(async (source) => source === "fixed.ics"
        ? calendar("fixed", "20260507")
        : calendar("moving", movingDate)),
    };
    const index = new IcsEventIndex(reader);
    const options = {
      enabled: true,
      sources: ["fixed.ics", "moving.ics"],
      displayZone: "UTC",
    } as const;

    await index.refresh(options);
    const before = index.getSnapshot();
    const fixedBucket = before.eventsByDate["2026-05-07"];
    movingDate = "20260509";
    await index.refresh(options);
    const after = index.getSnapshot();

    expect(after.contentVersion).toBe(before.contentVersion + 1);
    expect(after.eventsByDate).not.toBe(before.eventsByDate);
    expect(after.eventsByDate["2026-05-07"]).toBe(fixedBucket);
    expect(after.eventsByDate["2026-05-08"]).toBeUndefined();
    expect(after.eventsByDate["2026-05-09"]?.[0]?.id).toBe("moving");
  });

  it("repartitions timed events when the display time zone changes", async () => {
    const timedCalendar = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:timezone-shift",
      "DTSTART:20260721T233000Z",
      "DTEND:20260722T003000Z",
      "SUMMARY:Late call",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const reader: IcsSourceReader = {
      read: vi.fn(async () => timedCalendar),
    };
    const index = new IcsEventIndex(reader);

    await index.refresh({
      enabled: true,
      sources: ["timezone.ics"],
      displayZone: "Asia/Shanghai",
    });
    const shanghai = index.getSnapshot();
    expect(shanghai.eventsByDate["2026-07-22"]?.[0]).toMatchObject({
      id: "timezone-shift",
      timeLabel: "07:30",
    });

    await index.refresh({
      enabled: true,
      sources: ["timezone.ics"],
      displayZone: "America/Los_Angeles",
    });
    const losAngeles = index.getSnapshot();
    expect(reader.read).toHaveBeenCalledTimes(2);
    expect(losAngeles.contentVersion).toBe(shanghai.contentVersion + 1);
    expect(losAngeles.eventsByDate["2026-07-22"]).toBeUndefined();
    expect(losAngeles.eventsByDate["2026-07-21"]?.[0]).toMatchObject({
      id: "timezone-shift",
      timeLabel: "16:30",
    });
  });

  it("prevents an older refresh from overwriting a newer source revision", async () => {
    const oldRead = deferred<string>();
    const newRead = deferred<string>();
    const reader: IcsSourceReader = {
      read: vi.fn((source) => source === "old.ics" ? oldRead.promise : newRead.promise),
    };
    const index = new IcsEventIndex(reader);

    const oldRefresh = index.refresh({ enabled: true, sources: ["old.ics"], displayZone: "UTC" });
    const newRefresh = index.refresh({ enabled: true, sources: ["new.ics"], displayZone: "UTC" });
    newRead.resolve(calendar("new", "20260508"));
    await newRefresh;
    oldRead.resolve(calendar("old", "20260509"));
    await oldRefresh;

    expect(index.getSnapshot().sourceStatuses.map((status) => status.source)).toEqual(["new.ics"]);
    expect(index.getSnapshot().eventsByDate["2026-05-08"]?.[0]?.id).toBe("new");
    expect(index.getSnapshot().eventsByDate["2026-05-09"]).toBeUndefined();
  });

  it("clears disabled state and rejects late results after stop", async () => {
    const pending = deferred<string>();
    const reader: IcsSourceReader = { read: () => pending.promise };
    const index = new IcsEventIndex(reader);
    const refresh = index.refresh({ enabled: true, sources: ["slow.ics"], displayZone: "UTC" });

    await index.refresh({ enabled: false, sources: ["slow.ics"], displayZone: "UTC" });
    expect(index.getSnapshot()).toMatchObject({ state: "disabled", enabled: false, eventCount: 0 });
    index.stop();
    pending.resolve(calendar("late", "20260510"));
    await refresh;

    expect(index.getSnapshot()).toMatchObject({ state: "disabled", enabled: false, eventCount: 0 });
  });

  it("releases published event data on stop without mutating the old snapshot", async () => {
    const index = new IcsEventIndex({
      read: async () => calendar("retained", "20260510"),
    });
    await index.refresh({ enabled: true, sources: ["ready.ics"], displayZone: "UTC" });
    const beforeStop = index.getSnapshot();
    const listener = vi.fn();
    index.subscribe(listener);

    index.stop();

    expect(index.getSnapshot()).toMatchObject({
      version: beforeStop.version + 1,
      contentVersion: beforeStop.contentVersion + 1,
      state: "disabled",
      eventCount: 0,
      eventsByDate: {},
    });
    expect(beforeStop.eventsByDate["2026-05-10"]?.[0]?.id).toBe("retained");
    expect(listener).not.toHaveBeenCalled();
  });
});
