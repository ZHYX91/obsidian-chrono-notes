import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  CalendarNoteIndicator,
  type CalendarNoteIndicatorProps,
} from "../../src/ui/calendar/calendar-note-indicator";
import type { NoteStatistics } from "../../src/core/note/note-statistics";

function renderIndicator(props: CalendarNoteIndicatorProps): string {
  return renderToStaticMarkup(CalendarNoteIndicator(props));
}

function statistics(completed: number, total: number): NoteStatistics {
  return Object.freeze({
    wordCount: 0,
    linkCount: 0,
    tagCount: 0,
    taskTotal: total,
    taskCompleted: completed,
    taskCompletionRate: total === 0 ? 0 : Math.round((completed / total) * 100),
  });
}

describe("CalendarNoteIndicator", () => {
  it("renders only in the fixed top slot and disappears when disabled", () => {
    expect(renderIndicator({
      show: true,
      noteState: "missing",
      statistics: statistics(0, 0),
      taskAnnotationMode: "hole",
    }))
      .toContain("is-top is-state");
    expect(renderIndicator({
      show: false,
      noteState: "missing",
      statistics: statistics(0, 0),
      taskAnnotationMode: "hole",
    })).toBe("");
    expect(renderIndicator({
      show: true,
      noteState: "not-configured",
      statistics: statistics(0, 0),
      taskAnnotationMode: "hole",
    })).toBe("");
  });

  it("uses one compact horizontal proportional progress bar", () => {
    const markup = renderIndicator({
      show: true,
      noteState: "has-body",
      statistics: statistics(1, 4),
      taskAnnotationMode: "hole",
    });

    expect(markup).toContain("is-top is-progress is-horizontal");
    expect(markup).toContain("is-unfinished-hole");
    expect(markup).toContain("width:25%");
    expect(markup).toContain("data-progress-text=\"1/4\"");
    expect(markup).toContain("chrono-notes-calendar-indicator-fill");
    expect(markup).not.toContain("is-vertical");
    expect(markup).not.toContain(">1/4<");
  });

  it("supports disabled, color, and hole treatments without changing task data", () => {
    const disabled = renderIndicator({
      show: true,
      noteState: "has-body",
      statistics: statistics(0, 4),
      taskAnnotationMode: "none",
    });
    const color = renderIndicator({
      show: true,
      noteState: "has-body",
      statistics: statistics(0, 4),
      taskAnnotationMode: "color",
    });
    const hole = renderIndicator({
      show: true,
      noteState: "has-body",
      statistics: statistics(0, 4),
      taskAnnotationMode: "hole",
    });

    expect(disabled).toContain("is-top is-state");
    expect(disabled).not.toContain("is-progress");
    expect(color).toContain("is-unfinished-color");
    expect(color).toContain("data-progress-text=\"0/4\"");
    expect(hole).toContain("is-unfinished-hole");
    expect(hole).toContain("data-progress-text=\"0/4\"");
  });

  it("does not mark completed tasks as unfinished", () => {
    const markup = renderIndicator({
      show: true,
      noteState: "has-body",
      statistics: statistics(4, 4),
      taskAnnotationMode: "color",
    });
    expect(markup).toContain("is-complete");
    expect(markup).not.toContain("is-unfinished");
  });

  it("clamps malformed progress instead of emitting invalid geometry", () => {
    const markup = renderIndicator({
      show: true,
      noteState: "has-body",
      statistics: statistics(9, 4),
      taskAnnotationMode: "hole",
    });
    expect(markup).toContain("width:100%");
    expect(markup).toContain("data-progress-text=\"9/4\"");
  });
});
