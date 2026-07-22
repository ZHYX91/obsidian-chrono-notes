import { CalendarPlus, FileText, Search, Settings2 } from "lucide-react";
import { Modal, type App } from "obsidian";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";

import type { LocalDate } from "../../core/periodic/periodic-date";
import {
  filterIntervalNoteItems,
  type IntervalListScope,
  type IntervalListSort,
} from "../../features/intervals/interval-note-list";
import {
  getIntervalNoteScanFolder,
  getIntervalListSetup,
} from "../../features/intervals/interval-list-setup";
import { selectIntervalNotesFromProjection } from "../../features/intervals/interval-note-query";
import type { NoteIndex } from "../../features/notes/note-index";
import type { NoteOpenTarget } from "../../features/periodic/periodic-note-commands";
import type { Translator } from "../../shared/i18n";
import type { ChronoNotesSettings } from "../../shared/settings";
import {
  formatCompactNoteTaskProgress,
  formatNoteTaskProgress,
  getNoteTaskProgressPresentation,
} from "../note-task-progress-presentation";
import { useLocalToday } from "../use-local-today";
import {
  formatIntervalListCount,
  formatIntervalListDuration,
  getIntervalListEmptyState,
  getIntervalListMessages,
  type IntervalListEmptyState,
} from "./interval-list-presentation";

export interface IntervalNoteListModalHost {
  readonly noteIndex: NoteIndex;
  getSettings(): ChronoNotesSettings;
  getSettingsRevision(): number;
  subscribeSettings(listener: () => void): () => void;
  openPath(path: string, target: NoteOpenTarget): Promise<void>;
  createRange(initialDate: LocalDate): void;
  folderExists(path: string): boolean;
  openRangeSettings(): void;
}

export class IntervalNoteListModal extends Modal {
  private root: Root | null = null;
  private disposeKeyboardInsets: (() => void) | null = null;

  constructor(
    app: App,
    private readonly host: IntervalNoteListModalHost,
    private readonly translator: Translator,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.titleEl.setText(getIntervalListMessages(this.translator.t).title);
    const modalEl = this.modalEl ?? this.contentEl;
    modalEl.addClass("chrono-notes-interval-list-modal-container");
    this.contentEl.empty();
    this.contentEl.addClass("chrono-notes-interval-list-modal");
    this.disposeKeyboardInsets = bindMobileKeyboardInsets(modalEl);
    this.root = createRoot(this.contentEl.createDiv());
    this.root.render(
      <IntervalNoteListContent
        host={this.host}
        translator={this.translator}
        onRequestClose={() => this.close()}
      />,
    );
  }

  override onClose(): void {
    this.disposeKeyboardInsets?.();
    this.disposeKeyboardInsets = null;
    this.root?.unmount();
    this.root = null;
    this.contentEl.empty();
  }
}

interface MobileKeyboardInfo {
  readonly keyboardHeight: number;
  readonly screenHeight?: number;
}

interface MobileKeyboardListenerHandle {
  remove(): Promise<void>;
}

interface MobileKeyboardPlugin {
  addListener(
    event: "keyboardDidShow",
    listener: (info: MobileKeyboardInfo) => void,
  ): Promise<MobileKeyboardListenerHandle>;
  addListener(
    event: "keyboardDidHide",
    listener: () => void,
  ): Promise<MobileKeyboardListenerHandle>;
}

