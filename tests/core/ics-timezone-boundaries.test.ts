import { describe, expect, it } from "vitest";

import { parseIcsCalendar, type IcsParseResult } from "../../src/core/calendar/ics-calendar";
import {
  MAX_ICS_TIMEZONE_TRANSITIONS,
  MAX_ICS_TIMEZONE_WORK,
} from "../../src/core/calendar/ics-timezone";

const fixedObservance = [
  "BEGIN:STANDARD", "DTSTART:19700101T000000",
  "TZOFFSETFROM:+0800", "TZOFFSETTO:+0800", "END:STANDARD",
];

function zone(id: string, observances: readonly string[]): readonly string[] {
  return ["BEGIN:VTIMEZONE", `TZID:${id}`, ...observances, "END:VTIMEZONE"];
}

function event(id: string, start: string, extra: readonly string[] = []): readonly string[] {
  return ["BEGIN:VEVENT", `UID:${id}`, `DTSTART${start}`, ...extra, "END:VEVENT"];
}

function parse(zones: readonly string[], events: readonly string[]): IcsParseResult {
  return parseIcsCalendar([
    "BEGIN:VCALENDAR", "VERSION:2.0", ...zones, ...events,
    ...event("utc-neighbor", ":20260701T090000Z"), "END:VCALENDAR",
  ].join("\r\n"), "timezones.ics", { displayZone: "UTC" });
}

function start(result: IcsParseResult, id: string): string {
  return new Date(result.events.find((entry) => entry.id === id)!.start.timestamp).toISOString();
}

function expectUnsupported(result: IcsParseResult, count = 1): void {
  expect(result.skippedUnsupportedTimezone).toBe(count);
  expect(result.skippedInvalid).toBe(0);
  expect(result.skippedRecurring).toBe(0);
  expect(start(result, "utc-neighbor")).toBe("2026-07-01T09:00:00.000Z");
}

