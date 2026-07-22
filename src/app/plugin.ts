import { Notice, Plugin, TFolder } from "obsidian";

import { ObsidianIcsSourceReader } from "../adapters/obsidian/obsidian-ics-source-reader";
import { ObsidianNoteSource } from "../adapters/obsidian/obsidian-note-source";
import { ObsidianPropertiesDateInterceptor } from "../adapters/obsidian/obsidian-properties-date-interceptor";
import { openObsidianPluginSettings } from "../adapters/obsidian/obsidian-plugin-settings";
import { showObsidianDateContextMenu } from "../adapters/obsidian/obsidian-date-context-menu";
import {
  ObsidianIntervalNoteFilePort,
  ObsidianPeriodicNoteFilePort,
  ObsidianPeriodicNoteTemplatePort,
  ObsidianPeriodicNoteWorkspacePort,
  ObsidianTaskFilePort,
  ObsidianTaskWorkspacePort,
} from "../adapters/obsidian/obsidian-periodic-note-ports";
import {
  PERIODIC_NOTE_TYPES,
  type LocalDate,
  type PeriodicNoteType,
} from "../core/periodic/periodic-date";
import { findPeriodicNotePathMatch } from "../core/periodic/periodic-note-path";
import { normalizeIntervalNoteFolder } from "../core/note/interval-note-spec";
import type { NoteTask } from "../core/note/note-tasks";
import { IcsEventIndex, type IcsEventIndexSnapshot } from "../features/calendar/ics-event-index";
import { isPeriodicNotePathIndexing } from "../features/calendar/indexed-periodic-note";
import { IntervalNoteCommands } from "../features/intervals/interval-note-commands";
import { notifyListeners } from "../features/notify-listeners";
import { resolveNoteCreationConfirmation } from "../features/notes/note-creation-confirmation";
import { NoteIndex } from "../features/notes/note-index";
import { PeriodicNoteCommands } from "../features/periodic/periodic-note-commands";
import { getSettingsChangeImpact } from "../features/settings/settings-change-impact";
import { TaskCommands, type TaskCommandResult } from "../features/tasks/task-commands";
import { FirstUseGuideGate } from "../features/onboarding/first-use-guide";
import { createTranslator, type Translator } from "../shared/i18n";
import { getCurrentLocalDate } from "../shared/local-date-clock";
import {
  createDefaultSettings,
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
import { NoteNavbarManager } from "../ui/note-navbar/note-navbar";
import {
  formatIcsRefreshNotice,
  formatPeriodicNotConfiguredNotice,
  formatPluginErrorNotice,
  getInvalidRangeNotice,
  getNoteIndexingNotice,
  getPluginCommandMessages,
  getRangeNotConfiguredNotice,
  getTaskCommandNotice,
  type PluginCommandMessages,
} from "./plugin-presentation";

export default class ChronoNotesPlugin extends Plugin {
  settings: ChronoNotesSettings = createDefaultSettings();
  noteIndex: NoteIndex | null = null;
  icsEventIndex: IcsEventIndex | null = null;
  periodicNoteCommands: PeriodicNoteCommands | null = null;
  intervalNoteCommands: IntervalNoteCommands | null = null;
  taskCommands: TaskCommands | null = null;
  noteWorkspace: ObsidianPeriodicNoteWorkspacePort | null = null;
  private noteNavbar: NoteNavbarManager | null = null;
  private settingsTab: ChronoNotesSettingTab | null = null;
  private readonly settingsListeners = new Set<() => void>();
  private readonly firstUseGuideGate = new FirstUseGuideGate();
  private settingsSaveTail: Promise<void> = Promise.resolve();
  private persistedSettings: ChronoNotesSettings = createDefaultSettings();
  private intervalSettingsRevision = 0;
  private runtimeRevision = 0;
  private runtimeActive = false;
  private lastIcsDisplayZone: string | null = null;
  private readonly runtimeDisposers = new Set<() => void>();

  override async onload(): Promise<void> {
    const runtimeRevision = this.beginRuntime();
    try {
      await this.loadSettings();
      if (!this.isRuntimeCurrent(runtimeRevision)) return;

      const commandMessages = getPluginCommandMessages(this.getTranslator().t);
      const noteIndex = new NoteIndex(new ObsidianNoteSource(this.app.vault));
      this.noteIndex = noteIndex;
      this.registerRuntimeDisposer(() => noteIndex.stop());

      const icsEventIndex = new IcsEventIndex(new ObsidianIcsSourceReader(this.app.vault));
      this.icsEventIndex = icsEventIndex;
      this.registerRuntimeDisposer(() => icsEventIndex.stop());
      this.noteWorkspace = new ObsidianPeriodicNoteWorkspacePort(
        this.app.vault,
        this.app.workspace,
      );
      this.periodicNoteCommands = new PeriodicNoteCommands(
        new ObsidianPeriodicNoteFilePort(this.app.vault, this.app.fileManager),
        new ObsidianPeriodicNoteTemplatePort(this.app, this.app.vault),
        this.noteWorkspace,
      );
      const propertiesDateInterceptor = new ObsidianPropertiesDateInterceptor({
        getEnabled: () => this.settings.interceptPropertyDateClicks,
        isDailyConfigured: () => {
          const daily = this.settings.periodicNotes.daily;
          return daily.enabled && daily.pattern.trim().length > 0;
        },
        openDaily: (date, target) => this.openPeriodicNote(date, "daily", target),
      });
      this.registerDomEvent(
        window,
        "click",
        (event) => propertiesDateInterceptor.handleClick(event),
        { capture: true },
      );
      this.intervalNoteCommands = new IntervalNoteCommands(
        new ObsidianIntervalNoteFilePort(this.app.vault),
        this.noteWorkspace,
      );
      this.taskCommands = new TaskCommands(
        new ObsidianTaskFilePort(this.app.vault),
        new ObsidianTaskWorkspacePort(this.app.vault, this.app.workspace),
      );
      const noteNavbar = new NoteNavbarManager(this.app, {
        noteIndex,
        getSettings: () => this.settings,
        openPeriodic: (date, noteType, target) => this.openPeriodicNote(date, noteType, target),
        openCalendar: () => this.activateCalendarView(),
        openPath: (path, target) => this.openIndexedNote(path, target),
        setRelatedCollapsed: async (collapsed) => {
          this.settings.relatedIntervalNotesCollapsed = collapsed;
          await this.saveSettings();
        },
        pickDate: (initialDate, onSelect) => this.showMiniCalendar(initialDate, onSelect),
      });
      this.noteNavbar = noteNavbar;
      this.registerRuntimeDisposer(() => noteNavbar.unmount());
      this.registerEvent(this.app.workspace.on("active-leaf-change", () => {
        if (this.isRuntimeCurrent(runtimeRevision)) noteNavbar.update();
      }));
      this.registerEvent(this.app.workspace.on("layout-change", () => {
        if (this.isRuntimeCurrent(runtimeRevision)) noteNavbar.update();
      }));
      this.registerEvent(this.app.workspace.on("file-open", () => {
        if (this.isRuntimeCurrent(runtimeRevision)) noteNavbar.update();
      }));
      this.registerEvent(this.app.vault.on("rename", () => {
        if (this.isRuntimeCurrent(runtimeRevision)) noteNavbar.handleFileRename();
      }));
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
        noteNavbar.update();
        void this.startDeferredIndexes(noteIndex, runtimeRevision);
        void this.showFirstUseGuideOnce(runtimeRevision);
      });
      this.registerIcsDisplayZoneRefresh(runtimeRevision);
    } catch (error) {
      if (this.isRuntimeCurrent(runtimeRevision)) this.endRuntime();
      throw error;
    }
  }

  override onunload(): void {
    this.endRuntime();
  }

  async loadSettings(): Promise<void> {
    const migrated = migrateSettings(await this.loadData());
    this.settings = normalizeSettings(migrated);
    this.persistedSettings = normalizeSettings(this.settings);
  }

  async saveSettings(): Promise<void> {
    const runtimeRevision = this.runtimeRevision;
    const snapshot = normalizeSettings(this.settings);
    const save = this.settingsSaveTail.then(async () => {
      await this.saveData(snapshot);
      const impact = getSettingsChangeImpact(this.persistedSettings, snapshot);
      this.persistedSettings = snapshot;
      if (!this.isRuntimeCurrent(runtimeRevision) || !impact.changed) return;

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
      if (impact.navbar) notifyListeners([() => this.noteNavbar?.update()]);
      if (impact.ics) void this.refreshIcs(false, snapshot);
    });
    this.settingsSaveTail = save.catch(() => undefined);
    await save;
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
      (leaf) =>
        new ChronoNotesView(leaf, {
          noteIndex,
          icsEventIndex,
          getSettings: () => this.settings,
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
        }),
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
    if (this.periodicNoteCommands === null) return;
    if (this.isPeriodicNotePathIndexing(date, noteType)) {
      new Notice(getNoteIndexingNotice(this.getTranslator().t));
      return;
    }
    try {
      const result = await this.periodicNoteCommands.openOrCreate(
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
          locale: resolveSettingsLocale(this.settings.locale),
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

  private isPeriodicNotePathIndexing(
    date: LocalDate,
    noteType: PeriodicNoteType,
  ): boolean {
    const snapshot = this.noteIndex?.getSnapshot();
    if (snapshot === undefined) return false;
    const config = this.settings.periodicNotes[noteType];
    return isPeriodicNotePathIndexing(
      date,
      noteType,
      snapshot,
      {
        locale: resolveSettingsLocale(this.settings.locale),
        weekStartDay: this.settings.weekStartDay,
      },
      config,
    );
  }

  private async openIntervalNote(start: LocalDate, end: LocalDate): Promise<void> {
    if (this.intervalNoteCommands === null) return;
    try {
      const result = await this.intervalNoteCommands.openOrCreate({
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
      });
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
    if (this.noteWorkspace === null) return;
    try {
      await this.noteWorkspace.open(path, target);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(formatPluginErrorNotice(message, this.getTranslator().t));
    }
  }

  private async toggleTask(task: NoteTask): Promise<void> {
    if (this.taskCommands === null) return;
    try {
      this.showTaskCommandResult(await this.taskCommands.toggle(task));
    } catch (error) {
      this.showTaskCommandError(error);
    }
  }

  private async rescheduleTask(task: NoteTask, nextDueDate: LocalDate): Promise<void> {
    if (this.taskCommands === null) return;
    try {
      this.showTaskCommandResult(await this.taskCommands.rescheduleDue(task, nextDueDate));
    } catch (error) {
      this.showTaskCommandError(error);
    }
  }

  private async openTaskSource(task: NoteTask, target: "default" | "tab"): Promise<void> {
    if (this.taskCommands === null) return;
    try {
      await this.taskCommands.openSource(task, target);
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
    const noteIndex = this.noteIndex;
    if (noteIndex === null) return;
    new IntervalNoteListModal(
      this.app,
      {
        noteIndex,
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
          this.settingsTab?.activate("ranges");
          openObsidianPluginSettings(this.app, this.manifest.id);
        },
      },
      this.getTranslator(),
    ).open();
  }

  openFirstUseGuide(): void {
    new FirstUseGuideModal(
      this.app,
      this.getTranslator(),
      () => {
        openObsidianPluginSettings(this.app, this.manifest.id);
      },
    ).open();
  }

  getIcsSnapshot(): IcsEventIndexSnapshot | null {
    return this.icsEventIndex?.getSnapshot() ?? null;
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
    this.settings.firstUseGuideSeen = true;
    try {
      await this.saveSettings();
    } catch (error) {
      this.settings.firstUseGuideSeen = false;
      console.error("Chrono Notes: failed to persist first-use guide state", error);
      return;
    }
    if (!this.isRuntimeCurrent(runtimeRevision)) return;
    this.registerInterval(window.setTimeout(() => {
      if (this.isRuntimeCurrent(runtimeRevision)) this.openFirstUseGuide();
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
    const disposers = [...this.runtimeDisposers].reverse();
    this.runtimeDisposers.clear();
    for (const dispose of disposers) dispose();
    this.noteNavbar = null;
    this.icsEventIndex = null;
    this.noteIndex = null;
    this.periodicNoteCommands = null;
    this.intervalNoteCommands = null;
    this.taskCommands = null;
    this.noteWorkspace = null;
    this.settingsTab = null;
    this.settingsListeners.clear();
    this.lastIcsDisplayZone = null;
  }

  private registerRuntimeDisposer(dispose: () => void): void {
    let disposed = false;
    const disposeOnce = () => {
      if (disposed) return;
      disposed = true;
      try {
        dispose();
      } catch (error) {
        console.error("Chrono Notes: runtime cleanup failed", error);
      }
    };
    this.runtimeDisposers.add(disposeOnce);
    this.register(() => {
      this.runtimeDisposers.delete(disposeOnce);
      disposeOnce();
    });
  }

  private isRuntimeCurrent(runtimeRevision: number): boolean {
    return this.runtimeActive && this.runtimeRevision === runtimeRevision;
  }

  private getMiniCalendarInitialDate(): LocalDate {
    const path = this.app.workspace.getActiveFile()?.path;
    if (path === undefined) return getCurrentLocalDate();
    const match = findPeriodicNotePathMatch(
      path,
      PERIODIC_NOTE_TYPES
        .filter((noteType) => this.settings.periodicNotes[noteType].enabled)
        .map((noteType) => ({
          noteType,
          pattern: this.settings.periodicNotes[noteType].pattern,
        })),
      {
        locale: resolveSettingsLocale(this.settings.locale),
        weekStartDay: this.settings.weekStartDay,
      },
    );
    return match?.date ?? getCurrentLocalDate();
  }

  private getTranslator(): Translator {
    return createTranslator(this.settings.locale, navigator.language);
  }
}

function resolveSettingsLocale(locale: ChronoNotesSettings["locale"]): string {
  if (locale === "auto") return navigator.language;
  return locale;
}

function getLocalTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
