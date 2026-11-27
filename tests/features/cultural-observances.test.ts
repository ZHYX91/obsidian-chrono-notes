import { describe, expect, it } from "vitest";
import { CalendarDecorationCache, selectCalendarDecorations } from "../../src/features/calendar/calendar-decoration-cache";
import { getObservance } from "../../src/core/calendar/observances";
import { formatCalendarExtensionEventLabel } from "../../src/ui/calendar/calendar-day-presentation";
import { createTranslator } from "../../src/shared/i18n";

describe("cultural and religious observances", () => {
  it("keeps optional observances out of date slots, holiday markers and unselected queries", () => {
    const cache = new CalendarDecorationCache();
    const date = { year: 2025, month: 4, day: 20 };
    expect(cache.get(date, "en", [], []).calendarEvents).toEqual([]);
    const withBoth = cache.get(date, "en", [], [], ["western", "orthodox"]);
    expect(withBoth).toEqual(selectCalendarDecorations(date, "en", [], [], ["western", "orthodox"]));
    expect(withBoth.calendarExtensions).toEqual([]);
    expect(withBoth.holidays).toEqual([]);
    expect(withBoth.regionalMarker).toBeNull();
    expect(withBoth.calendarEvents).toHaveLength(1);
    expect(withBoth.calendarEvents[0]?.sources.map(source => source.id)).toEqual(["western", "orthodox"]);
    const event = withBoth.calendarEvents[0]!;
    expect(formatCalendarExtensionEventLabel(event, createTranslator("en", "en").t)).toContain("Orthodox");
    expect(cache.get(date, "en", [], []).calendarEvents).toEqual([]);
  });

  it("keeps the Julian Paschal table distinct and shifts fixed feasts after 2100", () => {
    expect(getObservance({year: 2026, month: 4, day: 5}, "western")).toBe("easter");
    expect(getObservance({year: 2026, month: 4, day: 12}, "orthodox")).toBe("easter");
    expect(getObservance({year: 2027, month: 3, day: 28}, "western")).toBe("easter");
    expect(getObservance({year: 2027, month: 5, day: 2}, "orthodox")).toBe("easter");
    expect(getObservance({year: 2101, month: 1, day: 8}, "orthodox")).toBe("christmas");
    expect(getObservance({year: 2026, month: 11, day: 29}, "western")).toBe("advent");
  });

  it("uses first daytime dates for annual feasts", () => {
    expect(getObservance({year: 2026, month: 3, day: 21}, "nowruz")).toBe("nowruz");
    expect(getObservance({year: 2025, month: 9, day: 11}, "ethiopian-new-year")).toBe("enkutatash");
    expect(getObservance({year: 2025, month: 9, day: 23}, "hebrew-feasts")).toBe("roshHashanah");
    expect(getObservance({year: 2025, month: 9, day: 24}, "hebrew-feasts")).toBeNull();
    expect(getObservance({year: 2025, month: 10, day: 2}, "hebrew-feasts")).toBe("yomKippur");
    expect(getObservance({year: 2025, month: 4, day: 13}, "hebrew-feasts")).toBe("passover");
  });
});
