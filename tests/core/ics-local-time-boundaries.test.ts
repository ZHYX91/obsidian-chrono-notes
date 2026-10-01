import { afterEach, describe, expect, it, vi } from "vitest";

import { parseIcsCalendar } from "../../src/core/calendar/ics-calendar";

const eastern = [
  "BEGIN:VTIMEZONE", "TZID:Custom/Eastern",
  "BEGIN:DAYLIGHT", "DTSTART:20070311T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "TZOFFSETFROM:-0500", "TZOFFSETTO:-0400", "END:DAYLIGHT",
  "BEGIN:STANDARD", "DTSTART:20071104T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "TZOFFSETFROM:-0400", "TZOFFSETTO:-0500", "END:STANDARD",
  "END:VTIMEZONE",
];

function parseEvent(properties: readonly string[], embedded = false) {
  return parseIcsCalendar([
    "BEGIN:VCALENDAR", "VERSION:2.0", ...(embedded ? eastern : []),
    "BEGIN:VEVENT", "UID:boundary", ...properties, "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n"), "boundaries.ics", { displayZone: "UTC" });
}

afterEach(() => vi.useRealTimers());

describe.each([false, true])("ICS DST boundaries (embedded=%s)", (embedded) => {
  const zone = embedded ? "Custom/Eastern" : "America/New_York";
  it.each([
    ["2026-01-01T00:00:00Z", "20260308T023000", "2026-03-08T07:30:00.000Z"],
    ["2026-07-01T00:00:00Z", "20260308T023000", "2026-03-08T07:30:00.000Z"],
    ["2026-01-01T00:00:00Z", "20261101T013000", "2026-11-01T05:30:00.000Z"],
    ["2026-07-01T00:00:00Z", "20261101T013000", "2026-11-01T05:30:00.000Z"],
  ])("resolves %s / %s independently of the current clock", (now, start, expected) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    const result = parseEvent([`DTSTART;TZID=${zone}:${start}`, "DURATION:PT1H"], embedded);
    expect(result.skippedInvalid).toBe(0);
    expect(result.events).toHaveLength(1);
    expect(new Date(result.events[0]!.start.timestamp).toISOString()).toBe(expected);
    expect(result.events[0]!.endExclusive.timestamp - result.events[0]!.start.timestamp)
      .toBe(3_600_000);
  });

  it("uses the first overlap occurrence after a long nominal duration", () => {
    const result = parseEvent([`DTSTART;TZID=${zone}:20260101T013000`, "DURATION:P304D"], embedded);
    expect(result.events).toHaveLength(1);
    expect(new Date(result.events[0]!.endExclusive.timestamp).toISOString())
      .toBe("2026-11-01T05:30:00.000Z");
  });

  it.each([
    ["20260308T013000", "20260308T023000", "2026-03-08T07:30:00.000Z"],
    ["20261101T003000", "20261101T013000", "2026-11-01T05:30:00.000Z"],
  ])("resolves explicit DTEND %s / %s", (start, end, expected) => {
    const result = parseEvent([
      `DTSTART;TZID=${zone}:${start}`, `DTEND;TZID=${zone}:${end}`,
    ], embedded);
    expect(result.events).toHaveLength(1);
    expect(new Date(result.events[0]!.endExclusive.timestamp).toISOString()).toBe(expected);
  });

  it.each([
    ["20260307T023000", "2026-03-08T07:30:00.000Z"],
    ["20260308T023000", "2026-03-09T07:30:00.000Z"],
    ["20261031T013000", "2026-11-01T05:30:00.000Z"],
    ["20261101T013000", "2026-11-02T06:30:00.000Z"],
  ])("keeps nominal-day endpoint %s consistent", (start, expected) => {
    const result = parseEvent([`DTSTART;TZID=${zone}:${start}`, "DURATION:P1D"], embedded);
    expect(result.events).toHaveLength(1);
    expect(new Date(result.events[0]!.endExclusive.timestamp).toISOString()).toBe(expected);
  });

  it.each(["20260230T023000", "20260308T253000"])("rejects invalid civil fields %s", (start) => {
    const result = parseEvent([`DTSTART;TZID=${zone}:${start}`], embedded);
    expect(result.events).toHaveLength(0);
    expect(result.skippedInvalid).toBe(1);
  });
});

describe("ICS folded event-count limits", () => {
  it.each(["BEGIN:VEVENT", "BEGIN:VE\r\n VENT", "BEGIN:VE\r\n\tVENT"])(
    "enforces the exact limit for %s", (begin) => {
      const event = [begin, "UID:limit", "DTSTART:20260301T090000Z", "END:VEVENT"].join("\r\n");
      const calendar = (count: number) => [
        "BEGIN:VCALENDAR", "VERSION:2.0", ...Array<string>(count).fill(event), "END:VCALENDAR",
      ].join("\r\n");
      expect(parseIcsCalendar(calendar(10_000), "limit.ics", { displayZone: "UTC" }).events)
        .toHaveLength(10_000);
      expect(() => parseIcsCalendar(calendar(10_001), "limit.ics", { displayZone: "UTC" }))
        .toThrow("ICS source exceeds 10000 events");
    },
  );
});

describe("ICS non-hour timezone transitions", () => {
  it.each([
    ["Australia/Lord_Howe", "20261004T021500", "2026-10-03T15:45:00.000Z", []],
    ["Australia/Lord_Howe", "20260405T014500", "2026-04-04T14:45:00.000Z", []],
    ["Pacific/Apia", "20111230T120000", "2011-12-30T22:00:00.000Z", []],
    ["Custom/HalfHour", "20261004T021500", "2026-10-03T15:45:00.000Z", [
      "BEGIN:VTIMEZONE", "TZID:Custom/HalfHour",
      "BEGIN:DAYLIGHT", "DTSTART:20261004T020000",
      "TZOFFSETFROM:+1030", "TZOFFSETTO:+1100", "END:DAYLIGHT",
      "END:VTIMEZONE",
    ]],
    ["Custom/HalfHour", "20260405T014500", "2026-04-04T14:45:00.000Z", [
      "BEGIN:VTIMEZONE", "TZID:Custom/HalfHour",
      "BEGIN:STANDARD", "DTSTART:20260405T020000",
      "TZOFFSETFROM:+1100", "TZOFFSETTO:+1030", "END:STANDARD",
      "END:VTIMEZONE",
    ]],
    ["Custom/DateLine", "20111230T120000", "2011-12-30T22:00:00.000Z", [
      "BEGIN:VTIMEZONE", "TZID:Custom/DateLine",
      "BEGIN:STANDARD", "DTSTART:20111230T000000",
      "TZOFFSETFROM:-1000", "TZOFFSETTO:+1400", "END:STANDARD",
      "END:VTIMEZONE",
    ]],
  ])("resolves %s / %s with the actual transition width", (zone, start, expected, zones) => {
    const result = parseIcsCalendar([
      "BEGIN:VCALENDAR", "VERSION:2.0", ...zones,
      "BEGIN:VEVENT", "UID:non-hour", `DTSTART;TZID=${zone}:${start}`,
      "DURATION:PT1H", "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n"), "non-hour.ics", { displayZone: "UTC" });
    expect(result.skippedInvalid).toBe(0);
    expect(result.events).toHaveLength(1);
    expect(new Date(result.events[0]!.start.timestamp).toISOString()).toBe(expected);
    expect(result.events[0]!.endExclusive.timestamp - result.events[0]!.start.timestamp)
      .toBe(3_600_000);
  });
});
