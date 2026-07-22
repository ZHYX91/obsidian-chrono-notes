import type { Translator } from "../../shared/i18n";

export interface YearPickerWindow {
  readonly start: number;
  readonly end: number;
  readonly years: readonly number[];
}

export interface MonthPickerItem {
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

const YEAR_WINDOW_SIZE = 20;

export function formatPeriodPickerTargetLabel(
  target: string,
  current: boolean,
  translator: Translator,
): string {
  return current
    ? translator.t("calendar.currentPickerTarget", { target })
    : target;
}

export function getYearPickerWindow(year: number): YearPickerWindow {
  if (!Number.isInteger(year)) throw new RangeError("Picker year must be an integer");
  const start = Math.floor((year - 1) / YEAR_WINDOW_SIZE) * YEAR_WINDOW_SIZE + 1;
  const years = Object.freeze(
    Array.from({ length: YEAR_WINDOW_SIZE }, (_, index) => start + index),
  );
  return Object.freeze({ start, end: start + YEAR_WINDOW_SIZE - 1, years });
}

export function shiftYearPickerWindow(
  window: YearPickerWindow,
  direction: -1 | 1,
): YearPickerWindow {
  return getYearPickerWindow(window.start + direction * YEAR_WINDOW_SIZE);
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
