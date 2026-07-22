import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import type { NoteStatistics } from "../../core/note/note-statistics";
import type { IntervalWeekData } from "../../features/intervals/interval-note-query";
import type { NoteOpenTarget } from "../../features/periodic/periodic-note-commands";
import { getNoteTaskProgressPresentation } from "../note-task-progress-presentation";

interface IntervalBarStyle extends CSSProperties {
  readonly "--chrono-notes-interval-task-progress": string;
}

export interface IntervalGanttProps {
  readonly data: IntervalWeekData;
  readonly variant: "month" | "week";
  readonly ariaLabel: string;
  readonly formatDuration: (dayCount: number) => string;
  readonly formatMore: (hiddenCount: number) => string;
  readonly formatTaskProgress: (statistics: NoteStatistics) => string;
  readonly linkedPathInteraction?: Readonly<{
    activePath: string | null;
    onHoverPathChange: (path: string | null) => void;
    onFocusPathChange: (path: string | null) => void;
  }>;
  readonly onOpenPath: (path: string, target: NoteOpenTarget) => Promise<void>;
}

export function IntervalGantt({
  data,
  variant,
  ariaLabel,
  formatDuration,
  formatMore,
  formatTaskProgress,
  linkedPathInteraction,
  onOpenPath,
}: IntervalGanttProps) {
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowId = useId();
  const overflowButtonRef = useRef<HTMLButtonElement>(null);
  const overflowPanelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!overflowOpen) return undefined;
    const dismissOnPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node;
      if (
        !overflowButtonRef.current?.contains(target) &&
        !overflowPanelRef.current?.contains(target)
      ) {
        setOverflowOpen(false);
      }
    };
    const dismissOnEscape = (event: globalThis.KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      setOverflowOpen(false);
      overflowButtonRef.current?.focus();
    };
    document.addEventListener("pointerdown", dismissOnPointerDown);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOnPointerDown);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [overflowOpen]);
  if (data.totalCount === 0) return null;
  const monthGridTemplateRows = variant === "month"
    ? [
        data.visibleLaneCount === 0
          ? null
          : `repeat(${data.visibleLaneCount}, var(--chrono-notes-month-interval-lane-height))`,
        data.hiddenCount === 0
          ? null
          : "var(--chrono-notes-month-interval-more-height)",
      ].filter((track) => track !== null).join(" ")
    : undefined;
  const hiddenDetails = data.hiddenItems.map((item) =>
    `${item.title}, ${formatTaskProgress(item.statistics)}`);
  return (
    <div
      className={`chrono-notes-interval-gantt chrono-notes-${variant}-interval-strip`}
      data-variant={variant}
      role="group"
      aria-label={ariaLabel}
      style={{ gridTemplateRows: monthGridTemplateRows }}
    >
      {data.items.map((item) => {
        const relatedActive =
          linkedPathInteraction?.activePath === item.path;
        const taskProgress = getNoteTaskProgressPresentation(item.statistics);
        const taskLabel = formatTaskProgress(item.statistics);
        const style: IntervalBarStyle = {
          gridColumn: `${item.startColumn + 1} / ${item.endColumn + 2}`,
          gridRow: item.lane + 1,
          "--chrono-notes-interval-task-progress": `${taskProgress.fraction * 100}%`,
        };
        const title = [
          item.title,
          `${formatBoundary(item.start.value, item.start.hasTime)} - ${formatBoundary(item.end.value, item.end.hasTime)}`,
          formatDuration(item.dayCount),
          taskLabel,
        ].join("\n");
        return (
          <button
            type="button"
            className={`chrono-notes-interval-bar chrono-notes-${variant}-interval-item`}
            style={style}
            data-related-active={
              linkedPathInteraction === undefined
                ? undefined
                : String(relatedActive)
            }
            data-color-index={item.colorIndex}
            data-continues-before={String(item.startsBeforeWeek)}
            data-continues-after={String(item.endsAfterWeek)}
            data-task-state={taskProgress.state}
            aria-label={title.replaceAll("\n", ", ")}
            title={title}
            key={item.path}
            onMouseEnter={
              linkedPathInteraction === undefined
                ? undefined
                : () => linkedPathInteraction.onHoverPathChange(item.path)
            }
            onMouseLeave={
              linkedPathInteraction === undefined
                ? undefined
                : () => linkedPathInteraction.onHoverPathChange(null)
            }
            onFocus={
              linkedPathInteraction === undefined
                ? undefined
                : () => linkedPathInteraction.onFocusPathChange(item.path)
            }
            onBlur={
              linkedPathInteraction === undefined
                ? undefined
                : () => linkedPathInteraction.onFocusPathChange(null)
            }
            onClick={() => void onOpenPath(item.path, "tab")}
          >
            <span>
              {item.startsBeforeWeek ? "..." : ""}
              {item.title}
              {item.endsAfterWeek ? "..." : ""}
            </span>
          </button>
        );
      })}
      {data.hiddenCount === 0 ? null : (
        <button
          ref={overflowButtonRef}
          type="button"
          className={`chrono-notes-interval-more chrono-notes-${variant}-interval-more`}
          style={{
            gridColumn: "1 / -1",
            gridRow: data.visibleLaneCount + 1,
          }}
          title={hiddenDetails.join("\n")}
          aria-label={`${formatMore(data.hiddenCount)}: ${hiddenDetails.join("; ")}`}
          aria-expanded={overflowOpen}
          aria-controls={overflowId}
          aria-haspopup="dialog"
          onClick={() => setOverflowOpen((open) => !open)}
        >
          +{data.hiddenCount}
        </button>
      )}
      {!overflowOpen || data.hiddenCount === 0 ? null : (
        <div
          ref={overflowPanelRef}
          id={overflowId}
          className="chrono-notes-interval-overflow"
          role="dialog"
          aria-label={formatMore(data.hiddenCount)}
        >
          {data.hiddenItems.map((item) => {
            const taskLabel = formatTaskProgress(item.statistics);
            const title = [
              item.title,
              `${formatBoundary(item.start.value, item.start.hasTime)} - ${formatBoundary(item.end.value, item.end.hasTime)}`,
              formatDuration(item.dayCount),
              taskLabel,
            ].join("\n");
            return (
              <button
                type="button"
                className="chrono-notes-interval-overflow-item"
                key={item.path}
                aria-label={title.replaceAll("\n", ", ")}
                title={title}
                onClick={() => {
                  setOverflowOpen(false);
                  void onOpenPath(item.path, "tab");
                }}
              >
                <strong>{item.title}</strong>
                <span>
                  {formatBoundary(item.start.value, item.start.hasTime)} - {formatBoundary(item.end.value, item.end.hasTime)}
                </span>
                <small>{taskLabel}</small>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatBoundary(value: string, hasTime: boolean): string {
  return hasTime ? value.replace("T", " ") : value;
}
