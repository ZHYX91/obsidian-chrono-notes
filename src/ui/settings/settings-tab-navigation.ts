export const SETTINGS_TAB_IDS = [
  "general",
  "appearance",
  "periodic",
  "ranges",
  "integrations",
] as const;

export type SettingsTabId = (typeof SETTINGS_TAB_IDS)[number];

export interface SettingsTabScrollLayout {
  readonly clientWidth: number;
  readonly scrollWidth: number;
  readonly scrollLeft: number;
  readonly tabOffsetLeft: number;
  readonly tabOffsetWidth: number;
}

export function getSettingsTabScrollLeft(layout: SettingsTabScrollLayout): number {
  const clientWidth = finiteNonNegative(layout.clientWidth);
  const scrollWidth = finiteNonNegative(layout.scrollWidth);
  const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);
  const current = clamp(finiteNonNegative(layout.scrollLeft), 0, maxScrollLeft);
  const tabStart = Number.isFinite(layout.tabOffsetLeft) ? layout.tabOffsetLeft : 0;
  const tabEnd = tabStart + finiteNonNegative(layout.tabOffsetWidth);

  if (tabStart < current) return clamp(tabStart, 0, maxScrollLeft);
  if (tabEnd > current + clientWidth) {
    return clamp(tabEnd - clientWidth, 0, maxScrollLeft);
  }
  return current;
}

export function moveSettingsTab(current: SettingsTabId, key: string): SettingsTabId {
  const index = SETTINGS_TAB_IDS.indexOf(current);
  switch (key) {
    case "ArrowRight":
      return SETTINGS_TAB_IDS[(index + 1) % SETTINGS_TAB_IDS.length] ?? current;
    case "ArrowLeft":
      return (
        SETTINGS_TAB_IDS[(index - 1 + SETTINGS_TAB_IDS.length) % SETTINGS_TAB_IDS.length] ??
        current
      );
    case "Home":
      return SETTINGS_TAB_IDS[0];
    case "End":
      return SETTINGS_TAB_IDS.at(-1) ?? current;
    default:
      return current;
  }
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
