import { normalizeIntervalNoteDates } from "../../core/note/interval-note-spec";
import {
  compareLocalDate,
  isSameLocalDate,
  type LocalDate,
} from "../../core/periodic/periodic-date";

export interface MonthRangeDragInput {
  readonly button: number;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
}

export interface MonthRangeDragPreview {
  readonly start: LocalDate;
  readonly end: LocalDate;
  readonly didDrag: boolean;
}

export interface MonthRangeDragCompletion {
  readonly start: LocalDate;
  readonly end: LocalDate;
}

interface ActiveDrag {
  readonly anchor: LocalDate;
  readonly current: LocalDate;
  readonly didDrag: boolean;
}

export class MonthRangeDragGesture {
  private active: ActiveDrag | null = null;
  private suppressNextClick = false;

  start(date: LocalDate, input: MonthRangeDragInput): MonthRangeDragPreview | null {
    this.suppressNextClick = false;
    if (!isUnmodifiedPrimaryInput(input)) return null;
    const anchor = copyDate(date);
    this.active = Object.freeze({ anchor, current: anchor, didDrag: false });
    return this.getPreview();
  }

  move(date: LocalDate, buttons: number): MonthRangeDragPreview | null {
    if (this.active === null) return null;
    if ((buttons & 1) === 0) {
      this.cancel();
      return null;
    }
    if (isSameLocalDate(this.active.current, date)) return this.getPreview();
    this.active = Object.freeze({
      anchor: this.active.anchor,
      current: copyDate(date),
      didDrag: true,
    });
    return this.getPreview();
  }

  finish(date: LocalDate | undefined, button: number): MonthRangeDragCompletion | null {
    if (this.active === null) return null;
    if (button !== 0) {
      this.cancel();
      return null;
    }

    const completed = date === undefined
      ? this.active
      : Object.freeze({
          anchor: this.active.anchor,
          current: copyDate(date),
          didDrag: this.active.didDrag || !isSameLocalDate(this.active.anchor, date),
        });
    this.active = null;
    if (!completed.didDrag || isSameLocalDate(completed.anchor, completed.current)) return null;

    const normalized = normalizeIntervalNoteDates(completed.anchor, completed.current);
    this.suppressNextClick = true;
    return Object.freeze({
      start: normalized.start,
      end: normalized.end,
    });
  }

  cancel(): void {
    this.active = null;
  }

  isActive(): boolean {
    return this.active !== null;
  }

  getPreview(): MonthRangeDragPreview | null {
    if (this.active === null) return null;
    const normalized = normalizeIntervalNoteDates(this.active.anchor, this.active.current);
    return Object.freeze({
      start: normalized.start,
      end: normalized.end,
      didDrag: this.active.didDrag,
    });
  }

  consumeClick(): boolean {
    if (!this.suppressNextClick) return false;
    this.suppressNextClick = false;
    return true;
  }
}

export function isDateInMonthRange(
  date: LocalDate,
  preview: Pick<MonthRangeDragPreview, "start" | "end">,
): boolean {
  return compareLocalDate(date, preview.start) >= 0 &&
    compareLocalDate(date, preview.end) <= 0;
}

function isUnmodifiedPrimaryInput(input: MonthRangeDragInput): boolean {
  return input.button === 0 &&
    !input.altKey &&
    !input.ctrlKey &&
    !input.metaKey &&
    !input.shiftKey;
}

function copyDate(date: LocalDate): LocalDate {
  return Object.freeze({ year: date.year, month: date.month, day: date.day });
}
