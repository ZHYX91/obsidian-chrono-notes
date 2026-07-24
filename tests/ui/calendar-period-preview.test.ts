import { describe, expect, it } from "vitest";

import {
  createDailyCalendarPreview,
  createPeriodicCalendarPreview,
} from "../../src/ui/calendar/calendar-period-preview";
import { noteEmbeds } from "../support/note-embeds";
import { noteStatistics } from "../support/note-statistics";

const NOTE = Object.freeze({
  date: { year: 2025, month: 12, day: 28 },
  notePath: null,
  noteState: "not-configured" as const,
  preview: null,
  embeds: noteEmbeds(),
  statistics: noteStatistics(),
});

describe("periodic calendar preview", () => {
  it("marks exact-date previews as daily notes", () => {
    expect(createDailyCalendarPreview(NOTE)).toMatchObject({
      previewTitle: "2025-12-28",
      previewSubtitle: null,
      periodicNoteType: "daily",
    });
  });

  it("uses ISO week identity while honoring a Sunday display boundary", () => {
    expect(createPeriodicCalendarPreview(
      NOTE,
      "weekly",
      "sunday",
    )).toMatchObject({
      previewTitle: "2026-W01",
      previewSubtitle: "2025-12-28 – 2026-01-03",
      periodicNoteType: "weekly",
    });
  });

  it("formats month, quarter, and year titles with complete ranges", () => {
    const base = { ...NOTE, date: { year: 2026, month: 7, day: 24 } };

    expect(createPeriodicCalendarPreview(base, "monthly", "monday"))
      .toMatchObject({
        previewTitle: "2026-07",
        previewSubtitle: "2026-07-01 – 2026-07-31",
      });
    expect(createPeriodicCalendarPreview(base, "quarterly", "monday"))
      .toMatchObject({
        previewTitle: "2026-Q3",
        previewSubtitle: "2026-07-01 – 2026-09-30",
      });
    expect(createPeriodicCalendarPreview(base, "yearly", "monday"))
      .toMatchObject({
        previewTitle: "2026",
        previewSubtitle: "2026-01-01 – 2026-12-31",
      });
  });
});