describe("ICS embedded timezone validation", () => {
  it.each([false, true])("isolates an unnamed timezone regardless of order (first=%s)", (first) => {
    const unnamed = ["BEGIN:VTIMEZONE", ...fixedObservance, "END:VTIMEZONE"];
    const valid = zone("Custom/Valid", fixedObservance);
    const result = parse(first ? [...unnamed, ...valid] : [...valid, ...unnamed], [
      ...event("custom", ";TZID=Custom/Valid:20260701T090000"),
      ...event("iana", ";TZID=Asia/Shanghai:20260701T090000"),
    ]);
    expect(result.skippedInvalid).toBe(0);
    expect(result.skippedUnsupportedTimezone).toBe(0);
    expect(result.events.map((entry) => entry.id)).toEqual(["custom", "iana", "utc-neighbor"]);
    expect(start(result, "custom")).toBe("2026-07-01T01:00:00.000Z");
    expect(start(result, "iana")).toBe("2026-07-01T01:00:00.000Z");
    expect(start(result, "utc-neighbor")).toBe("2026-07-01T09:00:00.000Z");
  });

  it.each([
    ["no observance", []],
    ["missing DTSTART", fixedObservance.filter((line) => !line.startsWith("DTSTART"))],
    ["missing TZOFFSETFROM", fixedObservance.filter((line) => !line.startsWith("TZOFFSETFROM"))],
    ["missing TZOFFSETTO", fixedObservance.filter((line) => !line.startsWith("TZOFFSETTO"))],
    ["duplicate DTSTART", [...fixedObservance.slice(0, -1), "DTSTART:19700102T000000", "END:STANDARD"]],
    ["invalid date", fixedObservance.map((line) => line.replace("19700101", "20260230"))],
    ["invalid clock", fixedObservance.map((line) => line.replace("T000000", "T250000"))],
    ["UTC DTSTART", fixedObservance.map((line) => line.replace("T000000", "T000000Z"))],
    ["date-only DTSTART", fixedObservance.map((line) =>
      line.replace("DTSTART:19700101T000000", "DTSTART;VALUE=DATE:19700101"))],
    ["TZID on DTSTART", fixedObservance.map((line) =>
      line.replace("DTSTART:", "DTSTART;TZID=Asia/Shanghai:"))],
    ["invalid offset hour", fixedObservance.map((line) => line.replace("+0800", "+2400"))],
    ["invalid offset minute", fixedObservance.map((line) => line.replace("+0800", "+0860"))],
    ["negative zero offset", fixedObservance.map((line) => line.replace("+0800", "-0000"))],
    ["invalid RDATE tail", [...fixedObservance.slice(0, -1),
      "RDATE:20260301T000000,20270230T000000", "END:STANDARD"]],
    ["UTC RDATE", [...fixedObservance.slice(0, -1), "RDATE:20260301T000000Z", "END:STANDARD"]],
    ["period RDATE", [...fixedObservance.slice(0, -1),
      "RDATE;VALUE=PERIOD:20260301T000000/20260302T000000", "END:STANDARD"]],
    ["invalid second observance", [...fixedObservance, "BEGIN:DAYLIGHT", "END:DAYLIGHT"]],
  ])("isolates %s without silently using UTC or an IANA fallback", (_name, observances) => {
    const result = parse([
      ...zone("Asia/Shanghai", observances), ...zone("Custom/Valid", fixedObservance),
    ], [
      ...event("bad", ";TZID=Asia/Shanghai:20260701T090000"),
      ...event("valid", ";TZID=Custom/Valid:20260701T090000"),
    ]);
    expectUnsupported(result);
    expect(result.events.map((entry) => entry.id)).toEqual(["valid", "utc-neighbor"]);
    expect(start(result, "valid")).toBe("2026-07-01T01:00:00.000Z");
  });

  it("rejects every identifier in an ambiguous TZID property list", () => {
    const result = parse(zone("Custom/A", ["TZID:Asia/Shanghai", ...fixedObservance]), [
      ...event("a", ";TZID=Custom/A:20260701T090000"),
      ...event("b", ";TZID=Asia/Shanghai:20260701T090000"),
    ]);
    expectUnsupported(result, 2);
    expect(result.events).toHaveLength(1);
  });

  it("rejects duplicate definitions and does not exempt an embedded UTC identifier", () => {
    const result = parse([
      ...zone("UTC", []), ...zone("Custom/Duplicate", fixedObservance),
      ...zone("Custom/Duplicate", fixedObservance),
    ], [
      ...event("utc-id", ";TZID=UTC:20260701T090000"),
      ...event("duplicate", ";TZID=Custom/Duplicate:20260701T090000"),
    ]);
    expectUnsupported(result, 2);
    expect(result.events).toHaveLength(1);
  });

  it("preserves second-precision UTC offsets", () => {
    const result = parse(zone("Custom/Seconds", fixedObservance.map((line) =>
      line.replace("+0800", "+080030"))), event("seconds", ";TZID=Custom/Seconds:20260701T090000"));
    expect(result.skippedUnsupportedTimezone).toBe(0);
    expect(start(result, "seconds")).toBe("2026-07-01T00:59:30.000Z");
  });
});

