import type { CSSProperties } from "react";

import type { FontSizeMode } from "../../shared/settings";

type CalendarFontVariables = CSSProperties & Readonly<{
  "--chrono-notes-font-header"?: string;
  "--chrono-notes-font-normal"?: string;
  "--chrono-notes-font-small"?: string;
  "--chrono-notes-font-micro"?: string;
}>;

export function getCalendarFontVariables(
  mode: FontSizeMode,
  fixedFactor: number,
): CalendarFontVariables {
  if (mode !== "immutable") return {};
  const factor = Math.min(20, Math.max(0, fixedFactor));
  return {
    "--chrono-notes-font-header": formatPixels(12 + factor * 0.3),
    "--chrono-notes-font-normal": formatPixels(10.4 + factor * 0.26),
    "--chrono-notes-font-small": formatPixels(8 + factor * 0.2),
    "--chrono-notes-font-micro": formatPixels(7 + factor * 0.15),
  };
}

function formatPixels(value: number): string {
  return `${Number(value.toFixed(2))}px`;
}
