export interface PreviewAnchorRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface PreviewSize {
  readonly width: number;
  readonly height: number;
}

export interface PreviewViewport {
  readonly width: number;
  readonly height: number;
}

export interface PreviewPosition {
  readonly left: number;
  readonly top: number;
  readonly maxHeight: number;
}

const PREVIEW_GAP = 6;
const VIEWPORT_MARGIN = 12;
const MAX_PREVIEW_HEIGHT = 240;

export function shouldDismissCalendarPreview(showHoverPreview: boolean): boolean {
  return !showHoverPreview;
}

export function placeCalendarPreview(
  anchor: PreviewAnchorRect,
  preview: PreviewSize,
  viewport: PreviewViewport,
): PreviewPosition {
  const maxLeft = Math.max(VIEWPORT_MARGIN, viewport.width - preview.width - VIEWPORT_MARGIN);
  const belowTop = anchor.top + anchor.height + PREVIEW_GAP;
  const availableBelow = Math.max(0, viewport.height - belowTop - VIEWPORT_MARGIN);
  const availableAbove = Math.max(0, anchor.top - PREVIEW_GAP - VIEWPORT_MARGIN);
  const fitsBelow = preview.height <= availableBelow;
  const fitsAbove = preview.height <= availableAbove;
  const shouldPlaceAbove = !fitsBelow && (fitsAbove || availableAbove > availableBelow);
  const availableHeight = shouldPlaceAbove ? availableAbove : availableBelow;
  const maxHeight = Math.min(MAX_PREVIEW_HEIGHT, availableHeight);
  const renderedHeight = Math.min(preview.height, maxHeight);

  return Object.freeze({
    left: clamp(
      anchor.left + anchor.width / 2 - preview.width / 2,
      VIEWPORT_MARGIN,
      maxLeft,
    ),
    top: shouldPlaceAbove
      ? Math.max(VIEWPORT_MARGIN, anchor.top - PREVIEW_GAP - renderedHeight)
      : Math.max(VIEWPORT_MARGIN, belowTop),
    maxHeight,
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