describe("ICS bounded timezone recurrence", () => {
  it.each(["SECONDLY", "MINUTELY", "HOURLY", "DAILY", "WEEKLY", "MONTHLY"])(
    "rejects %s before it can expand, while preserving neighboring zones", (frequency) => {
      const result = parse([
        ...zone("Custom/Dense", [
          "BEGIN:STANDARD", "DTSTART:20000101T000000", "TZOFFSETFROM:+0800", "TZOFFSETTO:+0800",
          `RRULE:FREQ=${frequency}`, "END:STANDARD",
        ]),
        ...zone("Custom/Valid", fixedObservance),
      ], [
        ...event("dense", ";TZID=Custom/Dense:20260101T090000"),
        ...event("valid", ";TZID=Custom/Valid:20260701T090000"),
      ]);
      expectUnsupported(result);
      expect(start(result, "valid")).toBe("2026-07-01T01:00:00.000Z");
    },
  );

  it.each([
    "FREQ=YEARLY;INTERVAL=0",
    "FREQ=YEARLY;COUNT=0",
    "FREQ=YEARLY;INTERVAL=1;INTERVAL=2",
    "FREQ=YEARLY;FREQ=SECONDLY",
    "FREQ=YEARLY;BYMONTH=13",
    "FREQ=YEARLY;BYMONTHDAY=0",
    "FREQ=YEARLY;BYYEARDAY=367",
    "FREQ=YEARLY;BYDAY=0SU",
    "FREQ=YEARLY;BYDAY=54MO",
    "FREQ=YEARLY;BYHOUR=24",
    "FREQ=YEARLY;BYMINUTE=60",
    "FREQ=YEARLY;BYSECOND=60",
    "FREQ=YEARLY;BYSETPOS=1",
    "FREQ=YEARLY;BYWEEKNO=2",
    "FREQ=YEARLY;UNTIL=20260101T000000",
    "FREQ=YEARLY;UNTIL=19690101T000000Z",
    "FREQ=YEARLY;COUNT=2;UNTIL=20260101T000000Z",
  ])("rejects unsupported or invalid recurrence %s", (rule) => {
    const result = parse(zone("Custom/Rule", [
      ...fixedObservance.slice(0, -1), `RRULE:${rule}`, "END:STANDARD",
    ]), event("rule", ";TZID=Custom/Rule:20260701T090000"));
    expectUnsupported(result);
    expect(result.events).toHaveLength(1);
  });

  it("bounds YEARLY candidate work before BYSETPOS reduces its output", () => {
    const seconds = Array.from({ length: 60 }, (_, index) => index).join(",");
    const hours = Array.from({ length: 24 }, (_, index) => index).join(",");
    expect(366 * 24 * 60 * 60).toBeGreaterThan(MAX_ICS_TIMEZONE_WORK);
    const result = parse([
      ...zone("Custom/Dense", [
        "BEGIN:STANDARD", "DTSTART:20260101T000000", "TZOFFSETFROM:+0000", "TZOFFSETTO:+0100",
        `RRULE:FREQ=YEARLY;BYDAY=MO,TU,WE,TH,FR,SA,SU;BYHOUR=${hours};BYMINUTE=${seconds};` +
          `BYSECOND=${seconds};BYSETPOS=1`, "END:STANDARD",
      ]),
      ...zone("Custom/Valid", fixedObservance),
    ], [
      ...event("dense", ";TZID=Custom/Dense:20260701T090000"),
      ...event("valid", ";TZID=Custom/Valid:20260701T090000"),
    ]);
    expectUnsupported(result);
    expect(start(result, "valid")).toBe("2026-07-01T01:00:00.000Z");
  });

  it("finishes an impossible YEARLY date without searching indefinitely", () => {
    const result = parse(zone("Custom/Impossible", [
      ...fixedObservance.slice(0, -1),
      "RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=30;BYDAY=1MO", "END:STANDARD",
    ]), event("impossible", ";TZID=Custom/Impossible:20260701T090000"));
    expect(result.skippedUnsupportedTimezone).toBe(0);
    expect(start(result, "impossible")).toBe("2026-07-01T01:00:00.000Z");
  });

  it("bounds explicit RDATE candidates without charging rejected work to another zone", () => {
    const dates = Array<string>(MAX_ICS_TIMEZONE_TRANSITIONS + 1).fill("20260301T000000");
    const result = parse([
      ...zone("Custom/TooMany", [
        ...fixedObservance.slice(0, -1), `RDATE:${dates.join(",")}`, "END:STANDARD",
      ]), ...zone("Custom/Valid", fixedObservance),
    ], [
      ...event("many", ";TZID=Custom/TooMany:20260701T090000"),
      ...event("valid", ";TZID=Custom/Valid:20260701T090000"),
    ]);
    expectUnsupported(result);
    expect(start(result, "valid")).toBe("2026-07-01T01:00:00.000Z");
  });

  it("rejects excessive YEARLY history consistently regardless of event order", () => {
    const recurring = zone("Custom/Long", [
      ...fixedObservance.slice(0, -1), "RRULE:FREQ=YEARLY;BYDAY=SU", "END:STANDARD",
    ]);
    const near = event("near", ";TZID=Custom/Long:20260701T090000");
    const far = event("far", ";TZID=Custom/Long:99990701T090000");
    for (const events of [[...near, ...far], [...far, ...near]]) {
      const result = parse(recurring, events);
      expectUnsupported(result, 2);
      expect(result.events).toHaveLength(1);
    }
  });

  it("applies the transition candidate budget across zones in one source", () => {
    const zones: string[] = [];
    const events: string[] = [];
    const hours = Array.from({ length: 24 }, (_, index) => index).join(",");
    for (let index = 0; index < 12; index += 1) {
      const id = `Custom/Many${index}`;
      zones.push(...zone(id, [
        "BEGIN:STANDARD", "DTSTART:20250101T000000", "TZOFFSETFROM:+0800", "TZOFFSETTO:+0800",
        `RRULE:FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=1,2,3;BYHOUR=${hours};BYMINUTE=0,15,30,45`,
        "END:STANDARD",
      ]));
      events.push(...event(id, `;TZID=${id}:20260701T090000`));
    }
    const result = parse(zones, events);
    expectUnsupported(result);
    expect(result.events).toHaveLength(12);
    expect(start(result, "Custom/Many10")).toBe("2026-07-01T01:00:00.000Z");
    expect(result.events.some((entry) => entry.id === "Custom/Many11")).toBe(false);
  });

  it("applies the candidate work budget across zones in one source", () => {
    const zones: string[] = [];
    const events: string[] = [];
    for (let index = 0; index < 4; index += 1) {
      const id = `Custom/Work${index}`;
      zones.push(...zone(id, [
        "BEGIN:STANDARD", "DTSTART:19500102T000000", "TZOFFSETFROM:+0800", "TZOFFSETTO:+0800",
        "RRULE:FREQ=YEARLY;BYMONTH=1,2,3,4,5,6,7,8,9,10,11,12;BYDAY=1MO", "END:STANDARD",
      ]));
      events.push(...event(id, `;TZID=${id}:20260701T090000`));
    }
    const result = parse(zones, events);
    expectUnsupported(result);
    expect(result.events).toHaveLength(4);
    expect(start(result, "Custom/Work2")).toBe("2026-07-01T01:00:00.000Z");
    expect(result.events.some((entry) => entry.id === "Custom/Work3")).toBe(false);
  });
});

