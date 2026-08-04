import type { App } from "obsidian";

import type { IcsEventIndexSnapshot } from "../../features/calendar/ics-event-index";
import type { NoteIndexStatus } from "../../features/notes/note-index";
import type { NoteIndexCacheStorageStatus } from "../../features/notes/note-index-cache";
import type { Translator } from "../../shared/i18n";
import type { ChronoNotesSettings } from "../../shared/settings";
import type { VaultPathSuggestionCatalog } from "./vault-path-suggest";

export interface SettingsHost {
  settings: ChronoNotesSettings;
  getTranslator(): Translator;
  saveSettings(): Promise<void>;
  openIntervalNoteList(): void;
  getIcsSnapshot(): IcsEventIndexSnapshot | null;
  refreshIcs(showNotice?: boolean): Promise<void>;
  openFirstUseGuide(): void;
  getNoteIndexStatus(): (NoteIndexStatus & Readonly<{ rebuildingCache: boolean }>) | null;
  subscribeNoteIndex(listener: () => void): () => void;
  getNoteIndexCacheStatus(): Promise<NoteIndexCacheStorageStatus>;
  rebuildNoteIndexCache(): Promise<void>;
}

export interface SettingsSectionContext {
  readonly app: App;
  readonly host: SettingsHost;
  readonly translator: Translator;
  readonly vaultPathSuggestionCatalog: VaultPathSuggestionCatalog;
  persistSettings(): Promise<void>;
  scheduleSettingsSave(): void;
  flushSettingsSave(): void;
  flushSettingsSaveOnBlur(inputEl: HTMLInputElement | HTMLTextAreaElement): void;
  display(): void;
}
