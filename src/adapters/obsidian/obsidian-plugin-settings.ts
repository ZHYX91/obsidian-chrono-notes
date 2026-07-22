interface ObsidianSettingsApi {
  open(): void;
  openTabById(id: string): void;
}

export function openObsidianPluginSettings(app: unknown, pluginId: string): boolean {
  const setting = isRecord(app) ? app.setting : undefined;
  if (!isObsidianSettingsApi(setting)) return false;
  setting.open();
  setting.openTabById(pluginId);
  return true;
}

function isObsidianSettingsApi(value: unknown): value is ObsidianSettingsApi {
  return isRecord(value) &&
    typeof value.open === "function" &&
    typeof value.openTabById === "function";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
