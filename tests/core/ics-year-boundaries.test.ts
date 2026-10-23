import { describe, expect, it } from "vitest";

import { buildIcsDateIndex, parseIcsCalendar } from "../../src/core/calendar/ics-calendar";

function calendar(properties: readonly string[]): string {
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0",
    "BEGIN:VEVENT", "UID:boundary", ...properties, "END:VEVENT",
    "BEGIN:VEVENT", "UID:neighbor", "DTSTART:20261023T120000Z", "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

describe("ICS indexable display years", () => {
  it.each([
    ["all-day duration", ["DTSTART;VALUE=DATE:99991231", "DURATION:P2D"], "UTC"],
    ["timed duration", ["DTSTART:99991231T235959Z", "DURATION:PT2S"], "UTC"],
    ["display-zone start", ["DTSTART:99991231T230000Z"], "Etc/GMT-2"],
    ["display-zone end", ["DTSTART:99991231T210000Z", "DTEND:99991231T235959Z"], "Etc/GMT-2"],
    ["display-zone lower bound", ["DTSTART:00000101T000000Z"], "Etc/GMT+1"],
    ["source-zone lower bound", ["DTSTART;TZID=Etc/GMT-1:00000101T000000"], "UTC"],
  ] as const)("isolates out-of-range %s while retaining a valid neighbor", (_name, fields, zone) => {
    const parsed = parseIcsCalendar(calendar(fields), "boundary.ics", { displayZone: zone });
    expect(parsed.events.map(({ id }) => id)).toEqual(["neighbor"]);
    expect(parsed.skippedInvalid).toBe(1);
    expect(parsed.skippedRecurring).toBe(0);
    expect(parsed.skippedUnsupportedTimezone).toBe(0);
    const index = buildIcsDateIndex(parsed.events);
    expect(Object.keys(index.eventsByDate)).toEqual(["2026-10-23"]);
    expect(index.eventsByDate["2026-10-23"]?.[0]?.id).toBe("neighbor");
  });

  it.each([
    ["first supported day", ["DTSTART;VALUE=DATE:00000101"], ["0000-01-01"]],
    ["last supported day", ["DTSTART;VALUE=DATE:99991231"], ["9999-12-31"]],
    ["last all-day duration", ["DTSTART;VALUE=DATE:99991231", "DURATION:P1D"], ["9999-12-31"]],
    ["last timed point", ["DTSTART:99991231T235959Z"], ["9999-12-31"]],
    ["exclusive next-year midnight", ["DTSTART:99991231T235959Z", "DURATION:PT1S"], ["9999-12-31"]],
    ["ordinary year crossing", ["DTSTART;VALUE=DATE:20261231", "DURATION:P2D"], ["2026-12-31", "2027-01-01"]],
  ] as const)("preserves %s", (_name, fields, dates) => {
    const parsed = parseIcsCalendar(calendar(fields), "boundary.ics", { displayZone: "UTC" });
    expect(parsed.events.map(({ id }) => id)).toEqual(["boundary", "neighbor"]);
    expect(parsed.skippedInvalid).toBe(0);
    const index = buildIcsDateIndex(parsed.events.filter(({ id }) => id === "boundary"));
    expect(Object.keys(index.eventsByDate)).toEqual(dates);
    expect(index.truncatedEvents).toBe(0);
    expect(index.eventsByDate[dates.at(-1)!]?.[0]?.endsOnDate).toBe(true);
  });
});
