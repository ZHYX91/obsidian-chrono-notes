import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { parseNoteInterval } from "../../src/core/note/note-interval";
import type { IntervalWeekData } from "../../src/features/intervals/interval-note-query";
import { IntervalGantt } from "../../src/ui/calendar/interval-gantt";
import { readPluginStyles } from "../support/plugin-styles";

const styles = readPluginStyles();
const source = readFileSync(
  new URL("../../src/ui/calendar/interval-gantt.tsx", import.meta.url),
  "utf8",
);
const monthView = readFileSync(
  new URL("../../src/ui/calendar/month-view.tsx", import.meta.url),
  "utf8",
);
const monthDayCell = readFileSync(
  new URL("../../src/ui/calendar/month-day-cell.tsx", import.meta.url),
  "utf8",
);

describe("interval gantt layout", () => {
  it("uses one shared lane renderer for month and week views", () => {
    expect(source).toContain("item.lane + 1");
    expect(source).toContain("data-color-index={item.colorIndex}");
    expect(source).toContain("data-continues-before");
    expect(source).toContain("data-continues-after");
  });

  it("does not create a flow row for a week without interval notes", () => {
    const markup = renderToStaticMarkup(createElement(IntervalGantt, {
      data: {
        items: [],
        visibleLaneCount: 0,
        hiddenCount: 0,
        hiddenItems: [],
        totalCount: 0,
      },
      variant: "month",
      ariaLabel: "Range notes",
      formatDuration: (count: number) => `${count} days`,
      formatMore: (count: number) => `${count} more`,
      formatTaskProgress: (statistics) =>
        `${statistics.taskCompleted}/${statistics.taskTotal}`,
      onOpenPath: async () => undefined,
    }));

    expect(markup).toBe("");
  });

  it("renders compact borderless bars with a finite categorical palette", () => {
    expect(styles).toMatch(
      /\.chrono-notes-calendar button\.chrono-notes-interval-bar\s*\{[^}]*border:\s*0;[^}]*border-radius:\s*2px;/s,
    );
    for (let index = 0; index < 8; index += 1) {
      expect(styles).toContain(
        `.chrono-notes-calendar button.chrono-notes-interval-bar[data-color-index="${index}"]`,
      );
    }
  });

  it("keeps identity color while adding a task track and proportional fill", () => {
    expect(source).toContain("data-task-state={taskProgress.state}");
    expect(source).toContain('"--chrono-notes-interval-task-progress"');
    expect(styles).toMatch(
      /\.chrono-notes-calendar button\.chrono-notes-week-interval-item:not\(\[data-task-state="none"\]\)\s*\{[^}]*background-color:[^}]*box-shadow:/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-calendar button\.chrono-notes-week-interval-item:not\(\[data-task-state="none"\]\)::after\s*\{[^}]*inline-size:\s*var\(--chrono-notes-interval-task-progress\);/s,
    );
    const weekFillRule = styles.match(
      /\.chrono-notes-calendar button\.chrono-notes-week-interval-item:not\(\[data-task-state="none"\]\)::after\s*\{[^}]*\}/s,
    )?.[0];
    expect(weekFillRule).toBeDefined();
    expect(weekFillRule).toContain("var(--background-primary)");
    expect(weekFillRule).not.toContain("var(--text-normal)");
    expect(styles).toMatch(
      /\.chrono-notes-calendar button\.chrono-notes-week-interval-item:not\(\[data-task-state="none"\]\):hover\s*\{[^}]*background-color:[^}]*box-shadow:/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-calendar button\.chrono-notes-month-interval-item:not\(\[data-task-state="none"\]\)::before\s*\{[^}]*box-shadow:/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-calendar button\.chrono-notes-month-interval-item:not\(\[data-task-state="none"\]\)::after\s*\{[^}]*inline-size:\s*var\(--chrono-notes-interval-task-progress\);/s,
    );
  });

  it("out-ranks the host button surface without important declarations", () => {
    const rule = styles.match(
      /\.chrono-notes-calendar button\.chrono-notes-interval-bar\s*\{[^}]*\}/s,
    )?.[0];
    expect(rule).toBeDefined();
    expect(rule).toMatch(/background-color:\s*var\(--chrono-notes-interval-surface\);/);
    expect(rule).toMatch(/background-image:\s*none;/);
    expect(rule).not.toContain("!important");

    const window = new Window();
    const style = window.document.createElement("style");
    style.textContent = `${rule}
button:not(.clickable-icon) {
  background-color: rgb(1, 2, 3);
  background-image: linear-gradient(red, blue);
  box-shadow: 0 0 2px red;
}`;
    window.document.head.append(style);
    window.document.body.innerHTML = `
      <div class="chrono-notes-calendar">
        <button class="chrono-notes-interval-bar"></button>
      </div>
    `;
    const button = window.document.querySelector("button");
    expect(button).not.toBeNull();
    button?.style.setProperty("--chrono-notes-interval-surface", "rgb(4, 5, 6)");

    const computed = window.getComputedStyle(button!);
    expect(computed.backgroundColor).toBe("rgb(4, 5, 6)");
    expect(computed.backgroundImage).toBe("none");
    expect(computed.boxShadow).toBe("none");
  });

  it("keeps month lanes in normal flow inside the affected date-cell surfaces", () => {
    expect(styles).toMatch(
      /\.chrono-notes-interval-gantt\s*\{[^}]*column-gap:\s*var\(--chrono-notes-cell-gap\);[^}]*row-gap:\s*0;/s,
    );
    expect(styles).toMatch(
      /@container \(max-width: 360px\)[\s\S]*?\.chrono-notes-calendar\s*\{[^}]*--chrono-notes-cell-gap:\s*4px;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-week-overview\s*\{[^}]*gap:\s*var\(--chrono-notes-cell-gap\);/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-week-interval-strip\s*\{[^}]*row-gap:\s*3px;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-week-block\s*\{[^}]*display:\s*grid;[^}]*grid-column:\s*1 \/ -1;[^}]*grid-template-columns:\s*subgrid;[^}]*grid-template-rows:\s*auto auto;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-month-grid > \.chrono-notes-week-row\s*\{[^}]*display:\s*contents;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-week-block > \.chrono-notes-week-row\s*\{[^}]*display:\s*grid;[^}]*grid-column:\s*1 \/ -1;[^}]*grid-row:\s*1 \/ -1;[^}]*grid-template-columns:\s*subgrid;[^}]*grid-template-rows:\s*subgrid;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-week-block > \.chrono-notes-week-row > :is\([^)]+\.chrono-notes-week-number,[^)]+\.chrono-notes-week-date-spacer[^)]+\)\s*\{[^}]*grid-row:\s*1 \/ -1;/s,
    );
    const stripRule = styles.match(
      /\.chrono-notes-month-interval-strip\s*\{[^}]*\}/s,
    )?.[0];
    expect(stripRule).toBeDefined();
    expect(stripRule).toContain("grid-column: 3 / -1;");
    expect(stripRule).toContain("grid-row: 2;");
    expect(stripRule).toContain("grid-template-columns: subgrid;");
    expect(stripRule).toContain("pointer-events: none;");
    expect(stripRule).toContain("z-index: 1;");
    expect(stripRule).not.toMatch(
      /position:\s*absolute|inset:|align-self:/,
    );
    const dayRule = styles.match(
      /\.chrono-notes-day\s*\{[^}]*\}/s,
    )?.[0];
    expect(dayRule).toBeDefined();
    expect(dayRule).toContain("display: grid;");
    expect(dayRule).toContain("grid-row: 1 / span 2;");
    expect(dayRule).toContain("grid-template-rows: subgrid;");
    expect(dayRule).not.toContain("isolation:");
    expect(dayRule).not.toContain("z-index:");
    expect(dayRule).toContain("padding: 0;");
    const dayMainRule = styles.match(
      /\.chrono-notes-day-main\s*\{[^}]*\}/s,
    )?.[0];
    expect(dayMainRule).toBeDefined();
    expect(dayMainRule).toContain("display: flex;");
    expect(dayMainRule).toContain("flex-direction: column;");
    expect(dayMainRule).toContain("grid-row: 1;");
    expect(dayMainRule).toContain("min-height: 52px;");
    expect(dayMainRule).toContain("padding: 5px;");
    expect(dayMainRule).toContain("z-index: 1;");
    const currentFrameRule = styles.match(
      /\.chrono-notes-day\.is-current-period:not\(\.is-range-preview\):not\(\.is-range-start\):not\(\.is-range-end\)::after\s*\{[^}]*\}/s,
    )?.[0];
    expect(currentFrameRule).toContain("pointer-events: none;");
    expect(currentFrameRule).toContain("z-index: 2;");
    const intervalButtonRule = styles.match(
      /\.chrono-notes-calendar button\.chrono-notes-month-interval-item\s*\{[^}]*\}/s,
    )?.[0];
    expect(intervalButtonRule).toContain("pointer-events: auto;");
    expect(monthDayCell).toContain(
      '<span className="chrono-notes-day-main">',
    );
    expect(styles).not.toMatch(
      /\.chrono-notes-week-block\s*\{[^}]*display:\s*contents;/s,
    );
    expect(styles).not.toContain("--chrono-notes-month-interval-height");
    expect(styles).not.toContain("data-has-intervals");
    expect(monthView).not.toContain("getMonthIntervalOverlayHeight");
    expect(monthView).not.toContain("--chrono-notes-month-interval-height");
    expect(monthView).toMatch(
      /query\.weeks\.map[\s\S]*?className="chrono-notes-week-block"[\s\S]*?<div className="chrono-notes-week-row" role="row">[\s\S]*?<\/div>\s*\{heatmapEnabled \? null : \(\s*<MonthIntervalStrip[\s\S]*?\)\}\s*<\/div>/,
    );
    const monthGridRule = styles.match(
      /\.chrono-notes-month-grid\s*\{[^}]*\}/s,
    )?.[0];
    expect(monthGridRule).toBeDefined();
    expect(monthGridRule).not.toMatch(/grid-auto-rows|grid-template-rows/);
  });

  it("grows naturally through three month lanes and puts further notes in overflow", () => {
    const interval = parseNoteInterval({
      start: "2026-07-13",
      end: "2026-07-19",
    }).value;
    expect(interval).not.toBeNull();
    const statistics = Object.freeze({
      wordCount: 0,
      linkCount: 0,
      tagCount: 0,
      taskTotal: 0,
      taskCompleted: 0,
      taskCompletionRate: 0,
    });
    const data: IntervalWeekData = {
      items: [0, 1, 2].map((lane) => ({
        path: `Ranges/lane-${lane}.md`,
        title: `Lane ${lane + 1}`,
        start: interval!.start,
        end: interval!.end,
        dayCount: interval!.dayCount,
        statistics,
        lane,
        colorIndex: lane,
        startColumn: 0,
        endColumn: 6,
        startsBeforeWeek: false,
        endsAfterWeek: false,
      })),
      visibleLaneCount: 3,
      hiddenCount: 1,
      hiddenItems: [{
        path: "Ranges/hidden.md",
        title: "Hidden lane",
        start: interval!.start,
        end: interval!.end,
        dayCount: interval!.dayCount,
        statistics,
      }],
      totalCount: 4,
    };
    const markup = renderToStaticMarkup(createElement(IntervalGantt, {
      data,
      variant: "month",
      ariaLabel: "Range notes",
      formatDuration: (count: number) => `${count} days`,
      formatMore: (count: number) => `${count} more`,
      formatTaskProgress: (itemStatistics) =>
        `${itemStatistics.taskCompleted}/${itemStatistics.taskTotal}`,
      onOpenPath: async () => undefined,
    }));
    const window = new Window();
    window.document.body.innerHTML = markup;

    const lanes = Array.from(window.document.querySelectorAll(
      ".chrono-notes-month-interval-item",
    ));
    expect(lanes.map((lane) => lane.getAttribute("style"))).toEqual([
      expect.stringContaining("grid-row:1"),
      expect.stringContaining("grid-row:2"),
      expect.stringContaining("grid-row:3"),
    ]);
    const overflow = window.document.querySelector(
      ".chrono-notes-month-interval-more",
    );
    expect(overflow?.getAttribute("style")).toContain("grid-row:4");
    expect(overflow?.textContent).toBe("+1");
    const strip = window.document.querySelector(
      ".chrono-notes-month-interval-strip",
    ) as HTMLElement | null;
    expect(strip?.style.gridTemplateRows).toBe(
      "repeat(3, var(--chrono-notes-month-interval-lane-height)) var(--chrono-notes-month-interval-more-height)",
    );
  });

  it("reserves empty leading lane tracks for continuing month ranges", () => {
    const interval = parseNoteInterval({
      start: "2026-07-13",
      end: "2026-07-26",
    }).value;
    expect(interval).not.toBeNull();
    const data: IntervalWeekData = {
      items: [{
        path: "Ranges/continuing.md",
        title: "Continuing lane",
        start: interval!.start,
        end: interval!.end,
        dayCount: interval!.dayCount,
        statistics: {
          wordCount: 0,
          linkCount: 0,
          tagCount: 0,
          taskTotal: 0,
          taskCompleted: 0,
          taskCompletionRate: 0,
        },
        lane: 2,
        colorIndex: 0,
        startColumn: 0,
        endColumn: 6,
        startsBeforeWeek: true,
        endsAfterWeek: false,
      }],
      visibleLaneCount: 3,
      hiddenCount: 0,
      hiddenItems: [],
      totalCount: 1,
    };
    const markup = renderToStaticMarkup(createElement(IntervalGantt, {
      data,
      variant: "month",
      ariaLabel: "Range notes",
      formatDuration: (count: number) => `${count} days`,
      formatMore: (count: number) => `${count} more`,
      formatTaskProgress: () => "No tasks",
      onOpenPath: async () => undefined,
    }));
    const window = new Window();
    window.document.body.innerHTML = markup;

    expect((window.document.querySelector(
      ".chrono-notes-month-interval-strip",
    ) as HTMLElement | null)?.style.gridTemplateRows).toBe(
      "repeat(3, var(--chrono-notes-month-interval-lane-height))",
    );
    expect((window.document.querySelector(
      ".chrono-notes-month-interval-item",
    ) as HTMLElement | null)?.style.gridRow).toBe("3");
  });

  it("uses compact month lanes while preserving the four-pixel line and coarse target", () => {
    expect(styles).toMatch(
      /\.chrono-notes-month-interval-strip\s*\{[^}]*grid-template-columns:\s*subgrid;[^}]*padding:\s*0 0 2px;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-month-interval-strip\s*\{[^}]*--chrono-notes-month-interval-lane-height:\s*10px;[^}]*--chrono-notes-month-interval-more-height:\s*12px;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-calendar button\.chrono-notes-month-interval-item\s*\{[^}]*--chrono-notes-month-interval-line-height:\s*4px;[^}]*--chrono-notes-interval-surface:\s*color-mix\(in srgb, var\(--chrono-notes-interval-color\) 72%, var\(--text-normal\)\);[^}]*background-color:\s*transparent;[^}]*height:\s*var\(--chrono-notes-month-interval-lane-height\);[^}]*min-height:\s*var\(--chrono-notes-month-interval-lane-height\);[^}]*position:\s*relative;/s,
    );
    expect(styles).toMatch(
      /@media \(pointer:\s*coarse\)[\s\S]*?\.chrono-notes-month-interval-strip\s*\{[^}]*--chrono-notes-month-interval-lane-height:\s*18px;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-calendar button\.chrono-notes-month-interval-more\s*\{[^}]*background:\s*transparent;[^}]*border:\s*0;[^}]*border-radius:\s*0;[^}]*height:\s*var\(--chrono-notes-month-interval-more-height\);[^}]*max-height:\s*var\(--chrono-notes-month-interval-more-height\);[^}]*min-height:\s*0;[^}]*padding:\s*0;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-calendar button\.chrono-notes-month-interval-item::before\s*\{[^}]*background-color:\s*var\(--chrono-notes-interval-surface\);[^}]*block-size:\s*var\(--chrono-notes-month-interval-line-height\);[^}]*inline-size:\s*100%;[^}]*inset-block-start:\s*50%;[^}]*pointer-events:\s*none;[^}]*position:\s*absolute;[^}]*transform:\s*translateY\(-50%\);/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-calendar button\.chrono-notes-month-interval-item\[data-continues-before="true"\]::before\s*\{[^}]*border-bottom-left-radius:\s*0;[^}]*border-top-left-radius:\s*0;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-calendar button\.chrono-notes-month-interval-item\[data-continues-after="true"\]::before\s*\{[^}]*border-bottom-right-radius:\s*0;[^}]*border-top-right-radius:\s*0;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-calendar button\.chrono-notes-month-interval-item:hover\s*\{[^}]*--chrono-notes-interval-surface:[^}]*z-index:\s*3;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-calendar button\.chrono-notes-month-interval-item\[data-related-active="true"\]\s*\{[^}]*--chrono-notes-interval-surface:[^}]*z-index:\s*2;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-calendar button\.chrono-notes-month-interval-item\[data-related-active="true"\]::before\s*\{[^}]*box-shadow:\s*0 0 0 1px color-mix\(/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-calendar button\.chrono-notes-month-interval-item:hover::before\s*\{[^}]*box-shadow:\s*0 0 0 1px var\(--chrono-notes-interval-color\);/s,
    );
    expect(styles.indexOf(
      '.chrono-notes-calendar button.chrono-notes-month-interval-item[data-related-active="true"] {',
    )).toBeLessThan(styles.indexOf(
      ".chrono-notes-calendar button.chrono-notes-month-interval-item:hover {",
    ));
    expect(styles).toMatch(
      /\.chrono-notes-calendar button\.chrono-notes-interval-bar:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--interactive-accent\);[^}]*z-index:\s*4;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-calendar button\.chrono-notes-month-interval-item > span\s*\{[^}]*clip-path:\s*inset\(50%\);[^}]*position:\s*absolute;/s,
    );
  });

  it("keeps titles, accessible labels, and continuation semantics", () => {
    const interval = parseNoteInterval({
      start: "2026-07-12",
      end: "2026-07-20",
    }).value;
    expect(interval).not.toBeNull();
    const data: IntervalWeekData = {
      items: [{
        path: "Ranges/planning.md",
        title: "Planning",
        start: interval!.start,
        end: interval!.end,
        dayCount: interval!.dayCount,
        statistics: Object.freeze({
          wordCount: 0,
          linkCount: 0,
          tagCount: 0,
          taskTotal: 2,
          taskCompleted: 1,
          taskCompletionRate: 50,
        }),
        lane: 0,
        colorIndex: 3,
        startColumn: 0,
        endColumn: 6,
        startsBeforeWeek: true,
        endsAfterWeek: true,
      }],
      visibleLaneCount: 1,
      hiddenCount: 1,
      hiddenItems: [{
        path: "Ranges/hidden-follow-up.md",
        title: "Hidden follow-up",
        start: interval!.start,
        end: interval!.end,
        dayCount: interval!.dayCount,
        statistics: Object.freeze({
          wordCount: 0,
          linkCount: 0,
          tagCount: 0,
          taskTotal: 3,
          taskCompleted: 0,
          taskCompletionRate: 0,
        }),
      }],
      totalCount: 2,
    };

    const markup = renderToStaticMarkup(createElement(IntervalGantt, {
      data,
      variant: "week",
      ariaLabel: "Range notes",
      formatDuration: (count: number) => `${count} days`,
      formatMore: (count: number) => `${count} more`,
      formatTaskProgress: (statistics) =>
        `${statistics.taskCompleted}/${statistics.taskTotal}`,
      onOpenPath: async () => undefined,
    }));

    expect(markup).toContain('role="group" aria-label="Range notes"');
    expect(markup).toContain('data-color-index="3"');
    expect(markup).toContain('data-continues-before="true"');
    expect(markup).toContain('data-continues-after="true"');
    expect(markup).toContain('data-task-state="in-progress"');
    expect(markup).toContain('--chrono-notes-interval-task-progress:50%');
    expect(markup).toContain(
      'aria-label="Planning, 2026-07-12 - 2026-07-20, 9 days, 1/2"',
    );
    expect(markup).toContain('title="Planning');
    expect(markup).toContain("...Planning...");
    expect(markup).toContain(
      'aria-label="1 more: Hidden follow-up, 0/3"',
    );
    expect(markup).toContain('title="Hidden follow-up, 0/3"');
  });
});
