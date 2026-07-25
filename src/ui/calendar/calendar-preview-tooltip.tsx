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
import type { NoteEmbedStatistics } from "../../core/note/note-preview";
import type { PeriodicNoteType } from "../../core/periodic/periodic-date";
import type {
  RegionalHoliday,
  RegionalWorkday,
} from "../../core/calendar/regional-holidays";
import type {
  CalendarExtensionDay,
  CalendarExtensionEvent,
} from "../../core/calendar/calendar-extension";
import type { IcsEventOccurrence } from "../../core/calendar/ics-calendar";
import type { Translator } from "../../shared/i18n";
import { useHostEnvironment } from "../host-environment";
import { placeCalendarPreview } from "./calendar-preview";
import { formatCalendarExtensionEventLabel } from "./calendar-day-presentation";
import { formatCalendarIcsDayLabel } from "./calendar-ics-presentation";
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
  readonly embeds?: NoteEmbedStatistics;
  readonly periodicNoteType?: PeriodicNoteType;
  readonly previewTitle?: string;
  readonly previewSubtitle?: string | null;
  readonly errorMessage?: string;
  readonly heatmap?: HeatmapMetric | null;
  readonly holidays?: readonly RegionalHoliday[];
  readonly workday?: RegionalWorkday | null;
  readonly calendarExtensions?: readonly CalendarExtensionDay[];
  readonly calendarEvents?: readonly CalendarExtensionEvent[];
  readonly icsEvents?: readonly IcsEventOccurrence[];
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
  const host = useHostEnvironment();
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });

  const updatePosition = useCallback(() => {
    const tooltip = tooltipRef.current;
    if (tooltip === null) return;
    const anchorRect = preview.anchor.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const position = placeCalendarPreview(anchorRect, tooltipRect, {
      width: host.window.innerWidth,
      height: host.window.innerHeight,
    });
    setStyle({ ...position, visibility: "visible" });
  }, [host.window, preview.anchor]);

  useLayoutEffect(() => {
    updatePosition();
    const frame = host.window.requestAnimationFrame(updatePosition);
    host.window.addEventListener("resize", updatePosition);
    host.window.addEventListener("scroll", updatePosition, true);
    return () => {
      host.window.cancelAnimationFrame(frame);
      host.window.removeEventListener("resize", updatePosition);
      host.window.removeEventListener("scroll", updatePosition, true);
    };
  }, [host.window, preview, updatePosition]);

  return createPortal(
    <div
      ref={tooltipRef}
      id={id}
      className="chrono-notes-calendar-preview"
      role="tooltip"
      aria-live="polite"
      style={style}
    >
      <div className="chrono-notes-calendar-preview-date">
        {preview.cell.previewTitle ?? preview.key}
      </div>
      <div className="chrono-notes-calendar-preview-main">
        <div className="chrono-notes-calendar-preview-details">
          {preview.cell.previewSubtitle === null ||
              preview.cell.previewSubtitle === undefined
            ? null
            : (
              <div className="chrono-notes-calendar-preview-meta">
                {preview.cell.previewSubtitle}
              </div>
            )}
          <CalendarExtensionContent cell={preview.cell} t={translator.t} />
          <HeatmapContent cell={preview.cell} t={translator.t} />
          <RegionalCalendarContent cell={preview.cell} t={translator.t} />
          <IcsCalendarContent cell={preview.cell} t={translator.t} />
        </div>
        <PreviewContent cell={preview.cell} t={translator.t} />
      </div>
      <EmbedStatisticsContent cell={preview.cell} t={translator.t} />
    </div>,
    host.document.body,
  );
}

function EmbedStatisticsContent({ cell, t }: Readonly<{
  cell: CalendarPreviewCell;
  t: Translator["t"];
}>) {
  const embeds = cell.embeds;
  if (embeds === undefined) return null;
  const items = [
    [embeds.imageCount, "calendarPreview.embedImages"],
    [embeds.pdfCount, "calendarPreview.embedPdfs"],
    [embeds.audioCount, "calendarPreview.embedAudio"],
    [embeds.videoCount, "calendarPreview.embedVideo"],
    [embeds.noteCount, "calendarPreview.embedNotes"],
    [embeds.otherCount, "calendarPreview.embedOther"],
  ] as const;
  const labels = items
    .filter(([count]) => count > 0)
    .map(([count, key]) => t(key, { count }));
  if (labels.length === 0) return null;
  return (
    <div className="chrono-notes-calendar-preview-embeds">
      {labels.join(t("calendarPreview.embedSeparator"))}
    </div>
  );
}

function IcsCalendarContent({ cell, t }: Readonly<{
  cell: CalendarPreviewCell;
  t: Translator["t"];
}>) {
  const text = formatCalendarIcsDayLabel(cell.icsEvents ?? [], t);
  return text.length === 0
    ? null
    : <div className="chrono-notes-calendar-preview-meta">{text}</div>;
}

function CalendarExtensionContent({ cell, t }: Readonly<{
  cell: CalendarPreviewCell;
  t: Translator["t"];
}>) {
  const extensions = cell.calendarExtensions ?? [];
  const events = cell.calendarEvents ?? [];
  if (extensions.length === 0 && events.length === 0) return null;
  return (
    <div className="chrono-notes-calendar-preview-calendar">
      {extensions.map((extension) => (
        <div
          className="chrono-notes-calendar-preview-meta"
          data-calendar-extension-id={extension.id}
          key={extension.id}
        >
          {extension.accessibilityText}
        </div>
      ))}
      {events.map((event) => (
        <div
          className="chrono-notes-calendar-preview-meta"
          data-calendar-event-id={event.id}
          key={event.id}
        >
          {formatCalendarExtensionEventLabel(event, t)}
        </div>
      ))}
    </div>
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
  const stateText = getCalendarPreviewStateText(
    cell.noteState,
    t,
    cell.periodicNoteType,
  );
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
