import { getLanguage, Notice, Plugin, TFolder } from "obsidian";

import { openObsidianPluginSettings } from "../adapters/obsidian/obsidian-plugin-settings";
import { showObsidianDateContextMenu } from "../adapters/obsidian/obsidian-date-context-menu";
import {
  type LocalDate,
  type PeriodicNoteType,
  PERIODIC_NOTE_TYPES,
} from "../core/periodic/periodic-date";
import { findPeriodicNotePathMatch } from "../core/periodic/periodic-note-path";
import { normalizeIntervalNoteFolder } from "../core/note/interval-note-spec";
import type { NoteTask } from "../core/note/note-tasks";
import { IcsEventIndex, type IcsEventIndexSnapshot } from "../features/calendar/ics-event-index";
import { notifyListeners } from "../features/notify-listeners";
import { resolveNoteCreationConfirmation } from "../features/notes/note-creation-confirmation";
import {
  NoteIndex,
  type NoteIndexDiagnosticsSnapshot,
  type NoteIndexStatus,
} from "../features/notes/note-index";
import type { NoteIndexCacheStorageStatus } from "../features/notes/note-index-cache";
import { getSettingsChangeImpact } from "../features/settings/settings-change-impact";
import type { TaskCommandResult } from "../features/tasks/task-commands";
import { FirstUseGuideGate } from "../features/onboarding/first-use-guide";
import { createTranslator, type Translator } from "../shared/i18n";
import { getCurrentLocalDate } from "../shared/local-date-clock";
import {
  createDefaultSettings,
  isFutureSettingsSchema,
  isSettingsMigrationRequired,
  migrateSettings,
  normalizeSettings,
  type ChronoNotesSettings,
} from "../shared/settings";
import { ChronoNotesSettingTab } from "../ui/settings/settings-tab";
import { ConfirmPeriodicNoteModal } from "../ui/modals/confirm-periodic-note-modal";
import { ConfirmIntervalNoteModal } from "../ui/modals/confirm-interval-note-modal";
import { CreateIntervalNoteModal } from "../ui/modals/create-interval-note-modal";
import { IntervalNoteListModal } from "../ui/modals/interval-note-list-modal";
import { JumpToDateModal } from "../ui/modals/jump-to-date-modal";
import { FirstUseGuideModal } from "../ui/modals/first-use-guide-modal";
import { MiniCalendarModal } from "../ui/modals/mini-calendar-modal";
import {
  CHRONO_NOTES_VIEW_TYPE,
  ChronoNotesView,
} from "../ui/calendar/chrono-notes-view";
import {
  ChronoRuntime,
  createChronoRuntime,
  getPropertyDateDisplaySettings,
  type ChronoRuntimeHost,
} from "./chrono-runtime";
import {
  formatIcsRefreshNotice,
  formatPeriodicNotConfiguredNotice,
  formatPluginErrorNotice,
  getInvalidRangeNotice,
  getPluginCommandMessages,
  getRangeNotConfiguredNotice,
  getTaskCommandNotice,
  type PluginCommandMessages,
} from "./plugin-presentation";

export default class ChronoNotesPlugin extends Plugin {
  settings: ChronoNotesSettings = createDefaultSettings();
  private runtime: ChronoRuntime | null = null;
  private settingsTab: ChronoNotesSettingTab | null = null;
  private noteIndexCacheRebuild: Promise<void> | null = null;
  private readonly noteIndexStatusListeners = new Set<() => void>();
  private readonly settingsListeners = new Set<() => void>();
  private readonly firstUseGuideGate = new FirstUseGuideGate();
  private settingsSaveTail: Promise<void> = Promise.resolve();
  private persistedSettings: ChronoNotesSettings = createDefaultSettings();
  private settingsReadOnly = false;
  private intervalSettingsRevision = 0;
  private runtimeRevision = 0;
  private runtimeActive = false;
  private lastIcsDisplayZone: string | null = null;

  get noteIndex(): NoteIndex | null {
    return this.runtime?.noteIndex ?? null;
  }

  get icsEventIndex(): IcsEventIndex | null {
    return this.runtime?.icsEventIndex ?? null;
  }

