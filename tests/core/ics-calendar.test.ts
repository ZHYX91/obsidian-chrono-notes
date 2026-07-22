import { describe, expect, it } from "vitest";

import {
  buildIcsDateIndex,
  parseIcsCalendar,
} from "../../src/core/calendar/ics-calendar";

describe("ICS calendar parsing", () => {
  it("handles BOM, folded lines, escaped text, and multiple events", () => {
    const parsed = parseIcsCalendar([
      "\uFEFFBEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:folded",
      "DTSTART;VALUE=DATE:20260506",
      "DTEND;VALUE=DATE:20260507",
      "SUMMARY:Quarterly\\, review\\n",
      " Room A",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:plain",
      "DTSTART:20260506T090000",
      "DTEND:20260506T100000",
      "SUMMARY:Plain event",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n"), "Calendar/team.ics", { displayZone: "Asia/Shanghai" });

    expect(parsed.events).toHaveLength(2);
    expect(parsed.events[0]).toMatchObject({
      id: "folded",
      source: "Calendar/team.ics",
      sourceLabel: "team.ics",
      title: "Quarterly, review\nRoom A",
      isAllDay: true,
      start: { date: { year: 2026, month: 5, day: 6 }, timeMinutes: null },
      endExclusive: { date: { year: 2026, month: 5, day: 7 }, timeMinutes: null },
    });
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.events)).toBe(true);
    expect(Object.isFrozen(parsed.events[0]?.start.date)).toBe(true);
  });

  it("converts UTC and TZID times while keeping floating times in the display zone", () => {
    const parsed = parseIcsCalendar([
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:utc",
      "DTSTART:20260506T003000Z",
      "DTEND:20260506T013000Z",
      "SUMMARY:UTC event",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:tzid",
      "DTSTART;TZID=/freeassociation.sourceforge.net/America/New_York:20260506T203000",
      "DTEND;TZID=/freeassociation.sourceforge.net/America/New_York:20260506T213000",
      "SUMMARY:New York event",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:floating",
      "DTSTART:20260506T090000",
      "DTEND:20260506T100000",
      "SUMMARY:Floating event",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n"), "zones.ics", { displayZone: "Asia/Shanghai" });

    expect(parsed.events.map((event) => ({
      id: event.id,
      date: event.start.date,
      timeMinutes: event.start.timeMinutes,
    }))).toEqual([
      { id: "utc", date: { year: 2026, month: 5, day: 6 }, timeMinutes: 8 * 60 + 30 },
      { id: "tzid", date: { year: 2026, month: 5, day: 7 }, timeMinutes: 8 * 60 + 30 },
      { id: "floating", date: { year: 2026, month: 5, day: 6 }, timeMinutes: 9 * 60 },
    ]);
  });

  it("indexes exclusive all-day ends and timed events across midnight", () => {
    const parsed = parseIcsCalendar([
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:trip",
      "DTSTART;VALUE=DATE:20260508",
      "DTEND;VALUE=DATE:20260510",
      "SUMMARY:Trip",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:late",
      "DTSTART:20260508T230000",
      "DTEND:20260509T010000",
      "SUMMARY:Late work",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n"), "multi.ics", { displayZone: "UTC" });

    const result = buildIcsDateIndex(parsed.events);
    expect(result.eventsByDate["2026-05-08"]?.map((event) => event.title)).toEqual([
      "Trip",
      "Late work",
    ]);
    expect(result.eventsByDate["2026-05-09"]).toEqual([
      expect.objectContaining({
        title: "Trip",
        startsOnDate: false,
        endsOnDate: true,
        continuesBefore: true,
        continuesAfter: false,
      }),
      expect.objectContaining({
        title: "Late work",
        timeLabel: null,
        startsOnDate: false,
        endsOnDate: true,
      }),
    ]);
    expect(Object.isFrozen(result.eventsByDate)).toBe(true);
    expect(Object.isFrozen(result.eventsByDate["2026-05-08"])).toBe(true);
  });

  it("explicitly skips recurrence rules and isolates invalid events", () => {
    const parsed = parseIcsCalendar([
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:rule",
      "DTSTART;VALUE=DATE:20260501",
      "RRULE:FREQ=YEARLY",
      "SUMMARY:Rule",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:rdate",
      "DTSTART;VALUE=DATE:20260502",
      "RDATE;VALUE=DATE:20270502",
      "SUMMARY:RDate",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:override",
      "RECURRENCE-ID;VALUE=DATE:20260503",
      "DTSTART;VALUE=DATE:20260504",
      "SUMMARY:Detached override",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:invalid",
      "DTSTART;VALUE=DATE:20260229",
      "SUMMARY:Impossible",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:cancelled",
      "STATUS:CANCELLED",
      "DTSTART;VALUE=DATE:20260505",
      "RRULE:FREQ=YEARLY",
      "SUMMARY:Cancelled",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n"), "recurrence.ics", { displayZone: "UTC" });

    expect(parsed.skippedRecurring).toBe(2);
    expect(parsed.skippedInvalid).toBe(1);
    expect(parsed.events.map((event) => event.id)).toEqual(["override"]);
  });

  it("defaults an end only when both DTEND and DURATION are absent", () => {
    const parsed = parseIcsCalendar([
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:all-day-default",
      "DTSTART;VALUE=DATE:20260501",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:timed-default",
      "DTSTART:20260501T090000",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:all-day-duration",
      "DTSTART;VALUE=DATE:20260502",
      "DURATION:P2D",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:timed-duration",
      "DTSTART:20260502T090000",
      "DURATION:PT90M",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n"), "ends.ics", { displayZone: "UTC" });

    expect(parsed.skippedInvalid).toBe(0);
    expect(parsed.events.map((event) => ({
      id: event.id,
      end: event.endExclusive,
    }))).toMatchObject([
      {
        id: "all-day-default",
        end: { date: { year: 2026, month: 5, day: 2 }, timeMinutes: null },
      },
      {
        id: "timed-default",
        end: { date: { year: 2026, month: 5, day: 1 }, timeMinutes: 9 * 60 + 1 },
      },
      {
        id: "all-day-duration",
        end: { date: { year: 2026, month: 5, day: 4 }, timeMinutes: null },
      },
      {
        id: "timed-duration",
        end: { date: { year: 2026, month: 5, day: 2 }, timeMinutes: 10 * 60 + 30 },
      },
    ]);
  });

  it("isolates explicit invalid ends and durations instead of repairing them", () => {
    const invalidComponents = [
      ["invalid-end", "DTSTART:20260501T090000", "DTEND:not-a-date"],
      ["reversed-end", "DTSTART:20260501T090000", "DTEND:20260501T080000"],
      ["equal-end", "DTSTART:20260501T090000", "DTEND:20260501T090000"],
      ["date-to-time", "DTSTART;VALUE=DATE:20260501", "DTEND:20260502T090000"],
      ["time-to-date", "DTSTART:20260501T090000", "DTEND;VALUE=DATE:20260502"],
      ["invalid-duration", "DTSTART:20260501T090000", "DURATION:nonsense"],
      ["negative-duration", "DTSTART:20260501T090000", "DURATION:-PT1H"],
      ["zero-duration", "DTSTART:20260501T090000", "DURATION:PT0S"],
      ["date-time-duration", "DTSTART;VALUE=DATE:20260501", "DURATION:P1DT1H"],
    ].flatMap(([uid, start, end]) => [
      "BEGIN:VEVENT",
      `UID:${uid}`,
      start,
      end,
      "END:VEVENT",
    ]);
    const parsed = parseIcsCalendar([
      "BEGIN:VCALENDAR",
      ...invalidComponents,
      "BEGIN:VEVENT",
      "UID:both-end-types",
      "DTSTART:20260501T090000",
      "DTEND:20260501T100000",
      "DURATION:PT1H",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:valid-neighbor",
      "DTSTART:20260501T110000",
      "DTEND:20260501T120000",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n"), "invalid-ends.ics", { displayZone: "UTC" });

    expect(parsed.events.map((event) => event.id)).toEqual(["valid-neighbor"]);
    expect(parsed.skippedInvalid).toBe(10);
  });
});
