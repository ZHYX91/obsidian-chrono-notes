export const YEAR_QUARTER_COUNT = 4;
export const INITIAL_RENDERED_QUARTERS = Object.freeze([1, 2]);

export function clampQuarter(quarter: number): number {
  return Math.min(Math.max(Math.trunc(quarter), 1), YEAR_QUARTER_COUNT);
}

export function getQuarterWindow(quarter: number, overscan = 1): number[] {
  const center = clampQuarter(quarter);
  const distance = Math.max(Math.trunc(overscan), 0);
  const quarters: number[] = [];
  for (let current = center - distance; current <= center + distance; current += 1) {
    if (current >= 1 && current <= YEAR_QUARTER_COUNT) quarters.push(current);
  }
  return quarters;
}

export function getInitialRenderedQuarters(
  selectedMonth: number | null = null,
): Set<number> {
  const quarters = new Set<number>(INITIAL_RENDERED_QUARTERS);
  if (selectedMonth === null) return quarters;
  for (const quarter of getQuarterWindow(Math.ceil(selectedMonth / 3))) {
    quarters.add(quarter);
  }
  return quarters;
}

export function formatQuarterPlaceholderHeight(height: number): string | null {
  if (!Number.isFinite(height) || height <= 0) return null;
  return `${height}px`;
}

export function isSelectedDayRendered(
  daySelected: boolean,
  selectedMonth: number,
  renderedQuarters: ReadonlySet<number>,
): boolean {
  if (!daySelected) return false;
  return renderedQuarters.has(clampQuarter(Math.ceil(selectedMonth / 3)));
}
