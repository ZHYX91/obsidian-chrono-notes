import { findMarkdownExtensionVariant } from "../../core/document/markdown-extension";
import { MarkdownView, parseLinktext, type App, type EventRef as WorkspaceEventRef, type Workspace } from "obsidian";
import {
  PERIODIC_NOTE_TYPES,
  type LocalDate,
  type PeriodicNoteType,
} from "../../core/periodic/periodic-date";
import { matchMissingPeriodicLink } from "../../core/periodic/periodic-note-path";
import type { PeriodicLinkDestination } from "../../features/periodic/periodic-note-commands";
import type { ChronoNotesSettings } from "../../shared/settings";

type Navigate = (path: string) => Promise<void>;
type OpenLinkArgs = Parameters<Workspace["openLinkText"]>;
type Intercept = (...args: OpenLinkArgs) => Promise<void> | null;

interface MissingPeriodicLinkRequest {
  linkText: string;
  sourcePath: string;
  newLeaf?: OpenLinkArgs[2];
  viewState?: OpenLinkArgs[3];
  claim(navigation: Promise<void>): void;
}

declare module "obsidian" {
  interface Workspace {
    on(name: "chrono-notes:claim-missing-periodic-link-v1", callback: (request: MissingPeriodicLinkRequest) => void): WorkspaceEventRef;
  }
}

export class ObsidianPeriodicLinkNavigation {
  private remove: (() => void) | null = null;

  constructor(
    private readonly app: App,
    private readonly getSettings: () => Readonly<ChronoNotesSettings>,
    private readonly getLocale: () => string,
    private readonly openPeriodic: (date: LocalDate, type: PeriodicNoteType, target: PeriodicLinkDestination) => Promise<void>,
    private readonly reportError: (error: unknown) => void,
    private readonly pendingCreation: (path: string) => Promise<unknown> | undefined = () => undefined,
  ) {}

  setEnabled(enabled: boolean): void {
    if (!enabled) {
      this.remove?.();
      this.remove = null;
    } else if (this.remove === null) {
      const workspace = this.app.workspace;
      // The host does not await every UI gesture. Report an owned failure once
      // while leaving the return value of ordinary native navigation untouched.
      const openNative = workspace.openLinkText.bind(workspace);
      const intercept: Intercept = (...args) =>
        this.handleOpen(() => openNative(...args), ...args)?.catch(this.reportError) ?? null;
      const restore = interceptWorkspaceLinks(workspace, intercept);
      // Another link creator can offer Chrono the target before creating a file.
      // Claim synchronously, including when confirmation or template loading is pending.
      const listener = workspace.on("chrono-notes:claim-missing-periodic-link-v1", (request) => {
        const navigation = intercept(request.linkText, request.sourcePath, request.newLeaf, request.viewState);
        if (navigation) request.claim(navigation);
      });
      this.remove = () => {
        workspace.offref(listener);
        restore();
      };
    }
  }

  private handleOpen(openNative: () => Promise<void>, ...[text, source, newLeaf, viewState]: OpenLinkArgs): Promise<void> | null {
    const settings = this.getSettings();
    if (
      !settings.createMissingPeriodicNotesFromLinks || source.startsWith("file:") ||
      !/\.md$/iu.test(source) || this.app.vault.getFileByPath(source) === null
    ) return null;
    // Reading view, editors and Properties pass the destination, independent of
    // the displayed alias. A pipe inside a Markdown target or heading is literal.
    const { path, subpath } = parseLinktext(text);
    if (!path) return null;
    const resolved = this.app.metadataCache.getFirstLinkpathDest(path, source);
    if (resolved !== null) {
      const physicalPath = resolved.path;
      const owner = this.pendingCreation(physicalPath);
      if (owner === undefined) return null;
      const binding = this.remove;
      return owner.then(async () => {
        if (this.remove !== binding) return;
        if (resolved.path !== physicalPath || this.app.vault.getFileByPath(physicalPath) !== resolved ||
          this.app.metadataCache.getFirstLinkpathDest(path, source) !== resolved) {
          throw new Error(`Markdown link destination changed: ${physicalPath}`);
        }
        await openNative();
      });
    }

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
    const navigate: Navigate = async (target) => {
      const file = this.app.vault.getFileByPath(target);
      if (file === null) throw new Error(`Markdown note not found: ${target}`);
      const owner = this.pendingCreation(file.path);
      if (owner !== undefined) {
        const binding = this.remove;
        await owner;
        if (this.remove !== binding) return;
        if (this.app.vault.getFileByPath(target) !== file) throw new Error(`Markdown link destination changed: ${target}`);
      }
      const state = subpath
        ? { ...viewState, eState: { ...viewState?.eState, subpath } }
        : viewState;
      // Keep a delayed default open in its original pane. If the user closed,
      // repurposed or pinned it, open a tab instead of replacing another note.
      const reusable = origin && origin.containerEl.isConnected && origin.leaf.view === origin &&
        origin.file === sourceFile && !origin.leaf.getViewState().pinned;
      const leaf = reusable ? origin.leaf : workspace.getLeaf(origin ? "tab" : newLeaf);
      await leaf.openFile(file, state);
    };

    // Metadata can lag behind actual Vault files. Prefer an exact extension
    // in the source folder or at the root before trying the other spellings.
    const markdownPath = /\.md$/iu.test(path) ? path : path + ".md";
    const sourceFolder = source.slice(0, source.lastIndexOf("/") + 1);
    const named = match.path.slice(0, -3) + markdownPath.slice(-3);
    const existing = findMarkdownExtensionVariant(markdownPath, (candidate) => {
      const nearby = this.app.vault.getFileByPath(sourceFolder + candidate)
        ?? this.app.vault.getFileByPath(candidate);
      if (nearby !== null) return nearby;
      // Honor an explicit extension on a short link when two physical files
      // coexist in the configured periodic folder.
      return candidate === markdownPath && named !== match.path ? this.app.vault.getFileByPath(named) : null;
    });
    if (existing !== undefined && existing.path.slice(0, -3) !== match.path.slice(0, -3)) {
      return navigate(existing.path);
    }
    // The file may already contain initial template text. The command owns
    // that path until its finalizer settles, even on a metadata-cache miss.
    return this.openPeriodic(match.date, match.noteType, { requestedPath: named, open: navigate });
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
