import type {
  App,
  EventRef,
  Vault,
  Workspace,
} from "obsidian";

import { ObsidianIcsSourceReader } from "../adapters/obsidian/obsidian-ics-source-reader";
import { ObsidianNoteIndexCache } from "../adapters/obsidian/obsidian-note-index-cache";
import { ObsidianNoteSource } from "../adapters/obsidian/obsidian-note-source";
import { ObsidianPropertiesDateInterceptor } from "../adapters/obsidian/obsidian-properties-date-interceptor";
import { ObsidianPropertiesDateDocuments } from "../adapters/obsidian/obsidian-properties-date-documents";
import { ObsidianPropertiesDateDisplay } from "../adapters/obsidian/obsidian-properties-date-display";
import { OBSIDIAN_PROPERTY_DATE_VALUE_FORMATTER } from "../adapters/obsidian/obsidian-property-date-value-formatter";
import {
  ObsidianIntervalNoteFilePort,
  ObsidianPeriodicNoteFilePort,
  ObsidianNoteTemplatePort,
  ObsidianPeriodicNoteWorkspacePort,
  ObsidianTaskFilePort,
  ObsidianTaskWorkspacePort,
} from "../adapters/obsidian/obsidian-periodic-note-ports";
import type { LocalDate, PeriodicNoteType } from "../core/periodic/periodic-date";
import type { NoteTask } from "../core/note/note-tasks";
import { IcsEventIndex } from "../features/calendar/ics-event-index";
import { IntervalNoteCommands } from "../features/intervals/interval-note-commands";
import { NoteIndex } from "../features/notes/note-index";
import { PeriodicNoteCommands } from "../features/periodic/periodic-note-commands";
import { TaskCommands } from "../features/tasks/task-commands";
import type { Translator } from "../shared/i18n";
import type { ChronoNotesSettings } from "../shared/settings";
import { NoteNavbarManager } from "../ui/note-navbar/note-navbar";

export interface ChronoRuntimeHost {
  readonly app: App;
  readonly vault: Vault;
  readonly workspace: Workspace;
  getSettings(): Readonly<ChronoNotesSettings>;
  getTranslator(): Translator;
  openPeriodicNote(
    date: LocalDate,
    noteType: PeriodicNoteType,
    target: "default" | "tab",
  ): Promise<void>;
  activateCalendarView(date?: LocalDate): Promise<void>;
  openIndexedNote(path: string, target: "default" | "tab"): Promise<void>;
  showMiniCalendar(
    initialDate: LocalDate,
    onSelect: (date: LocalDate) => void | Promise<void>,
  ): void;
  showCreateIntervalNote(
    initialDate: LocalDate,
    initialEndDate?: LocalDate,
    onSettled?: () => void,
  ): void;
  toggleTask(task: NoteTask): Promise<void>;
  rescheduleTask(task: NoteTask, nextDueDate: LocalDate): Promise<void>;
  openTaskSource(task: NoteTask, target: "default" | "tab"): Promise<void>;
  saveSettings(): Promise<void>;
  setRelatedIntervalNotesCollapsed(collapsed: boolean): Promise<void>;
  registerEvent(eventRef: EventRef): void;
}

export interface ChronoRuntime {
  readonly noteIndex: NoteIndex;
  readonly icsEventIndex: IcsEventIndex;
  readonly periodicNoteCommands: PeriodicNoteCommands;
  readonly intervalNoteCommands: IntervalNoteCommands;
  readonly taskCommands: TaskCommands;
  readonly noteWorkspace: ObsidianPeriodicNoteWorkspacePort;
  readonly noteNavbar: NoteNavbarManager;
  readonly propertiesDateDisplay: ObsidianPropertiesDateDisplay;
  readonly noteIndexCache: ObsidianNoteIndexCache;
  dispose(): void;
}