  override async onload(): Promise<void> {
    const runtimeRevision = this.beginRuntime();
    try {
      await this.loadSettings();
      if (!this.isRuntimeCurrent(runtimeRevision)) return;

      const runtime = createChronoRuntime(this.createChronoRuntimeHost());
      this.runtime = runtime;

      const commandMessages = getPluginCommandMessages(this.getTranslator().t);
      this.registerCalendarView(commandMessages);
      this.registerPeriodicNoteCommands(commandMessages);
      this.addCommand({
        id: "open-range-note-list",
        name: commandMessages.openRangeList,
        callback: () => this.openIntervalNoteList(),
      });
      this.addCommand({
        id: "open-mini-calendar",
        name: commandMessages.openMiniCalendar,
        callback: () => this.showMiniCalendar(
          this.getMiniCalendarInitialDate(),
          (date) => this.activateCalendarView(date),
        ),
      });
      this.addCommand({
        id: "jump-to-date",
        name: commandMessages.jumpToDate,
        callback: () => this.showJumpToDate(),
      });
      this.settingsTab = new ChronoNotesSettingTab(this.app, this);
      this.addSettingTab(this.settingsTab);
      this.app.workspace.onLayoutReady(() => {
        if (!this.isRuntimeCurrent(runtimeRevision)) return;
        runtime.noteNavbar.update();
        this.syncCalendarSelectionToActiveFile();
        void this.startDeferredIndexes(runtime.noteIndex, runtimeRevision);
        void this.showFirstUseGuideOnce(runtimeRevision);
      });
      this.registerWorkspaceNoteSync(runtimeRevision);
      this.registerIcsDisplayZoneRefresh(runtimeRevision);
    } catch (error) {
      if (this.isRuntimeCurrent(runtimeRevision)) this.endRuntime();
      throw error;
    }
  }

  override onunload(): void {
    this.settingsTab?.flushSettingsSaveOnUnload();
    this.endRuntime();
  }

  async loadSettings(): Promise<void> {
    const loaded: unknown = await this.loadData();
    this.settingsReadOnly = isFutureSettingsSchema(loaded);
    const migrationRequired = isSettingsMigrationRequired(loaded);
    const migrated = migrateSettings(loaded);
    this.settings = normalizeSettings(migrated);
    this.persistedSettings = normalizeSettings(this.settings);
    if (!migrationRequired) return;
    try {
      await this.saveData(this.persistedSettings);
    } catch (error) {
      console.error("Chrono Notes: failed to persist migrated settings", error);
    }
  }

  async saveSettings(): Promise<void> {
    if (this.settingsReadOnly) {
      throw new Error(
        "Chrono Notes settings were created by a newer plugin version and are read-only.",
      );
    }
    const runtimeRevision = this.runtimeRevision;
    const snapshot = normalizeSettings(this.settings);
    const save = this.settingsSaveTail.then(async () => {
      await this.saveData(snapshot);
      const impact = getSettingsChangeImpact(this.persistedSettings, snapshot);
      this.persistedSettings = snapshot;
      if (!this.isRuntimeCurrent(runtimeRevision) || !impact.changed) return;

      if (impact.propertiesDateDisplay) {
        this.runtime?.propertiesDateDisplay.setSettings(getPropertyDateDisplaySettings(
          snapshot,
          createTranslator(snapshot.locale, getLanguage()).locale,
        ));
      }

      if (impact.calendar) {
        const viewRefreshListeners: Array<() => void> = [];
        for (const leaf of this.app.workspace.getLeavesOfType(CHRONO_NOTES_VIEW_TYPE)) {
          const { view } = leaf;
          if (view instanceof ChronoNotesView) {
            viewRefreshListeners.push(() => view.refresh());
          }
        }
        notifyListeners(viewRefreshListeners);
      }
      if (impact.intervalList) {
        this.intervalSettingsRevision += 1;
        notifyListeners(this.settingsListeners);
      }
      if (impact.navbar) notifyListeners([() => this.runtime?.noteNavbar.update()]);
      if (impact.ics) void this.refreshIcs(false, snapshot);
    });
    this.settingsSaveTail = save.catch(() => undefined);
    await save;
  }

