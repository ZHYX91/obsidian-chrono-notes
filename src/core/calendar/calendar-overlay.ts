import type { LocalDate } from "../periodic/periodic-date";

export const CALENDAR_OVERLAY_IDS = ["chinese-lunar", "ganzhi"] as const;

export type CalendarOverlayId = typeof CALENDAR_OVERLAY_IDS[number];
export type CalendarOverlayEventKind = "festival" | "solar-term";
export type CalendarOverlayTransition = "month" | "year-month";

export interface CalendarOverlayResult {
  readonly dateText: string;
  readonly eventText: string | null;
  readonly eventKind: CalendarOverlayEventKind | null;
  readonly transition: CalendarOverlayTransition | null;
  readonly accessibilityText: string;
}

export interface CalendarOverlayDay extends CalendarOverlayResult {
  readonly id: CalendarOverlayId;
}

export interface CalendarOverlayProvider {
  readonly id: CalendarOverlayId;
  getDay(date: LocalDate, locale: string): CalendarOverlayResult;
}
