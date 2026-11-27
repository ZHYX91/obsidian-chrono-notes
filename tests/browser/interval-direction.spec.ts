import { expect, test } from "@playwright/test";
import { createElement } from "react";
import { parseNoteInterval } from "../../src/core/note/note-interval";
import { selectIntervalWeekData, type IntervalNoteItem } from "../../src/features/intervals/interval-note-query";
import { IntervalGantt } from "../../src/ui/calendar/interval-gantt";
import { readPluginStyles } from "../support/plugin-styles";
import { renderWithTestHost } from "../support/render-with-host";

function note(title: string, start: string, end: string, completed: number): IntervalNoteItem {
  const interval = parseNoteInterval({ start, end }).value!;
  return {
    title, path: `Ranges/${title}.md`, recognition: "explicit",
    start: interval.start, end: interval.end, dayCount: interval.dayCount,
    statistics: { wordCount: 0, linkCount: 0, tagCount: 0, taskTotal: 2,
      taskCompleted: completed, taskCompletionRate: 50 * completed },
  };
}

const data = selectIntervalWeekData([
  note("Earlier", "2026-10-18", "2026-10-21", 1),
  note("Later", "2026-10-20", "2026-10-27", 2),
  note("Ongoing", "2026-10-22", "2026-10-27", 1),
], { year: 2026, month: 10, day: 19 }, 3);

for (const direction of ["ltr", "rtl"] as const) {
  test(`continued interval caps follow the ${direction} timeline in month and week views`, async ({ page }) => {
    const views = (["month", "week"] as const).map((variant) =>
      renderWithTestHost(createElement(IntervalGantt, {
        data, variant, ariaLabel: variant, formatDuration: String, formatMore: String,
        formatTaskProgress: () => "", onOpenPath: async () => undefined,
      })),
    );
    await page.setContent(`<main class="chrono-notes-calendar" dir="${direction}">${views.join("")}</main>`);
    await page.addStyleTag({ content: readPluginStyles() });

    for (const variant of ["month", "week"] as const) {
      const group = page.getByRole("group", { name: variant });
      for (const name of ["Earlier", "Later", "Ongoing"]) {
        const bar = group.getByRole("button", { name: new RegExp(name) });
        const drawing = await bar.evaluate((element, variant) => {
          const caps = (pseudo?: string) => {
            const style = getComputedStyle(element, pseudo);
            return [
              [style.borderTopLeftRadius, style.borderBottomLeftRadius],
              [style.borderTopRightRadius, style.borderBottomRightRadius],
            ];
          };
          return { track: caps(variant === "month" ? "::before" : undefined),
            fill: caps("::after"), textAlign: getComputedStyle(element).textAlign };
        }, variant);
        const isEarlier = name === "Earlier";
        const flat = ["0px", "0px"];
        const round = ["2px", "2px"];
        const track = (isEarlier === (direction === "ltr")) ? [flat, round] : [round, flat];
        expect(drawing.track, `${variant} ${name} track`).toEqual(track);
        // An incomplete fill ends within the visible bar, even when the range continues.
        expect(drawing.fill, `${variant} ${name} fill`).toEqual(name === "Ongoing" ? [round, round] : track);
        if (variant === "week") {
          expect(["start", direction === "rtl" ? "right" : "left"]).toContain(drawing.textAlign);
        }
      }
    }
  });
}
