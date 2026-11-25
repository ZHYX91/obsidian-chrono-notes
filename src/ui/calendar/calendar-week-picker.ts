export type WeekPickerColumnCount = 2 | 3;

export interface WeekPickerNavigationInput {
  readonly key: string;
  readonly currentIndex: number;
  readonly itemCount: number;
  readonly columns: WeekPickerColumnCount;
  readonly direction?: "ltr" | "rtl";
}

export interface WeekPickerTypeaheadResult {
  readonly buffer: string;
  readonly targetIndex: number | null;
}

const THREE_COLUMN_MIN_WIDTH = 360;
const PAGE_ROW_COUNT = 5;
// Decimal keys used by the supported interface languages, independent of the current locale.
const WEEK_DIGITS = ["0123456789", "٠١٢٣٤٥٦٧٨٩", "۰۱۲۳۴۵۶۷۸۹", "०१२३४५६७८९", "０１２３４５６７８９"];

export function getWeekPickerColumnCount(width: number): WeekPickerColumnCount {
  return width >= THREE_COLUMN_MIN_WIDTH ? 3 : 2;
}

export function getWeekPickerContentBoxWidth(
  borderBoxWidth: number,
  paddingLeft: number,
  paddingRight: number,
  borderLeft: number,
  borderRight: number,
): number {
  return Math.max(
    0,
    borderBoxWidth - paddingLeft - paddingRight - borderLeft - borderRight,
  );
}

export function resolveWeekPickerNavigation(
  input: WeekPickerNavigationInput,
): number | null {
  if (input.itemCount <= 0) return null;
  const lastIndex = input.itemCount - 1;
  const nextIndex = (() => {
    switch (input.key) {
      case "ArrowLeft":
        return input.currentIndex + (input.direction === "rtl" ? 1 : -1);
      case "ArrowRight":
        return input.currentIndex + (input.direction === "rtl" ? -1 : 1);
      case "ArrowUp":
        return input.currentIndex - input.columns;
      case "ArrowDown":
        return input.currentIndex + input.columns;
      case "Home":
        return 0;
      case "End":
        return lastIndex;
      case "PageUp":
        return input.currentIndex - input.columns * PAGE_ROW_COUNT;
      case "PageDown":
        return input.currentIndex + input.columns * PAGE_ROW_COUNT;
      default:
        return null;
    }
  })();
  if (nextIndex === null) return null;
  return Math.min(lastIndex, Math.max(0, nextIndex));
}

export function resolveWeekPickerTypeahead(
  currentBuffer: string,
  key: string,
  itemCount: number,
): WeekPickerTypeaheadResult | null {
  if (key.length !== 1) return null;
  const digits = WEEK_DIGITS.find((system) => system.includes(key));
  if (digits === undefined) return null;
  const digit = digits.indexOf(key);
  const nextBuffer = `${currentBuffer}${digit}`.slice(-2);
  const parsed = Number(nextBuffer);
  const targetWeek = parsed >= 1 && parsed <= itemCount
    ? parsed
    : digit >= 1 && digit <= itemCount
      ? digit
      : null;
  return Object.freeze({
    buffer: targetWeek === digit ? String(digit) : nextBuffer,
    targetIndex: targetWeek === null ? null : targetWeek - 1,
  });
}
