import { describe, expect, it } from "vitest";

import { buildIcsDateIndex, parseIcsCalendar } from "../../src/core/calendar/ics-calendar";

function calendar(properties: readonly string[], displayZone = "America/New_York") {
  const result = parseIcsCalendar([
    "BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", "UID:boundary",
    ...properties, "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n"), "boundaries.ics", { displayZone });
  expect(result.skippedInvalid).toBe(0);
  expect(result.events).toHaveLength(1);
  const event = result.events[0];
  if (event === undefined) throw new Error("Missing boundary event");
  return { event, index: buildIcsDateIndex(result.events) };
}

describe("ICS nominal durations and point events", () => {
  it.each([
    ["20260307T233000", "P1D", "2026-03-09T03:30:00.000Z", 23],
    ["20260307T233000", "PT24H", "2026-03-09T04:30:00.000Z", 24],
    ["20261031T233000", "P1D", "2026-11-02T04:30:00.000Z", 25],
    ["20261031T233000", "PT24H", "2026-11-02T03:30:00.000Z", 24],
    ["20260307T233000", "P1W", "2026-03-15T03:30:00.000Z", 167],
    ["20260307T233000", "P1DT2H", "2026-03-09T05:30:00.000Z", 25],
  ] as const)("computes %s + %s in the source zone", (start, duration, end, hours) => {
    const { event } = calendar([
      `DTSTART;TZID=America/New_York:${start}`, `DURATION:${duration}`,
    ], "UTC");
    expect(new Date(event.endExclusive.timestamp).toISOString()).toBe(end);
    expect(event.endExclusive.timestamp - event.start.timestamp).toBe(hours * 3_600_000);
    expect(event.start.zone).toBe("UTC");
    expect(event.endExclusive.zone).toBe("UTC");
  });

  it("does not add an extra calendar day when P1D crosses the spring transition", () => {
    const { event, index } = calendar([
      "DTSTART;TZID=America/New_York:20260307T233000", "DURATION:P1D",
    ]);
    expect(event.endExclusive).toMatchObject({
      date: { year: 2026, month: 3, day: 8 }, timeMinutes: 23 * 60 + 30,
    });
    expect(Object.keys(index.eventsByDate)).toEqual(["2026-03-07", "2026-03-08"]);
    expect(index.eventsByDate["2026-03-08"]?.[0]).toMatchObject({
      startsOnDate: false, endsOnDate: true, continuesAfter: false,
    });
  });

  it("uses the display zone as the source zone only for floating times", () => {
    const { event } = calendar(["DTSTART:20260307T233000", "DURATION:P1D"]);
    expect(event.endExclusive.timestamp - event.start.timestamp).toBe(23 * 3_600_000);
    expect(event.endExclusive.timeMinutes).toBe(23 * 60 + 30);
  });

  it("does not perform UTC-source nominal-day arithmetic in the display zone", () => {
    const { event } = calendar(["DTSTART:20260308T043000Z", "DURATION:P1D"]);
    expect(event.endExclusive.timestamp - event.start.timestamp).toBe(24 * 3_600_000);
    expect(event.endExclusive).toMatchObject({
      date: { year: 2026, month: 3, day: 9 }, timeMinutes: 30,
    });
  });

  it.each([
    ["20260913T235930Z", "23:59"],
    ["20260913T000000Z", "00:00"],
  ])("indexes the implicit point %s exactly once on its start date", (start, timeLabel) => {
    const { event, index } = calendar([`DTSTART:${start}`], "UTC");
    expect(event.endExclusive.timestamp).toBe(event.start.timestamp);
    expect(Object.keys(index.eventsByDate)).toEqual(["2026-09-13"]);
    expect(index.eventsByDate["2026-09-13"]).toEqual([
      expect.objectContaining({
        startsOnDate: true, endsOnDate: true, continuesBefore: false,
        continuesAfter: false, timeLabel,
      }),
    ]);
  });

  it("places a UTC point on its local display date without extending it", () => {
    const { event, index } = calendar(["DTSTART:20260914T010000Z"], "America/Los_Angeles");
    expect(event.endExclusive.timestamp).toBe(event.start.timestamp);
    expect(Object.keys(index.eventsByDate)).toEqual(["2026-09-13"]);
  });

  it("keeps DATE durations zone-free and their ends exclusive", () => {
    const { event, index } = calendar(["DTSTART;VALUE=DATE:20260307", "DURATION:P2D"]);
    expect(event.endExclusive).toMatchObject({
      date: { year: 2026, month: 3, day: 9 }, timeMinutes: null, zone: "UTC",
    });
    expect(Object.keys(index.eventsByDate)).toEqual(["2026-03-07", "2026-03-08"]);
  });
});
