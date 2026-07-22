import { describe, expect, it } from "vitest";

import type { IcsEventOccurrence } from "../../src/core/calendar/ics-calendar";
import { createTranslator } from "../../src/shared/i18n";
import {
  formatCalendarIcsDayLabel,
  formatCalendarIcsEventLabel,
} from "../../src/ui/calendar/calendar-ics-presentation";

function occurrence(
  title: string,
  options: Partial<IcsEventOccurrence> = {},
): IcsEventOccurrence {
  return Object.freeze({
    id: title,
    title,
    source: "team.ics",
    sourceLabel: "Team calendar",
    isAllDay: true,
    startsOnDate: true,
    endsOnDate: true,
    continuesBefore: false,
    continuesAfter: false,
    timeLabel: null,
    sortTimestamp: 0,
    ...options,
  });
}

describe("calendar ICS presentation", () => {
  it("formats compact all-day and timed continuation summaries", () => {
    const t = createTranslator("en", "en").t;
    expect(formatCalendarIcsEventLabel(occurrence("Holiday"), t)).toBe("All day Holiday");
    expect(formatCalendarIcsEventLabel(occurrence("Workshop", {
      isAllDay: false,
      startsOnDate: false,
      endsOnDate: false,
      continuesBefore: true,
      continuesAfter: true,
      timeLabel: null,
    }), t)).toBe("... Workshop ...");
    expect(formatCalendarIcsEventLabel(occurrence("Stand-up", {
      isAllDay: false,
      timeLabel: "09:30",
    }), t)).toBe("09:30 Stand-up");
  });

  it("keeps every source and hidden title in the accessible cell label", () => {
    const t = createTranslator("en", "en").t;
    const label = formatCalendarIcsDayLabel([
      occurrence("First"),
      occurrence("Second", {
        isAllDay: false,
        startsOnDate: false,
        continuesBefore: true,
      }),
      occurrence("Hidden"),
    ], t);

    expect(label).toContain("First, all day, source Team calendar");
    expect(label).toContain("Second, continuing from previous day, source Team calendar");
    expect(label).toContain("Hidden, all day, source Team calendar");
  });

  it("uses the selected runtime locale for visible and accessible ICS text", () => {
    const t = createTranslator("zh-TW", "en").t;
    const event = occurrence("假期");

    expect(formatCalendarIcsEventLabel(event, t)).toBe("全天 假期");
    expect(formatCalendarIcsDayLabel([event], t)).toBe("日曆事件：假期，全天，來源 Team calendar");
  });
});
