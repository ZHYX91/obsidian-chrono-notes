import { ItemView, type WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";

import type { LocalDate, PeriodicNoteType } from "../../core/periodic/periodic-date";
import type { StatisticDisplayDimension } from "../../core/statistics/heatmap";
import type { NoteTask } from "../../core/note/note-tasks";
import type { IcsEventIndex } from "../../features/calendar/ics-event-index";
import type { NoteIndex } from "../../features/notes/note-index";
import type { NoteOpenTarget } from "../../features/periodic/periodic-note-commands";
import type { ChronoNotesSettings } from "../../shared/settings";
import { createCalendarPickerModalHost } from "../modals/calendar-picker-modal-host";
import { CalendarApp, type CalendarNavigationRequest } from "./calendar-app";
import type { CalendarPickerModalHost } from "./calendar-picker-layer";

export const CHRONO_NOTES_VIEW_TYPE = "chrono-notes-calendar";

export interface ChronoNotesViewHost {
  readonly noteIndex: NoteIndex;
  readonly icsEventIndex: IcsEventIndex;
  getSettings(): ChronoNotesSettings;
  openPeriodic(
    date: LocalDate,
    noteType: PeriodicNoteType,
    target: NoteOpenTarget,
  ): Promise<void>;
  setYearHeatmap(enabled: boolean): Promise<void>;
  setStatisticDimension(dimension: StatisticDisplayDimension): Promise<void>;
  openPath(path: string, target: NoteOpenTarget): Promise<void>;
  createRange(initialDate: LocalDate, initialEndDate?: LocalDate): void;
  toggleTask(task: NoteTask): Promise<void>;
  rescheduleTask(task: NoteTask, nextDueDate: LocalDate): Promise<void>;
  openTaskSource(task: NoteTask, target: NoteOpenTarget): Promise<void>;
  openDateContextMenu(
    date: LocalDate,
    configured: boolean,
    noteExists: boolean,
    event: MouseEvent,
  ): void;
}

export class ChronoNotesView extends ItemView {
  private root: Root | null = null;
  private readonly pickerModalHost: CalendarPickerModalHost;
  private navigationRequest: CalendarNavigationRequest | null = null;
  private navigationRevision = 0;

  constructor(leaf: WorkspaceLeaf, private readonly host: ChronoNotesViewHost) {
    super(leaf);
    this.pickerModalHost = createCalendarPickerModalHost(this.app);
  }

  getViewType(): string {
    return CHRONO_NOTES_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Chrono Notes";
  }

  getIcon(): string {
    return "calendar-days";
  }

  override async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass("chrono-notes-view");
    this.root = createRoot(this.contentEl);
    this.refresh();
  }

  refresh(): void {
    if (this.root === null) return;
    this.root.render(
      <CalendarApp
        pickerModalHost={this.pickerModalHost}
        noteIndex={this.host.noteIndex}
        icsEventIndex={this.host.icsEventIndex}
        getSettings={() => this.host.getSettings()}
        onOpenPeriodic={(date, noteType, target) =>
          this.host.openPeriodic(date, noteType, target)}
        onSetYearHeatmap={(enabled) => this.host.setYearHeatmap(enabled)}
        onSetStatisticDimension={(dimension) => this.host.setStatisticDimension(dimension)}
        onOpenPath={(path, target) => this.host.openPath(path, target)}
        onCreateRange={(initialDate, initialEndDate) =>
          this.host.createRange(initialDate, initialEndDate)}
        onToggleTask={(task) => this.host.toggleTask(task)}
        onRescheduleTask={(task, nextDueDate) => this.host.rescheduleTask(task, nextDueDate)}
        onOpenTaskSource={(task, target) => this.host.openTaskSource(task, target)}
        onOpenDateContextMenu={(date, configured, noteExists, event) =>
          this.host.openDateContextMenu(date, configured, noteExists, event)}
        navigationRequest={this.navigationRequest}
      />,
    );
  }

  jumpToDate(date: LocalDate): void {
    this.navigationRevision += 1;
    this.navigationRequest = Object.freeze({
      revision: this.navigationRevision,
      date: Object.freeze({ year: date.year, month: date.month, day: date.day }),
    });
    this.refresh();
  }

  override async onClose(): Promise<void> {
    this.root?.unmount();
    this.root = null;
  }
}