function bindMobileKeyboardInsets(modalEl: HTMLElement): () => void {
  const capacitorWindow = window as typeof window & {
    Capacitor?: {
      Plugins?: {
        Keyboard?: MobileKeyboardPlugin;
      };
    };
  };
  const keyboard = capacitorWindow.Capacitor?.Plugins?.Keyboard;
  if (keyboard === undefined) return () => undefined;

  let disposed = false;
  let viewportHeightBeforeKeyboard = window.innerHeight;
  let visibleKeyboard: MobileKeyboardInfo | null = null;
  const handles: MobileKeyboardListenerHandle[] = [];
  const clearInset = () => {
    modalEl.removeClass("is-keyboard-visible");
    modalEl.style.removeProperty("--chrono-notes-keyboard-height");
    modalEl.style.removeProperty("--chrono-notes-keyboard-screen-height");
    modalEl.style.removeProperty("--chrono-notes-keyboard-shift");
  };
  const applyInset = (info: MobileKeyboardInfo) => {
    const currentViewportHeight = window.innerHeight;
    const viewportResized = currentViewportHeight <
      viewportHeightBeforeKeyboard - 8;
    const reportedScreenHeight = info.screenHeight;
    const screenHeight = viewportResized
      ? currentViewportHeight
      : reportedScreenHeight !== undefined &&
          Number.isFinite(reportedScreenHeight) &&
          reportedScreenHeight > 0
        ? reportedScreenHeight
        : viewportHeightBeforeKeyboard;
    const keyboardHeight = viewportResized
      ? 0
      : Math.min(Math.max(0, info.keyboardHeight), screenHeight);
    modalEl.style.setProperty(
      "--chrono-notes-keyboard-height",
      `${keyboardHeight}px`,
    );
    modalEl.style.setProperty(
      "--chrono-notes-keyboard-screen-height",
      `${screenHeight}px`,
    );
    modalEl.style.setProperty(
      "--chrono-notes-keyboard-shift",
      `${keyboardHeight / -2}px`,
    );
    modalEl.addClass("is-keyboard-visible");
  };
  const isKeyboardInput = (element: Element | null) =>
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    (element instanceof HTMLElement && element.isContentEditable);
  const handleFocusIn = (event: FocusEvent) => {
    if (!isKeyboardInput(event.target as Element | null)) return;
    viewportHeightBeforeKeyboard = window.innerHeight;
  };
  const handleResize = () => {
    if (visibleKeyboard === null) {
      if (
        !isKeyboardInput(document.activeElement) ||
        window.innerHeight > viewportHeightBeforeKeyboard
      ) {
        viewportHeightBeforeKeyboard = window.innerHeight;
      }
      return;
    }
    applyInset(visibleKeyboard);
  };
  const removeHandle = (handle: MobileKeyboardListenerHandle) => {
    void handle.remove().catch((error: unknown) => {
      console.error("Chrono Notes: mobile keyboard listener cleanup failed", error);
    });
  };
  const trackHandle = (promise: Promise<MobileKeyboardListenerHandle>) => {
    void promise.then((handle) => {
      if (disposed) {
        removeHandle(handle);
      } else {
        handles.push(handle);
      }
    }).catch((error: unknown) => {
      console.error("Chrono Notes: mobile keyboard listener failed", error);
    });
  };
  trackHandle(keyboard.addListener("keyboardDidShow", (info) => {
    if (
      disposed ||
      !Number.isFinite(info.keyboardHeight) ||
      info.keyboardHeight <= 0
    ) return;
    visibleKeyboard = info;
    applyInset(info);
  }));
  trackHandle(keyboard.addListener("keyboardDidHide", () => {
    visibleKeyboard = null;
    clearInset();
    viewportHeightBeforeKeyboard = window.innerHeight;
  }));
  modalEl.addEventListener("focusin", handleFocusIn);
  window.addEventListener("resize", handleResize);

  return () => {
    if (disposed) return;
    disposed = true;
    modalEl.removeEventListener("focusin", handleFocusIn);
    window.removeEventListener("resize", handleResize);
    clearInset();
    for (const handle of handles) removeHandle(handle);
    handles.length = 0;
  };
}