  private registerWorkspaceNoteSync(runtimeRevision: number): void {
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => {
      if (!this.isRuntimeCurrent(runtimeRevision)) return;
      this.runtime?.noteNavbar.update();
      this.syncCalendarSelectionToActiveFile();
    }));
    this.registerEvent(this.app.workspace.on("layout-change", () => {
      if (this.isRuntimeCurrent(runtimeRevision)) this.runtime?.noteNavbar.update();
    }));
    this.registerEvent(this.app.workspace.on("file-open", (file) => {
      if (!this.isRuntimeCurrent(runtimeRevision)) return;
      this.runtime?.noteNavbar.update();
      this.syncCalendarSelectionToPath(file?.path);
    }));
    this.registerEvent(this.app.vault.on("rename", () => {
      if (this.isRuntimeCurrent(runtimeRevision)) this.runtime?.noteNavbar.handleFileRename();
    }));
  }

  private createChronoRuntimeHost(): ChronoRuntimeHost {
    return {
      app: this.app,
      vault: this.app.vault,
      workspace: this.app.workspace,
      getSettings: () => this.settings,
      getTranslator: () => this.getTranslator(),
      openPeriodicNote: (date, noteType, target) =>
        this.openPeriodicNote(date, noteType, target),
      activateCalendarView: (date) => this.activateCalendarView(date),
      openIndexedNote: (path, target) => this.openIndexedNote(path, target),
      showMiniCalendar: (initialDate, onSelect) =>
        this.showMiniCalendar(initialDate, onSelect),
      showCreateIntervalNote: (initialDate, initialEndDate, onSettled) =>
        this.showCreateIntervalNote(initialDate, initialEndDate, onSettled),
      toggleTask: (task) => this.toggleTask(task),
      rescheduleTask: (task, nextDueDate) => this.rescheduleTask(task, nextDueDate),
      openTaskSource: (task, target) => this.openTaskSource(task, target),
      saveSettings: () => this.saveSettings(),
      setRelatedIntervalNotesCollapsed: async (collapsed) => {
        this.settings.relatedIntervalNotesCollapsed = collapsed;
        await this.saveSettings();
      },
      registerEvent: (eventRef) => this.registerEvent(eventRef),
    };
  }

  private registerPeriodicNoteCommands(messages: PluginCommandMessages): void {
    for (const noteType of PERIODIC_NOTE_TYPES) {
      this.addCommand({
        id: `open-${noteType}-note`,
        name: messages.openPeriodic(noteType),
        callback: () => {
          void this.openCurrentPeriodicNote(noteType);
        },
      });
    }
  }

  private registerCalendarView(messages: PluginCommandMessages): void {
    const noteIndex = this.noteIndex;
    const icsEventIndex = this.icsEventIndex;
    if (noteIndex === null || icsEventIndex === null) return;
    this.registerView(
      CHRONO_NOTES_VIEW_TYPE,
      (leaf) => {
        const view = new ChronoNotesView(leaf, {
          noteIndex,
          icsEventIndex,
          getSettings: () => this.settings,
          getTranslator: () => this.getTranslator(),
          openPeriodic: (date, noteType, target) =>
            this.openPeriodicNote(date, noteType, target),
          setYearHeatmap: async (enabled) => {
            this.settings.yearViewHeatmap = enabled;
            await this.saveSettings();
          },
          setStatisticDimension: async (dimension) => {
            this.settings.statisticDisplayDimension = dimension;
            await this.saveSettings();
          },
          openPath: (path, target) => this.openIndexedNote(path, target),
          createRange: (initialDate, initialEndDate) =>
            this.showCreateIntervalNote(initialDate, initialEndDate),
          toggleTask: (task) => this.toggleTask(task),
          rescheduleTask: (task, nextDueDate) => this.rescheduleTask(task, nextDueDate),
          openTaskSource: (task, target) => this.openTaskSource(task, target),
          openDateContextMenu: (date, configured, noteExists, event) => {
            showObsidianDateContextMenu({
              date,
              configured,
              noteExists,
              rangeConfigured:
                normalizeIntervalNoteFolder(this.settings.rangeNotes.folder).length > 0,
              translator: this.getTranslator(),
              event,
              onOpenDaily: (target) => this.openPeriodicNote(date, "daily", target),
              onCreateRange: () => {
                this.showCreateIntervalNote(date);
              },
            });
          },
        });
        const activeNote = this.getActivePeriodicNoteMatch();
        if (activeNote !== null) {
          view.syncToPeriodicNote(activeNote.date, activeNote.noteType);
        }
        return view;
      },
    );
    this.addRibbonIcon("calendar-days", messages.ribbonCalendar, () => {
      void this.activateCalendarView();
    });
    this.addCommand({
      id: "open-calendar",
      name: messages.openCalendar,
      callback: () => {
        void this.activateCalendarView();
      },
    });
  }

  private async activateCalendarView(date?: LocalDate): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(CHRONO_NOTES_VIEW_TYPE)[0];
    const leaf = existing ?? this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getLeaf("tab");
    if (existing === undefined) {
      await leaf.setViewState({ type: CHRONO_NOTES_VIEW_TYPE, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
    if (date !== undefined && leaf.view instanceof ChronoNotesView) {
      leaf.view.jumpToDate(date);
    }
  }

  private async openCurrentPeriodicNote(noteType: PeriodicNoteType): Promise<void> {
    await this.openPeriodicNote(getCurrentLocalDate(), noteType, "default");
  }

  private async openPeriodicNote(
    date: LocalDate,
    noteType: PeriodicNoteType,
    target: "default" | "tab",
  ): Promise<void> {
    const runtime = this.runtime;
    if (runtime === null) return;
    try {
      const result = await runtime.periodicNoteCommands.openOrCreate(
        {
          date,
          noteType,
          target,
          cascade: this.settings.cascadeLargerNotes,
          ...(this.settings.confirmPeriodicNoteCreation
            ? {
                confirmCreate: ({ path }) =>
                  resolveNoteCreationConfirmation(
                    () => new ConfirmPeriodicNoteModal(
                      this.app,
                      path,
                      this.getTranslator(),
                    ).confirm(),
                    async () => {
                      this.settings.confirmPeriodicNoteCreation = false;
                      await this.saveSettings();
                    },
                  ),
              }
            : {}),
        },
        {
          locale: this.getTranslator().locale,
          weekStartDay: this.settings.weekStartDay,
          periodicNotes: this.settings.periodicNotes,
          templateEngine: this.settings.templateEngine,
        },
      );
      if (result.status === "not-configured") {
        new Notice(formatPeriodicNotConfiguredNotice(noteType, this.getTranslator().t));
      } else if (result.status === "opened") {
        for (const item of result.cascade) {
          if (item.status === "failed") {
            console.error(`Chrono Notes: failed to create ${item.noteType} note`, item.error);
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(formatPluginErrorNotice(message, this.getTranslator().t));
    }
  }

  private async openIntervalNote(start: LocalDate, end: LocalDate): Promise<void> {
    const runtime = this.runtime;
    if (runtime === null) return;
    try {
      const result = await runtime.intervalNoteCommands.openOrCreate(
        {
          start,
          end,
          folder: this.settings.rangeNotes.folder,
          ...(this.settings.confirmIntervalNoteCreation
            ? {
                confirmCreate: (spec) => resolveNoteCreationConfirmation(
                  () => new ConfirmIntervalNoteModal(
                    this.app,
                    spec,
                    this.getTranslator(),
                  ).confirm(),
                  async () => {
                    this.settings.confirmIntervalNoteCreation = false;
                    await this.saveSettings();
                  },
                ),
              }
            : {}),
        },
        {
          locale: this.getTranslator().locale,
          templateEngine: this.settings.templateEngine,
          templatePath: this.settings.rangeNotes.templatePath,
        },
      );
      if (result.status === "not-configured") {
        new Notice(getRangeNotConfiguredNotice(this.getTranslator().t));
      } else if (result.status === "invalid-range") {
        new Notice(getInvalidRangeNotice(this.getTranslator().t));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(formatPluginErrorNotice(message, this.getTranslator().t));
    }
  }

  private async openIndexedNote(path: string, target: "default" | "tab"): Promise<void> {
    const runtime = this.runtime;
    if (runtime === null) return;
    try {
      await runtime.noteWorkspace.open(path, target);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(formatPluginErrorNotice(message, this.getTranslator().t));
    }
  }

  private async toggleTask(task: NoteTask): Promise<void> {
    const runtime = this.runtime;
    if (runtime === null) return;
    try {
      this.showTaskCommandResult(await runtime.taskCommands.toggle(task));
    } catch (error) {
      this.showTaskCommandError(error);
    }
  }

  private async rescheduleTask(task: NoteTask, nextDueDate: LocalDate): Promise<void> {
    const runtime = this.runtime;
    if (runtime === null) return;
    try {
      this.showTaskCommandResult(await runtime.taskCommands.rescheduleDue(task, nextDueDate));
    } catch (error) {
      this.showTaskCommandError(error);
    }
  }

  private async openTaskSource(task: NoteTask, target: "default" | "tab"): Promise<void> {
    const runtime = this.runtime;
    if (runtime === null) return;
    try {
      await runtime.taskCommands.openSource(task, target);
    } catch (error) {
      this.showTaskCommandError(error);
    }
  }

  private showTaskCommandResult(result: TaskCommandResult): void {
    const message = getTaskCommandNotice(result.status, this.getTranslator().t);
    if (message !== null) new Notice(formatPluginErrorNotice(message, this.getTranslator().t));
  }

  private showTaskCommandError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    new Notice(formatPluginErrorNotice(message, this.getTranslator().t));
  }

  openIntervalNoteList(): void {
    const runtime = this.runtime;
    if (runtime === null) return;
    new IntervalNoteListModal(
      this.app,
      {
        noteIndex: runtime.noteIndex,
        getSettings: () => this.settings,
        getSettingsRevision: () => this.intervalSettingsRevision,
        subscribeSettings: (listener) => {
          this.settingsListeners.add(listener);
          return () => this.settingsListeners.delete(listener);
        },
        openPath: (path, target) => this.openIndexedNote(path, target),
        createRange: (initialDate) => this.showCreateIntervalNote(
          initialDate,
          undefined,
          () => this.openIntervalNoteList(),
        ),
        folderExists: (path) =>
          this.app.vault.getAbstractFileByPath(path) instanceof TFolder,
        openRangeSettings: () => {
          openObsidianPluginSettings(this.app, this.manifest.id);
        },
      },
      this.getTranslator(),
    ).open();
  }

  openFirstUseGuide(onShown?: () => void): void {
    new FirstUseGuideModal(
      this.app,
      this.getTranslator(),
      () => {
        openObsidianPluginSettings(this.app, this.manifest.id);
      },
      onShown,
    ).open();
  }

  getIcsSnapshot(): IcsEventIndexSnapshot | null {
    return this.icsEventIndex?.getSnapshot() ?? null;
  }

  getNoteIndexStatus(): (NoteIndexStatus & Readonly<{ rebuildingCache: boolean }>) | null {
    const status = this.noteIndex?.getStatus();
    return status === undefined
      ? null
      : Object.freeze({
        ...status,
        rebuildingCache: this.noteIndexCacheRebuild !== null,
      });
  }

  subscribeNoteIndex(listener: () => void): () => void {
    const unsubscribeIndex = this.noteIndex?.subscribe(listener) ?? (() => undefined);
    this.noteIndexStatusListeners.add(listener);
    return () => {
      unsubscribeIndex();
      this.noteIndexStatusListeners.delete(listener);
    };
  }

  getNoteIndexDiagnostics(): NoteIndexDiagnosticsSnapshot | null {
    return this.noteIndex?.getDiagnostics() ?? null;
  }

  subscribeNoteIndexDiagnostics(listener: () => void): () => void {
    return this.noteIndex?.subscribeDiagnostics(listener) ?? (() => undefined);
  }

  async getNoteIndexCacheStatus(): Promise<NoteIndexCacheStorageStatus> {
    return this.runtime?.noteIndexCache.getStatus()
      ?? Object.freeze({ state: "unavailable" });
  }

  async rebuildNoteIndexCache(): Promise<void> {
    if (this.noteIndexCacheRebuild !== null) {
      await this.noteIndexCacheRebuild;
      return;
    }
    const noteIndex = this.noteIndex;
    if (noteIndex === null || !noteIndex.getStatus().active) {
      throw new Error("NoteIndex is not active");
    }
    const runtimeRevision = this.runtimeRevision;
    const rebuild = Promise.resolve().then(() =>
      this.performNoteIndexCacheRebuild(noteIndex, runtimeRevision));
    this.noteIndexCacheRebuild = rebuild;
    notifyListeners(this.noteIndexStatusListeners);
    try {
      await rebuild;
    } finally {
      if (this.noteIndexCacheRebuild === rebuild) {
        this.noteIndexCacheRebuild = null;
        notifyListeners(this.noteIndexStatusListeners);
      }
    }
  }

  async refreshIcs(
    showNotice = true,
    settings: Readonly<ChronoNotesSettings> = this.settings,
  ): Promise<void> {
    const runtimeRevision = this.runtimeRevision;
    await this.refreshIcsForDisplayZone(
      showNotice,
      settings,
      getLocalTimeZone(),
      runtimeRevision,
    );
  }

  private async refreshIcsForDisplayZone(
    showNotice: boolean,
    settings: Readonly<ChronoNotesSettings>,
    displayZone: string,
    runtimeRevision: number,
  ): Promise<void> {
    if (!this.isRuntimeCurrent(runtimeRevision)) return;
    const index = this.icsEventIndex;
    if (index === null) return;
    this.lastIcsDisplayZone = displayZone;
    try {
      await index.refresh({
        enabled: settings.ics.enabled,
        sources: settings.ics.sources,
        displayZone,
      });
      if (!this.isRuntimeCurrent(runtimeRevision) || this.icsEventIndex !== index) return;
      if (showNotice) new Notice(formatIcsRefreshNotice(index.getSnapshot(), this.getTranslator().t));
    } catch (error) {
      if (!this.isRuntimeCurrent(runtimeRevision) || this.icsEventIndex !== index) return;
      const message = error instanceof Error ? error.message : String(error);
      console.error("Chrono Notes: ICS refresh failed", error);
      if (showNotice) new Notice(formatPluginErrorNotice(message, this.getTranslator().t));
    }
  }

  private registerIcsDisplayZoneRefresh(runtimeRevision: number): void {
    this.registerDomEvent(document, "visibilitychange", () => {
      if (document.visibilityState !== "visible" || !this.isRuntimeCurrent(runtimeRevision)) {
        return;
      }
      const displayZone = getLocalTimeZone();
      if (displayZone === this.lastIcsDisplayZone) return;
      void this.refreshIcsForDisplayZone(
        false,
        this.settings,
        displayZone,
        runtimeRevision,
      );
    });
  }

  private async startDeferredIndexes(
    noteIndex: NoteIndex,
    runtimeRevision: number,
  ): Promise<void> {
    try {
      await Promise.all([
        noteIndex.start(),
        this.refreshIcs(false),
      ]);
    } catch (error) {
      if (!this.isRuntimeCurrent(runtimeRevision) || this.noteIndex !== noteIndex) return;
      const message = error instanceof Error ? error.message : String(error);
      console.error("Chrono Notes: deferred indexing failed", error);
      new Notice(formatPluginErrorNotice(message, this.getTranslator().t));
    }
  }

  private async performNoteIndexCacheRebuild(
    noteIndex: NoteIndex,
    runtimeRevision: number,
  ): Promise<void> {
    noteIndex.stop();
    let cacheError: Error | null = null;
    try {
      await noteIndex.clearCacheWhileStopped();
    } catch (error) {
      cacheError = error instanceof Error
        ? error
        : new Error("Failed to clear NoteIndex cache", { cause: error });
    }
    if (!this.isRuntimeCurrent(runtimeRevision) || this.noteIndex !== noteIndex) {
      if (cacheError !== null) throw cacheError;
      return;
    }
    try {
      await noteIndex.start();
    } catch (error) {
      if (!this.isRuntimeCurrent(runtimeRevision) || this.noteIndex !== noteIndex) {
        throw error;
      }
      try {
        await noteIndex.start();
      } catch (recoveryError) {
        if (cacheError !== null) {
          console.error("Chrono Notes: failed to clear NoteIndex cache", cacheError);
        }
        console.error(
          "Chrono Notes: initial NoteIndex cache rebuild start failed",
          error,
        );
        throw recoveryError;
      }
      console.error(
        "Chrono Notes: recovered a failed NoteIndex cache rebuild start",
        error,
      );
    }
    if (cacheError !== null) throw cacheError;
    await noteIndex.persistCacheNow();
  }

  private showCreateIntervalNote(
    initialDate: LocalDate,
    initialEndDate?: LocalDate,
    onSettled?: () => void,
  ): void {
    new CreateIntervalNoteModal(
      this.app,
      initialDate,
      this.getTranslator(),
      (start, end) => {
        void this.openIntervalNote(start, end).finally(onSettled);
      },
      onSettled,
      initialEndDate,
    ).open();
  }

  private showMiniCalendar(
    initialDate: LocalDate,
    onSelect: (date: LocalDate) => void | Promise<void>,
  ): void {
    new MiniCalendarModal(this.app, {
      initialDate,
      today: getCurrentLocalDate(),
      weekStartDay: this.settings.weekStartDay,
      translator: this.getTranslator(),
      onSelect,
    }).open();
  }

  private showJumpToDate(): void {
    new JumpToDateModal(
      this.app,
      getCurrentLocalDate(),
      this.getTranslator(),
      (date) => this.activateCalendarView(date),
    ).open();
  }

  private async showFirstUseGuideOnce(runtimeRevision: number): Promise<void> {
    if (!this.firstUseGuideGate.trySchedule(this.settings.firstUseGuideSeen)) return;
    if (!this.isRuntimeCurrent(runtimeRevision)) return;
    this.registerInterval(window.setTimeout(() => {
      if (!this.isRuntimeCurrent(runtimeRevision)) return;
      this.openFirstUseGuide(() => {
        if (!this.isRuntimeCurrent(runtimeRevision) || this.settings.firstUseGuideSeen) return;
        this.settings.firstUseGuideSeen = true;
        void this.saveSettings().catch((error: unknown) => {
          this.settings.firstUseGuideSeen = false;
          console.error("Chrono Notes: failed to persist first-use guide state", error);
        });
      });
    }, 0));
  }

  private beginRuntime(): number {
    this.runtimeRevision += 1;
    this.runtimeActive = true;
    return this.runtimeRevision;
  }

  private endRuntime(): void {
    if (this.runtimeActive) {
      this.runtimeActive = false;
      this.runtimeRevision += 1;
    }
    const runtime = this.runtime;
    this.runtime = null;
    runtime?.dispose();
    this.settingsTab = null;
    this.noteIndexCacheRebuild = null;
    this.noteIndexStatusListeners.clear();
    this.settingsListeners.clear();
    this.lastIcsDisplayZone = null;
  }

  private isRuntimeCurrent(runtimeRevision: number): boolean {
    return this.runtimeActive && this.runtimeRevision === runtimeRevision;
  }

  private getMiniCalendarInitialDate(): LocalDate {
    return this.getActivePeriodicNoteMatch()?.date ?? getCurrentLocalDate();
  }

  private getActivePeriodicNoteMatch(): ReturnType<
    typeof findPeriodicNotePathMatch
  > {
    return this.getPeriodicNoteMatch(this.app.workspace.getActiveFile()?.path);
  }

  private getPeriodicNoteMatch(path: string | undefined): ReturnType<
    typeof findPeriodicNotePathMatch
  > {
    if (path === undefined) return null;
    return findPeriodicNotePathMatch(
      path,
      PERIODIC_NOTE_TYPES
        .filter((noteType) => this.settings.periodicNotes[noteType].enabled)
        .map((noteType) => ({
          noteType,
          pattern: this.settings.periodicNotes[noteType].pattern,
        })),
      {
        locale: this.getTranslator().locale,
        weekStartDay: this.settings.weekStartDay,
      },
    );
  }

  private syncCalendarSelectionToActiveFile(): void {
    this.syncCalendarSelectionToPath(this.app.workspace.getActiveFile()?.path);
  }

  private syncCalendarSelectionToPath(path: string | undefined): void {
    const match = this.getPeriodicNoteMatch(path);
    if (match === null) return;
    for (const leaf of this.app.workspace.getLeavesOfType(CHRONO_NOTES_VIEW_TYPE)) {
      if (leaf.view instanceof ChronoNotesView) {
        leaf.view.syncToPeriodicNote(match.date, match.noteType);
      }
    }
  }

  getTranslator(): Translator {
    return createTranslator(this.settings.locale, getLanguage());
  }

  isSettingsReadOnly(): boolean {
    return this.settingsReadOnly;
  }
}

function getLocalTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
