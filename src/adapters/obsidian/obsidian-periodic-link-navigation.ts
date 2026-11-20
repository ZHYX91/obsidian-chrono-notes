import { MarkdownView, parseLinktext, type App, type Workspace } from "obsidian";
import {
  PERIODIC_NOTE_TYPES,
  type LocalDate,
  type PeriodicNoteType,
} from "../../core/periodic/periodic-date";
import { matchMissingPeriodicLink } from "../../core/periodic/periodic-note-path";
import type { ChronoNotesSettings } from "../../shared/settings";

type Navigate = (path: string) => Promise<void>;
type OpenLinkArgs = Parameters<Workspace["openLinkText"]>;
type Intercept = (...args: OpenLinkArgs) => Promise<void> | null;

export class ObsidianPeriodicLinkNavigation {
  private remove: (() => void) | null = null;

  constructor(
    private readonly app: App,
    private readonly getSettings: () => Readonly<ChronoNotesSettings>,
    private readonly getLocale: () => string,
    private readonly openPeriodic: (date: LocalDate, type: PeriodicNoteType, navigate: Navigate) => Promise<void>,
  ) {}

  setEnabled(enabled: boolean): void {
    if (!enabled) {
      this.remove?.();
      this.remove = null;
    } else if (this.remove === null) {
      this.remove = interceptWorkspaceLinks(this.app.workspace, (...args) => this.handleOpen(...args));
    }
  }

  private handleOpen(...[text, source, newLeaf, viewState]: OpenLinkArgs): Promise<void> | null {
    const settings = this.getSettings();
    if (
      !settings.createMissingPeriodicNotesFromLinks || source.startsWith("file:") ||
      !source.endsWith(".md") || this.app.vault.getFileByPath(source) === null
    ) return null;
    // Reading view, editors and Properties pass the destination, independent of
    // the displayed alias. A pipe inside a Markdown target or heading is literal.
    const { path, subpath } = parseLinktext(text);
    if (!path || this.app.metadataCache.getFirstLinkpathDest(path, source) !== null) return null;

    const match = matchMissingPeriodicLink(
      path,
      PERIODIC_NOTE_TYPES.map((noteType) => ({ noteType, ...settings.periodicNotes[noteType] })),
      { locale: this.getLocale(), weekStartDay: settings.weekStartDay },
    );
    if (match === null) return null;

    const workspace = this.app.workspace;
    const view = newLeaf ? null : workspace.getActiveViewOfType(MarkdownView);
    const origin = view?.navigation && !view.leaf.getViewState().pinned ? view : null;
    const sourceFile = origin?.file;

    // Only the command's success path navigates. Cancellation or a failed template
    // must never fall through to Obsidian's ordinary empty-file creation.
    return this.openPeriodic(match.date, match.noteType, (canonicalPath) => {
      const file = this.app.vault.getFileByPath(canonicalPath);
      if (file === null) throw new Error(`Markdown note not found: ${canonicalPath}`);
      const state = subpath
        ? { ...viewState, eState: { ...viewState?.eState, subpath } }
        : viewState;
      // Keep a delayed default open in its original pane. If the user closed,
      // repurposed or pinned it, open a tab instead of replacing another note.
      const reusable = origin && origin.containerEl.isConnected && origin.leaf.view === origin &&
        origin.file === sourceFile && !origin.leaf.getViewState().pinned;
      const leaf = reusable ? origin.leaf : workspace.getLeaf(origin ? "tab" : newLeaf);
      return leaf.openFile(file, state);
    });
  }
}

// Reading view, editors and Properties share this public navigation method.
// Forward the original receiver, source, pane and view state on every route.
function interceptWorkspaceLinks(workspace: Workspace, intercept: Intercept | null): () => void {
  const ownDescriptor = Object.getOwnPropertyDescriptor(workspace, "openLinkText");
  const original = workspace.openLinkText.bind(workspace);
  const wrapped: Workspace["openLinkText"] = (...args) => intercept?.(...args) ?? original(...args);
  workspace.openLinkText = wrapped;
  return () => {
    // Another plugin may have wrapped us. Its saved callback must become a
    // transparent pass-through and release our runtime even when removed later.
    intercept = null;
    if (workspace.openLinkText !== wrapped) return;
    if (ownDescriptor) Object.defineProperty(workspace, "openLinkText", ownDescriptor);
    else Reflect.deleteProperty(workspace, "openLinkText");
  };
}
