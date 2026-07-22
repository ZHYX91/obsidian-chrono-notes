import type { App, Plugin } from "obsidian";

import type { IcsEventIndexSnapshot } from "../../features/calendar/ics-event-index";
import type { Translator } from "../../shared/i18n";
import type { ChronoNotesSettings } from "../../shared/settings";
import type { VaultPathSuggestionCatalog } from "./vault-path-suggest";

export interface SettingsHost extends Plugin {
  settings: ChronoNotesSettings;
  saveSettings(): Promise<void>;
  openIntervalNoteList(): void;
  getIcsSnapshot(): IcsEventIndexSnapshot | null;
  refreshIcs(showNotice?: boolean): Promise<void>;
  openFirstUseGuide(): void;
}

export interface SettingsSectionContext {
  readonly app: App;
  readonly host: SettingsHost;
  readonly translator: Translator;
  readonly vaultPathSuggestionCatalog: VaultPathSuggestionCatalog;
  persistSettings(): Promise<void>;
  scheduleSettingsSave(): void;
  flushSettingsSaveOnBlur(inputEl: HTMLInputElement | HTMLTextAreaElement): void;
  display(): void;
}
