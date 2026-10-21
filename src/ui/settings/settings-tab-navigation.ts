export const SETTINGS_TAB_IDS = [
  "general",
  "appearance",
  "periodic",
  "ranges",
  "extensions-and-integrations",
] as const;

export type SettingsTabId = (typeof SETTINGS_TAB_IDS)[number];

export function moveSettingsTab(
  current: SettingsTabId,
  key: string,
  direction: "ltr" | "rtl" = "ltr",
): SettingsTabId {
  const index = SETTINGS_TAB_IDS.indexOf(current);
  switch (key) {
    case "ArrowRight":
      return SETTINGS_TAB_IDS[
        (index + (direction === "rtl" ? -1 : 1) + SETTINGS_TAB_IDS.length) %
          SETTINGS_TAB_IDS.length
      ] ?? current;
    case "ArrowLeft":
      return SETTINGS_TAB_IDS[
        (index + (direction === "rtl" ? 1 : -1) + SETTINGS_TAB_IDS.length) %
          SETTINGS_TAB_IDS.length
      ] ?? current;
    case "Home":
      return SETTINGS_TAB_IDS[0];
    case "End":
      return SETTINGS_TAB_IDS.at(-1) ?? current;
    default:
      return current;
  }
}