export function createChronoRuntime(host: ChronoRuntimeHost): ChronoRuntime {
  const disposers: Array<() => void> = [];
  const registerDisposer = (dispose: () => void): void => {
    let disposed = false;
    disposers.push(() => {
      if (disposed) return;
      disposed = true;
      try {
        dispose();
      } catch (error) {
        console.error("Chrono Notes: runtime cleanup failed", error);
      }
    });
  };
  try {
    const settings = host.getSettings();
    const translator = host.getTranslator();
    const noteIndexCache = new ObsidianNoteIndexCache(host.vault);
    const noteIndex = new NoteIndex(new ObsidianNoteSource(host.vault), {
      cache: noteIndexCache,
    });
    registerDisposer(() => noteIndex.stop());

    const icsEventIndex = new IcsEventIndex(new ObsidianIcsSourceReader(host.vault));
    registerDisposer(() => icsEventIndex.stop());
    const noteWorkspace = new ObsidianPeriodicNoteWorkspacePort(
      host.vault,
      host.workspace,
    );
    const noteTemplates = new ObsidianNoteTemplatePort(host.app, host.vault);
    const periodicNoteCommands = new PeriodicNoteCommands(
      new ObsidianPeriodicNoteFilePort(host.vault, host.workspace),
      noteTemplates,
      noteWorkspace,
    );
    const propertiesDateInterceptor = new ObsidianPropertiesDateInterceptor({
      getEnabled: () => host.getSettings().interceptPropertyDateClicks,
      isDailyConfigured: () => {
        const daily = host.getSettings().periodicNotes.daily;
        return daily.enabled && daily.pattern.trim().length > 0;
      },
      openDaily: (date, target) => host.openPeriodicNote(date, "daily", target),
    });
    const propertiesDateDisplay = new ObsidianPropertiesDateDisplay(
      getPropertyDateDisplaySettings(settings, translator.locale),
      OBSIDIAN_PROPERTY_DATE_VALUE_FORMATTER,
    );
    const propertiesDateDocuments = new ObsidianPropertiesDateDocuments(
      propertiesDateDisplay,
      propertiesDateInterceptor,
    );
    registerDisposer(() => propertiesDateDocuments.dispose());
    propertiesDateDocuments.addDocument(document);
    host.workspace.iterateAllLeaves((leaf) => {
      propertiesDateDocuments.addDocument(leaf.view.containerEl.ownerDocument);
    });
    host.registerEvent(host.workspace.on("css-change", () => {
      propertiesDateDisplay.refreshAll();
    }));
    host.registerEvent(host.workspace.on("window-open", (_workspaceWindow, openedWindow) => {
      propertiesDateDocuments.addDocument(openedWindow.document);
    }));
    host.registerEvent(host.workspace.on("window-close", (_workspaceWindow, closedWindow) => {
      propertiesDateDocuments.removeDocument(closedWindow.document);
    }));
    const intervalNoteCommands = new IntervalNoteCommands(
      new ObsidianIntervalNoteFilePort(host.vault, host.workspace),
      noteTemplates,
      noteWorkspace,
    );
    const taskCommands = new TaskCommands(
      new ObsidianTaskFilePort(host.vault, host.workspace),
      new ObsidianTaskWorkspacePort(host.vault, host.workspace),
    );
    const noteNavbar = new NoteNavbarManager(host.app, {
      noteIndex,
      getSettings: () => host.getSettings(),
      getTranslator: () => host.getTranslator(),
      openPeriodic: (date, noteType, target) => host.openPeriodicNote(date, noteType, target),
      openCalendar: () => host.activateCalendarView(),
      openPath: (path, target) => host.openIndexedNote(path, target),
      setRelatedCollapsed: (collapsed) => host.setRelatedIntervalNotesCollapsed(collapsed),
      pickDate: (initialDate, onSelect) => host.showMiniCalendar(initialDate, onSelect),
    });
    registerDisposer(() => noteNavbar.unmount());

    return Object.freeze({
      noteIndex,
      icsEventIndex,
      periodicNoteCommands,
      intervalNoteCommands,
      taskCommands,
      noteWorkspace,
      noteNavbar,
      propertiesDateDisplay,
      noteIndexCache,
      dispose: () => {
        for (const dispose of [...disposers].reverse()) dispose();
        disposers.length = 0;
      },
    });
  } catch (error) {
    for (const dispose of [...disposers].reverse()) dispose();
    disposers.length = 0;
    throw error;
  }
}

export function getPropertyDateDisplaySettings(
  settings: Readonly<ChronoNotesSettings>,
  locale: string,
) {
  return {
    locale,
    dateFormat: settings.propertyDateDisplayFormat,
    timeFormat: settings.propertyTimeDisplayFormat,
    dateCustomFormat: settings.propertyDateCustomFormat,
    timeCustomFormat: settings.propertyTimeCustomFormat,
  } as const;
}
