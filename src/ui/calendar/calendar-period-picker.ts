import type { Translator } from "../../shared/i18n";
import { getCenturyNumber, getPeriodAnchor, type PeriodicNoteType } from "../../core/periodic/periodic-date";

export type PeriodGridKind = "year" | "century";

export interface PeriodPickerItem {
  readonly start: number;
  readonly end: number;
  readonly label: string;
  readonly detail: string | null;
}

export interface PeriodPickerWindow {
  readonly title: string;
  readonly previousYear: number | null;
  readonly nextYear: number | null;
  readonly items: readonly PeriodPickerItem[];
}

interface MonthPickerItem {
  readonly month: number;
  readonly label: string;
}

export interface MonthPickerRow {
  readonly quarter: number;
  readonly quarterLabel: string;
  readonly months: readonly MonthPickerItem[];
}

export interface PeriodPickerPointerInput {
  readonly button: number;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly detail: number;
}

export interface PeriodPickerKeyboardInput {
  readonly key: string;
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
}

export type PeriodPickerAction = "select" | "open-default" | "open-tab" | "ignore";

const GRID_PERIODS = {
  year: { noteType: "yearly", step: 1, origin: 1, count: 20 },
  century: { noteType: "century", step: 100, origin: 1, count: 10 },
} as const satisfies Record<PeriodGridKind, {
  noteType: PeriodicNoteType; step: number; origin: number; count: number;
}>;

export function formatPeriodPickerTargetLabel(
  target: string,
  current: boolean,
  translator: Translator,
): string {
  return current
    ? translator.t("calendar.currentPickerTarget", { target })
    : target;
}

export function getPeriodPickerAnchor(kind: PeriodGridKind, year: number): number {
  return getPeriodAnchor({ year, month: 1, day: 1 }, GRID_PERIODS[kind].noteType, "monday").year;
}

export function getPeriodPickerWindow(kind: PeriodGridKind, year: number): PeriodPickerWindow {
  if (!Number.isInteger(year) || year < 1 || year > 9999) {
    throw new RangeError("Picker year must be between 1 and 9999");
  }
  const { step, origin, count } = GRID_PERIODS[kind];
  const span = step * count;
  const start = Math.floor((year - origin) / span) * span + origin;
  const items = Object.freeze(Array.from({ length: count }, (_, index) => {
    const first = start + index * step;
    const last = first + step - 1;
    return Object.freeze({
      start: first,
      end: last,
      label: kind === "century" ? `C${getCenturyNumber(first)}` : String(first),
      detail: kind === "year" ? null : `${first}–${last}`,
    });
  }).filter((item) => item.start <= 9999));
  const first = items[0];
  const last = items.at(-1);
  if (first === undefined || last === undefined) throw new RangeError("Empty picker page");
  return Object.freeze({
    title: kind === "century" ? `${first.label}–${last.label}` : `${first.start}–${last.end}`,
    previousYear: start > origin ? Math.max(1, start - span) : null,
    nextYear: last.end < 9999 ? last.end + 1 : null,
    items,
  });
}

export function resolvePeriodGridNavigation(
  key: string,
  index: number,
  count: number,
  columns: number,
  rtl: boolean,
): number | null {
  const offset = key === "ArrowLeft" ? (rtl ? 1 : -1)
    : key === "ArrowRight" ? (rtl ? -1 : 1)
      : key === "ArrowUp" ? -columns : key === "ArrowDown" ? columns : null;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return offset === null ? null : Math.max(0, Math.min(count - 1, index + offset));
}

export function buildMonthPickerRows(
  formatQuarter: (quarter: number) => string,
  formatMonth: (month: number) => string,
): readonly MonthPickerRow[] {
  return Object.freeze(Array.from({ length: 4 }, (_, quarterIndex) => {
    const quarter = quarterIndex + 1;
    const months = Object.freeze(Array.from({ length: 3 }, (_, monthIndex) => {
      const month = quarterIndex * 3 + monthIndex + 1;
      return Object.freeze({ month, label: formatMonth(month) });
    }));
    return Object.freeze({
      quarter,
      quarterLabel: formatQuarter(quarter),
      months,
    });
  }));
}

export function resolvePeriodPickerAction(
  input: PeriodPickerPointerInput,
): PeriodPickerAction {
  if (input.button === 1 || input.ctrlKey || input.metaKey) return "open-tab";
  if (input.button !== 0) return "ignore";
  return input.detail >= 2 ? "open-default" : "select";
}

export function resolvePeriodPickerKeyboardAction(
  input: PeriodPickerKeyboardInput,
): Extract<PeriodPickerAction, "open-default" | "open-tab"> | null {
  if (input.key !== "Enter") return null;
  if (input.ctrlKey || input.metaKey) return "open-tab";
  return input.shiftKey ? "open-default" : null;
}