describe("ICS complete embedded transition sets", () => {
  function twoYears(split: boolean): readonly string[] {
    const dates = (first: string, second: string): readonly string[] => split
      ? [`RDATE:${first}`, `RDATE:${second}`] : [`RDATE:${first},${second}`];
    return zone("Custom/TwoYears", [
      "BEGIN:DAYLIGHT", "DTSTART:20260301T000000", "TZOFFSETFROM:+0000", "TZOFFSETTO:+0100",
      ...dates("20260301T000000", "20270301T000000"), "END:DAYLIGHT",
      "BEGIN:STANDARD", "DTSTART:20261001T000000", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0000",
      ...dates("20261001T000000", "20271001T000000"), "END:STANDARD",
    ]);
  }

  it.each([false, true])("keeps every cross-year RDATE value (split=%s)", (split) => {
    const result = parse(twoYears(split), [
      ...event("first", ";TZID=Custom/TwoYears:20260701T090000"),
      ...event("second", ";TZID=Custom/TwoYears:20270701T090000"),
    ]);
    expect(result.skippedUnsupportedTimezone).toBe(0);
    expect(start(result, "first")).toBe("2026-07-01T08:00:00.000Z");
    expect(start(result, "second")).toBe("2027-07-01T08:00:00.000Z");
  });

  it("keeps DTSTART even when RDATE lists only later transitions", () => {
    const result = parse(zone("Custom/Start", [
      "BEGIN:STANDARD", "DTSTART:20260301T000000", "TZOFFSETFROM:+0000", "TZOFFSETTO:+0100",
      "RDATE:20270301T000000", "END:STANDARD",
    ]), event("start", ";TZID=Custom/Start:20260701T090000"));
    expect(result.skippedUnsupportedTimezone).toBe(0);
    expect(start(result, "start")).toBe("2026-07-01T08:00:00.000Z");
  });

  it("covers a nominal duration ending in a later recurrence year", () => {
    const result = parse(twoYears(false), event("long", ";TZID=Custom/TwoYears:20260101T090000", [
      "DURATION:P546D",
    ]));
    expect(result.skippedInvalid).toBe(0);
    expect(new Date(result.events[0]!.endExclusive.timestamp).toISOString())
      .toBe("2027-07-01T08:00:00.000Z");
  });

  it("preserves ordinary yearly DST definitions with historical DTSTART values", () => {
    const result = parse(zone("Custom/Historical", [
      "BEGIN:DAYLIGHT", "DTSTART:16010311T020000", "TZOFFSETFROM:-0500", "TZOFFSETTO:-0400",
      "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU", "END:DAYLIGHT",
      "BEGIN:STANDARD", "DTSTART:16011104T020000", "TZOFFSETFROM:-0400", "TZOFFSETTO:-0500",
      "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU", "END:STANDARD",
    ]), event("historical", ";TZID=Custom/Historical:20260701T090000"));
    expect(result.skippedUnsupportedTimezone).toBe(0);
    expect(start(result, "historical")).toBe("2026-07-01T13:00:00.000Z");
  });

  it("preserves folded rules, explicit RECUR types and quoted extension parameters", () => {
    const result = parse(zone("Custom/Parameters", [
      "BEGIN:DAYLIGHT", "DTSTART:20250309T020000", "TZOFFSETFROM:+0000", "TZOFFSETTO:+0100",
      'RRULE;VALUE=RECUR;X-ORIGIN="https://example.com/a;b":FREQ=YEARLY;',
      " BYMONTH=3;BYDAY=2SU", "END:DAYLIGHT",
      "BEGIN:STANDARD", "DTSTART:20251026T020000", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0000",
      "rrule:freq=yearly;bymonth=10;byday=-1su;wkst=mo", "END:STANDARD",
    ]), event("parameters", ";TZID=Custom/Parameters:20260701T090000"));
    expect(result.skippedUnsupportedTimezone).toBe(0);
    expect(start(result, "parameters")).toBe("2026-07-01T08:00:00.000Z");
  });

  it("applies BYSETPOS to the full set after day and time expansion", () => {
    const result = parse(zone("Custom/Positions", [
      "BEGIN:DAYLIGHT", "DTSTART:20250309T031530", "TZOFFSETFROM:+0000", "TZOFFSETTO:+0100",
      "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=SU;BYMONTHDAY=8,9,10,11,12,13,14;" +
        "BYHOUR=2,3;BYMINUTE=15;BYSECOND=30;BYSETPOS=-1",
      "END:DAYLIGHT", "BEGIN:STANDARD", "DTSTART:20251026T030000",
      "TZOFFSETFROM:+0100", "TZOFFSETTO:+0000",
      "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD",
    ]), [
      ...event("before", ";TZID=Custom/Positions:20260308T024500"),
      ...event("gap", ";TZID=Custom/Positions:20260308T033000"),
      ...event("after", ";TZID=Custom/Positions:20260308T043000"),
    ]);
    expect(result.skippedUnsupportedTimezone).toBe(0);
    expect(start(result, "before")).toBe("2026-03-08T02:45:00.000Z");
    expect(start(result, "gap")).toBe("2026-03-08T03:30:00.000Z");
    expect(start(result, "after")).toBe("2026-03-08T03:30:00.000Z");
  });

  it("treats a UTC UNTIL as inclusive after applying TZOFFSETFROM", () => {
    const result = parse(zone("Custom/Until", [
      "BEGIN:DAYLIGHT", "DTSTART:20250301T000000", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0200",
      "RRULE:FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=1;UNTIL=20260228T230000Z", "END:DAYLIGHT",
      "BEGIN:STANDARD", "DTSTART:20251001T000000", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100",
      "RRULE:FREQ=YEARLY;BYMONTH=10;BYMONTHDAY=1;UNTIL=20260930T220000Z", "END:STANDARD",
    ]), [
      ...event("last", ";TZID=Custom/Until:20260701T090000"),
      ...event("ended", ";TZID=Custom/Until:20270701T090000"),
    ]);
    expect(result.skippedUnsupportedTimezone).toBe(0);
    expect(start(result, "last")).toBe("2026-07-01T07:00:00.000Z");
    expect(start(result, "ended")).toBe("2027-07-01T08:00:00.000Z");
  });

  it("preserves COUNT and INTERVAL while deduplicating DTSTART and RDATE", () => {
    const result = parse(zone("Custom/Count", [
      "BEGIN:DAYLIGHT", "DTSTART:20240301T000000", "TZOFFSETFROM:+0000", "TZOFFSETTO:+0100",
      "RRULE:FREQ=YEARLY;INTERVAL=2;COUNT=2;BYMONTH=3;BYMONTHDAY=1",
      "RDATE:20240301T000000,20260301T000000", "END:DAYLIGHT",
      "BEGIN:STANDARD", "DTSTART:20241001T000000", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0000",
      "RRULE:FREQ=YEARLY;INTERVAL=2;COUNT=2;BYMONTH=10;BYMONTHDAY=1", "END:STANDARD",
    ]), [
      ...event("second", ";TZID=Custom/Count:20260701T090000"),
      ...event("after", ";TZID=Custom/Count:20280701T090000"),
    ]);
    expect(result.skippedUnsupportedTimezone).toBe(0);
    expect(start(result, "second")).toBe("2026-07-01T08:00:00.000Z");
    expect(start(result, "after")).toBe("2028-07-01T09:00:00.000Z");
  });
});