function IntervalNoteListContent({
  host,
  translator,
  onRequestClose,
}: Readonly<{
  host: IntervalNoteListModalHost;
  translator: Translator;
  onRequestClose: () => void;
}>) {
  const { t } = translator;
  const messages = getIntervalListMessages(t);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<IntervalListScope>("all");
  const [sort, setSort] = useState<IntervalListSort>("start-asc");
  const referenceDate = useLocalToday();
  const subscribe = useCallback(
    (listener: () => void) => host.noteIndex.subscribe(listener),
    [host.noteIndex],
  );
  const getSnapshot = useCallback(
    () => host.noteIndex.getSnapshot().intervals,
    [host.noteIndex],
  );
  const intervals = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const subscribeSettings = useCallback(
    (listener: () => void) => host.subscribeSettings(listener),
    [host],
  );
  const getSettingsRevision = useCallback(() => host.getSettingsRevision(), [host]);
  const settingsRevision = useSyncExternalStore(
    subscribeSettings,
    getSettingsRevision,
    getSettingsRevision,
  );
  const settings = host.getSettings();
  const scanFolder = getIntervalNoteScanFolder(settings.rangeNotes);
  const setup = getIntervalListSetup(
    settings.rangeNotes,
    scanFolder === null || host.folderExists(scanFolder),
  );
  const allItems = useMemo(
    () => selectIntervalNotesFromProjection(intervals, settings.rangeNotes).items,
    [intervals, settings.rangeNotes, settingsRevision],
  );
  const items = useMemo(
    () => filterIntervalNoteItems(allItems, { query, scope, sort, referenceDate }),
    [allItems, query, referenceDate, scope, sort],
  );
  const emptyState = getIntervalListEmptyState(
    allItems.length,
    items.length,
    setup,
  );

  const createRange = () => {
    onRequestClose();
    host.createRange(referenceDate);
  };

  const openRangeSettings = () => {
    onRequestClose();
    host.openRangeSettings();
  };

  const resetFilters = () => {
    setQuery("");
    setScope("all");
  };

  const emptyMessage = emptyState === null
    ? null
    : getEmptyStateMessage(emptyState.kind, messages);
  const emptyActionLabel = emptyState === null
    ? null
    : emptyState.action === "create"
      ? messages.createRange
      : emptyState.action === "reset"
        ? messages.resetFilters
        : messages.openRangeSettings;

  const handleEmptyAction = (action: IntervalListEmptyState["action"]) => {
    if (action === "create") createRange();
    else if (action === "reset") resetFilters();
    else openRangeSettings();
  };

  return (
    <div className="chrono-notes-interval-list">
      <div className="chrono-notes-interval-list-toolbar">
        <span className="chrono-notes-interval-list-count">
          {formatIntervalListCount(items.length, t)}
        </span>
        <label className="chrono-notes-interval-list-search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            value={query}
            placeholder={messages.searchPlaceholder}
            aria-label={messages.searchAria}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </label>
        <select
          value={scope}
          aria-label={messages.scopeAria}
          onChange={(event) => setScope(event.currentTarget.value as IntervalListScope)}
        >
          <option value="all">{messages.allDates}</option>
          <option value="month">{messages.currentMonth}</option>
          <option value="year">{messages.currentYear}</option>
        </select>
        <select
          value={sort}
          aria-label={messages.sortAria}
          onChange={(event) => setSort(event.currentTarget.value as IntervalListSort)}
        >
          <option value="start-asc">{messages.startAscending}</option>
          <option value="start-desc">{messages.startDescending}</option>
        </select>
        <button
          type="button"
          className="chrono-notes-interval-list-create"
          aria-label={setup.canCreateVisibleItem
            ? messages.createRange
            : messages.openRangeSettings}
          title={setup.canCreateVisibleItem
            ? messages.createRange
            : messages.openRangeSettings}
          onClick={setup.canCreateVisibleItem ? createRange : openRangeSettings}
        >
          {setup.canCreateVisibleItem
            ? <CalendarPlus size={16} aria-hidden="true" />
            : <Settings2 size={16} aria-hidden="true" />}
        </button>
      </div>
      {emptyState !== null ? (
        <div className="chrono-notes-interval-list-empty" data-empty-state={emptyState.kind}>
          <span>{emptyMessage}</span>
          <button
            type="button"
            onClick={() => handleEmptyAction(emptyState.action)}
          >
            {emptyActionLabel}
          </button>
        </div>
      ) : (
        <div className="chrono-notes-interval-list-results">
          {items.map((item) => {
            const duration = formatIntervalListDuration(item.dayCount, t);
            const progress = getNoteTaskProgressPresentation(item.statistics);
            const progressLabel = formatNoteTaskProgress(item.statistics, t);
            const compactProgress = formatCompactNoteTaskProgress(item.statistics, t);
            const openLabel = t("intervalList.openItem", { title: item.title });
            return (
              <button
                type="button"
                className="chrono-notes-interval-list-item"
                data-task-state={progress.state}
                key={item.path}
                aria-label={`${openLabel}. ${progressLabel}`}
                title={`${item.title}\n${formatRange(item.start.value, item.end.value)}\n${duration}\n${progressLabel}`}
                onClick={() => void host.openPath(item.path, "tab")}
              >
                <FileText size={16} aria-hidden="true" />
                <span className="chrono-notes-interval-list-main">
                  <strong>{item.title}</strong>
                  <span>{formatRange(item.start.value, item.end.value)}</span>
                  <small>{item.path}</small>
                </span>
                <span className="chrono-notes-interval-list-duration">
                  {duration} · {compactProgress}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getEmptyStateMessage(
  kind: IntervalListEmptyState["kind"],
  messages: ReturnType<typeof getIntervalListMessages>,
): string {
  switch (kind) {
    case "creation-not-configured":
      return messages.creationNotConfigured;
    case "scan-not-configured":
      return messages.scanNotConfigured;
    case "scan-folder-missing":
      return messages.scanFolderMissing;
    case "creation-outside-scope":
      return messages.creationOutsideScope;
    case "empty-filters":
      return messages.emptyFilters;
    case "empty-scope":
      return messages.emptyScope;
  }
}

function formatRange(start: string, end: string): string {
  return `${start.replace("T", " ")} - ${end.replace("T", " ")}`;
}
