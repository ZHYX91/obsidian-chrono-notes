import {
  ArrowUpToLine,
  Calendar,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
} from "lucide-react";
import { MarkdownView, type App, type WorkspaceLeaf } from "obsidian";
import { useCallback, useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";

import {
  formatLocalDateKey,
  type LocalDate,
  type PeriodicNoteType,
} from "../../core/periodic/periodic-date";
import { selectNoteNavbarContextFromProjection } from "../../features/periodic/note-navbar-query";
import type { NoteIndex } from "../../features/notes/note-index";
import type { NoteOpenTarget } from "../../features/periodic/periodic-note-commands";
import { createTranslator } from "../../shared/i18n";
import type { ChronoNotesSettings } from "../../shared/settings";
import {
  formatCompactNoteTaskProgress,
  formatNoteTaskProgress,
  getNoteTaskProgressPresentation,
} from "../note-task-progress-presentation";
import {
  formatHigherNoteLabel,
  formatPeriodicNoteName,
  getNoteNavbarMessages,
} from "./note-navbar-presentation";

const RELATED_LIMIT = 5;

export interface NoteNavbarHost {
  readonly noteIndex: NoteIndex;
  getSettings(): ChronoNotesSettings;
  openPeriodic(date: LocalDate, noteType: PeriodicNoteType, target: NoteOpenTarget): Promise<void>;
  openCalendar(): Promise<void>;
  openPath(path: string, target: NoteOpenTarget): Promise<void>;
  setRelatedCollapsed(collapsed: boolean): Promise<void>;
  pickDate(
    initialDate: LocalDate,
    onSelect: (date: LocalDate) => void | Promise<void>,
  ): void;
}

export class NoteNavbarManager {
  private readonly mounts = new Map<WorkspaceLeaf, Readonly<{
    root: Root;
    container: HTMLDivElement;
  }>>();

  constructor(
    private readonly app: App,
    private readonly host: NoteNavbarHost,
  ) {}

  handleFileRename(): void {
    this.update();
  }

  update(): void {
    const settings = this.host.getSettings();
    const translator = createTranslator(settings.locale, navigator.language);
    const leaves = new Set(this.app.workspace.getLeavesOfType("markdown"));
    for (const leaf of this.mounts.keys()) {
      if (!leaves.has(leaf)) this.unmountLeaf(leaf);
    }
    if (!settings.showNoteNavbar) {
      this.unmount();
      return;
    }
    for (const leaf of leaves) this.updateLeaf(leaf, settings, translator.locale);
  }

  private updateLeaf(
    leaf: WorkspaceLeaf,
    settings: ChronoNotesSettings,
    locale: string,
  ): void {
    const view = leaf.view;
    if (!(view instanceof MarkdownView)) {
      this.unmountLeaf(leaf);
      return;
    }
    const path = view?.file?.path;
    if (path === undefined) {
      this.unmountLeaf(leaf);
      return;
    }
    const context = selectNoteNavbarContextFromProjection(
      path,
      this.host.noteIndex.getSnapshot().intervals,
      {
        locale,
        weekStartDay: settings.weekStartDay,
        periodicNotes: settings.periodicNotes,
        rangeNotes: settings.rangeNotes,
      },
    );
    const content = view.contentEl;
    const parent = content.parentElement;
    if (context === null || parent === null) {
      this.unmountLeaf(leaf);
      return;
    }
    let mount = this.mounts.get(leaf);
    if (
      mount === undefined ||
      mount.container.parentElement !== parent ||
      mount.container.nextElementSibling !== content
    ) {
      this.unmountLeaf(leaf);
      const container = content.ownerDocument.createElement("div");
      container.className = "chrono-notes-navbar-container";
      content.insertAdjacentElement("beforebegin", container);
      mount = Object.freeze({ root: createRoot(container), container });
      this.mounts.set(leaf, mount);
    }
    mount.root.render(<NoteNavbar path={path} host={this.host} />);
  }

  unmount(): void {
    for (const leaf of [...this.mounts.keys()]) this.unmountLeaf(leaf);
  }

  private unmountLeaf(leaf: WorkspaceLeaf): void {
    const mount = this.mounts.get(leaf);
    if (mount === undefined) return;
    mount.root.unmount();
    mount.container.remove();
    this.mounts.delete(leaf);
  }
}

function NoteNavbar({ path, host }: Readonly<{ path: string; host: NoteNavbarHost }>) {
  const subscribe = useCallback(
    (listener: () => void) => host.noteIndex.subscribe(listener),
    [host.noteIndex],
  );
  const getSnapshot = useCallback(
    () => host.noteIndex.getSnapshot().intervals,
    [host.noteIndex],
  );
  const intervals = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const settings = host.getSettings();
  const translator = createTranslator(settings.locale, navigator.language);
  const { t } = translator;
  const messages = getNoteNavbarMessages(t);
  const context = selectNoteNavbarContextFromProjection(path, intervals, {
    locale: translator.locale,
    weekStartDay: settings.weekStartDay,
    periodicNotes: settings.periodicNotes,
    rangeNotes: settings.rangeNotes,
  });
  if (context === null) return null;
  const collapsed = settings.relatedIntervalNotesCollapsed;
  const visible = collapsed ? [] : context.relatedIntervals.slice(0, RELATED_LIMIT);
  const hiddenCount = Math.max(0, context.relatedIntervals.length - visible.length);

  return (
    <div className="chrono-notes-navbar">
      <div className="chrono-notes-navbar-controls">
        <div className="chrono-notes-navbar-navigation">
          <div className="chrono-notes-navbar-primary">
            <button
              type="button"
              aria-label={messages.previousPeriod}
              title={messages.previousPeriod}
              onClick={() => void host.openPeriodic(
                context.previous.date,
                context.previous.noteType,
                "default",
              )}
            >
              <ChevronLeft size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="chrono-notes-navbar-label"
              aria-label={messages.chooseDate}
              title={messages.chooseDate}
              onClick={() => host.pickDate(context.date, (date) =>
                host.openPeriodic(date, context.noteType, "default"))}
            >
              <Calendar size={15} aria-hidden="true" />
              <span>{context.label}</span>
            </button>
            <button
              type="button"
              aria-label={messages.nextPeriod}
              title={messages.nextPeriod}
              onClick={() => void host.openPeriodic(
                context.next.date,
                context.next.noteType,
                "default",
              )}
            >
              <ChevronRight size={15} aria-hidden="true" />
            </button>
          </div>
          {context.higher === null ? null : (
            <button
              type="button"
              className="chrono-notes-navbar-higher"
              aria-label={formatHigherNoteLabel(context.higher.noteType, t)}
              title={formatHigherNoteLabel(context.higher.noteType, t)}
              onClick={() => void host.openPeriodic(
                context.higher!.date,
                context.higher!.noteType,
                "default",
              )}
            >
              <ArrowUpToLine size={15} aria-hidden="true" />
              <span>{formatPeriodicNoteName(context.higher.noteType, t)}</span>
            </button>
          )}
        </div>
        <div className="chrono-notes-navbar-actions">
          <button
            type="button"
            aria-label={messages.openCalendar}
            title={messages.openCalendar}
            onClick={() => void host.openCalendar()}
          >
            <CalendarDays size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
      {context.relatedIntervals.length === 0 ? null : (
        <div className="chrono-notes-navbar-related">
          <button
            type="button"
            className="chrono-notes-navbar-related-toggle"
            aria-expanded={!collapsed}
            onClick={() => void host.setRelatedCollapsed(!collapsed)}
          >
            <ChevronDown size={14} aria-hidden="true" />
            <span>{messages.relatedRangeNotes}</span>
            <small>{context.relatedIntervals.length}</small>
          </button>
          {collapsed ? null : (
            <div className="chrono-notes-navbar-related-list">
              {visible.map((item) => {
                const dateRange = formatIntervalDateRange(item);
                const progress = getNoteTaskProgressPresentation(item.statistics);
                const progressLabel = formatNoteTaskProgress(item.statistics, t);
                const compactProgress = formatCompactNoteTaskProgress(item.statistics, t);
                return (
                  <button
                    type="button"
                    data-task-state={progress.state}
                    title={`${item.title}\n${dateRange}\n${progressLabel}`}
                    aria-label={`${t("intervalList.openItem", { title: item.title })}. ${progressLabel}`}
                    key={item.path}
                    onClick={() => void host.openPath(item.path, "tab")}
                  >
                    <FileText size={14} aria-hidden="true" />
                    <span>{item.title}</span>
                    <small>{dateRange} · {compactProgress}</small>
                  </button>
                );
              })}
              {hiddenCount === 0 ? null : (
                <div
                  className="chrono-notes-navbar-related-more"
                  title={t("navbar.moreRelated", { count: hiddenCount })}
                >
                  +{hiddenCount}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatIntervalDateRange(
  item: Readonly<{ start: { date: LocalDate }; end: { date: LocalDate } }>,
): string {
  return `${formatLocalDateKey(item.start.date)} - ${formatLocalDateKey(item.end.date)}`;
}
