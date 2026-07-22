import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";

import type { HeatmapMetric } from "../../core/statistics/heatmap";
import type { NoteStatistics } from "../../core/note/note-statistics";
import type {
  RegionalHoliday,
  RegionalWorkday,
} from "../../core/calendar/regional-holidays";
import type { Translator } from "../../shared/i18n";
import { placeCalendarPreview } from "./calendar-preview";
import {
  formatCalendarPreviewError,
  formatCalendarPreviewHeatmap,
  formatCalendarPreviewRegional,
  formatCalendarPreviewTaskProgress,
  getCalendarPreviewBody,
  getCalendarPreviewStateText,
} from "./calendar-preview-presentation";

export interface CalendarPreviewCell {
  readonly noteState: string;
  readonly preview: string | null;
  readonly errorMessage?: string;
  readonly heatmap?: HeatmapMetric | null;
  readonly holidays?: readonly RegionalHoliday[];
  readonly workday?: RegionalWorkday | null;
  readonly statistics: NoteStatistics;
}

export interface ActiveCalendarPreview {
  readonly key: string;
  readonly cell: CalendarPreviewCell;
  readonly anchor: HTMLElement;
}

export interface CalendarPreviewTooltipProps {
  readonly id: string;
  readonly preview: ActiveCalendarPreview;
  readonly translator: Translator;
}

export function CalendarPreviewTooltip({
  id,
  preview,
  translator,
}: CalendarPreviewTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });

  const updatePosition = useCallback(() => {
    const tooltip = tooltipRef.current;
    if (tooltip === null) return;
    const anchorRect = preview.anchor.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const position = placeCalendarPreview(anchorRect, tooltipRect, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
    setStyle({ ...position, visibility: "visible" });
  }, [preview.anchor]);

  useLayoutEffect(() => {
    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [preview, updatePosition]);

  return createPortal(
    <div
      ref={tooltipRef}
      id={id}
      className="chrono-notes-calendar-preview"
      role="tooltip"
      aria-live="polite"
      style={style}
    >
      <div className="chrono-notes-calendar-preview-date">{preview.key}</div>
      <HeatmapContent cell={preview.cell} t={translator.t} />
      <RegionalCalendarContent cell={preview.cell} t={translator.t} />
      <PreviewContent cell={preview.cell} t={translator.t} />
    </div>,
    document.body,
  );
}

function HeatmapContent({ cell, t }: Readonly<{
  cell: CalendarPreviewCell;
  t: Translator["t"];
}>) {
  if (cell.heatmap === null || cell.heatmap === undefined) return null;
  return (
    <div className="chrono-notes-calendar-preview-meta">
      {formatCalendarPreviewHeatmap(cell.heatmap, t)}
    </div>
  );
}

function RegionalCalendarContent({ cell, t }: Readonly<{
  cell: CalendarPreviewCell;
  t: Translator["t"];
}>) {
  const text = formatCalendarPreviewRegional(cell, t);

  return text === null
    ? null
    : <div className="chrono-notes-calendar-preview-meta">{text}</div>;
}

function PreviewContent({ cell, t }: Readonly<{
  cell: CalendarPreviewCell;
  t: Translator["t"];
}>) {
  const taskText = cell.statistics.taskTotal === 0
    ? null
    : formatCalendarPreviewTaskProgress({
        completed: cell.statistics.taskCompleted,
        total: cell.statistics.taskTotal,
      }, t);

  if (cell.noteState === "error") {
    return (
      <div className="chrono-notes-calendar-preview-error">
        {formatCalendarPreviewError(cell.errorMessage, t)}
      </div>
    );
  }
  const stateText = getCalendarPreviewStateText(cell.noteState, t);
  if (stateText !== null) {
    return <div className="chrono-notes-calendar-preview-meta">{stateText}</div>;
  }
  return (
    <>
      {taskText === null ? null : (
        <div className="chrono-notes-calendar-preview-meta">{taskText}</div>
      )}
      <div className="chrono-notes-calendar-preview-body">
        {getCalendarPreviewBody(cell.preview, t)}
      </div>
    </>
  );
}
