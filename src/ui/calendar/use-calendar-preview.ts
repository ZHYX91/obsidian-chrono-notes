import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { shouldDismissCalendarPreview } from "./calendar-preview";
import type {
  ActiveCalendarPreview,
  CalendarPreviewCell,
} from "./calendar-preview-tooltip";

const HOVER_PREVIEW_DELAY_MS = 250;

export interface UseCalendarPreviewOptions<
  Cell extends CalendarPreviewCell,
> {
  readonly enabled: boolean;
  readonly dismissOnDisable: boolean;
  readonly isPreviewable?: (cell: Cell) => boolean;
}

export interface CalendarPreviewController<Cell extends CalendarPreviewCell> {
  readonly activePreview: ActiveCalendarPreview | null;
  readonly activePreviewKey: string | null;
  readonly previewId: string;
  readonly schedulePreview: (
    key: string,
    cell: Cell,
    anchor: HTMLElement,
  ) => void;
  readonly dismissPreview: () => void;
  readonly hidePreviewWithoutCancelling: () => void;
  readonly suppressPreviewFor: (durationMs: number) => void;
}

export function useCalendarPreview<Cell extends CalendarPreviewCell>({
  enabled,
  dismissOnDisable,
  isPreviewable = isAlwaysPreviewable,
}: UseCalendarPreviewOptions<Cell>): CalendarPreviewController<Cell> {
  const [activePreview, setActivePreview] =
    useState<ActiveCalendarPreview | null>(null);
  const previewTimer = useRef<number | null>(null);
  const suppressPreviewUntil = useRef(0);
  const previewId = useId();

  const clearPreviewTimer = useCallback(() => {
    if (previewTimer.current !== null)
      window.clearTimeout(previewTimer.current);
    previewTimer.current = null;
  }, []);

  const hidePreviewWithoutCancelling = useCallback(
    () => setActivePreview(null),
    [],
  );

  const dismissPreview = useCallback(() => {
    clearPreviewTimer();
    hidePreviewWithoutCancelling();
  }, [clearPreviewTimer, hidePreviewWithoutCancelling]);

  const schedulePreview = useCallback(
    (key: string, cell: Cell, anchor: HTMLElement) => {
      if (
        Date.now() < suppressPreviewUntil.current ||
        !enabled ||
        !isPreviewable(cell)
      )
        return;
      clearPreviewTimer();
      previewTimer.current = window.setTimeout(() => {
        previewTimer.current = null;
        setActivePreview({ key, cell, anchor });
      }, HOVER_PREVIEW_DELAY_MS);
    },
    [clearPreviewTimer, enabled, isPreviewable],
  );

  const suppressPreviewFor = useCallback((durationMs: number) => {
    suppressPreviewUntil.current = Date.now() + durationMs;
  }, []);

  useEffect(() => clearPreviewTimer, [clearPreviewTimer]);
  useEffect(() => {
    if (dismissOnDisable && shouldDismissCalendarPreview(enabled))
      dismissPreview();
  }, [dismissOnDisable, dismissPreview, enabled]);

  return {
    activePreview,
    activePreviewKey: activePreview?.key ?? null,
    previewId,
    schedulePreview,
    dismissPreview,
    hidePreviewWithoutCancelling,
    suppressPreviewFor,
  };
}

function isAlwaysPreviewable(): boolean {
  return true;
}
