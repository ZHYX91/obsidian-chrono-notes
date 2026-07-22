import {
  AbstractInputSuggest,
  prepareFuzzySearch,
  renderResults,
  type App,
  type EventRef,
  type SearchResult,
  type TFile,
  type TFolder,
} from "obsidian";

import type { PeriodicNoteType } from "../../core/periodic/periodic-date";
import {
  getPeriodicNoteFolderQuery,
  setPeriodicNoteFolder,
} from "./periodic-note-settings-presentation";

interface RankedPath<T> {
  readonly item: T;
  readonly result: SearchResult;
}

const DEFAULT_SUGGESTION_LIMIT = 100;

export class VaultPathSuggestionCatalog {
  private markdownFiles: readonly TFile[] | null = null;
  private folders: readonly TFolder[] | null = null;
  private eventRefs: EventRef[] = [];

  public constructor(private readonly app: App) {}

  public start(): void {
    if (this.eventRefs.length > 0) return;
    const markDirty = (): void => this.markDirty();
    this.eventRefs = [
      this.app.vault.on("create", markDirty),
      this.app.vault.on("delete", markDirty),
      this.app.vault.on("rename", markDirty),
    ];
  }

  public dispose(): void {
    for (const eventRef of this.eventRefs) this.app.vault.offref(eventRef);
    this.eventRefs = [];
    this.markDirty();
  }

  public getMarkdownFiles(): readonly TFile[] {
    this.markdownFiles ??= [...this.app.vault.getMarkdownFiles()].sort(comparePaths);
    return this.markdownFiles;
  }

  public getFolders(): readonly TFolder[] {
    this.folders ??= [...this.app.vault.getAllFolders(false)].sort(comparePaths);
    return this.folders;
  }

  private markDirty(): void {
    this.markdownFiles = null;
    this.folders = null;
  }
}

export class PeriodicNoteFolderSuggest extends AbstractInputSuggest<TFolder> {
  public constructor(
    app: App,
    private readonly inputEl: HTMLInputElement,
    private readonly noteType: PeriodicNoteType,
    private readonly catalog: VaultPathSuggestionCatalog,
  ) {
    super(app, inputEl);
  }

  public getSuggestions(pattern: string): TFolder[] {
    return rankPaths(
      this.catalog.getFolders(),
      getPeriodicNoteFolderQuery(pattern),
      getSuggestionLimit(this.limit),
    );
  }

  public renderSuggestion(folder: TFolder, element: HTMLElement): void {
    renderPathSuggestion(element, folder.path, getPeriodicNoteFolderQuery(this.getValue()));
  }

  public selectSuggestion(folder: TFolder): void {
    this.setValue(setPeriodicNoteFolder(this.getValue(), folder.path, this.noteType));
    dispatchInput(this.inputEl);
    this.close();
  }
}

export class VaultFolderSuggest extends AbstractInputSuggest<TFolder> {
  public constructor(
    app: App,
    private readonly inputEl: HTMLInputElement,
    private readonly catalog: VaultPathSuggestionCatalog,
  ) {
    super(app, inputEl);
  }

  public getSuggestions(query: string): TFolder[] {
    return rankPaths(
      this.catalog.getFolders(),
      normalizeFolderQuery(query),
      getSuggestionLimit(this.limit),
    );
  }

  public renderSuggestion(folder: TFolder, element: HTMLElement): void {
    renderPathSuggestion(element, folder.path, normalizeFolderQuery(this.getValue()));
  }

  public selectSuggestion(folder: TFolder): void {
    this.setValue(folder.path);
    dispatchInput(this.inputEl);
    this.close();
  }
}

export class MarkdownFileSuggest extends AbstractInputSuggest<TFile> {
  public constructor(
    app: App,
    private readonly inputEl: HTMLInputElement,
    private readonly catalog: VaultPathSuggestionCatalog,
  ) {
    super(app, inputEl);
  }

  public getSuggestions(query: string): TFile[] {
    return rankPaths(
      this.catalog.getMarkdownFiles(),
      query.trim(),
      getSuggestionLimit(this.limit),
    );
  }

  public renderSuggestion(file: TFile, element: HTMLElement): void {
    renderPathSuggestion(element, file.path, this.getValue().trim());
  }

  public selectSuggestion(file: TFile): void {
    this.setValue(file.path);
    dispatchInput(this.inputEl);
    this.close();
  }
}

function rankPaths<T extends { readonly path: string }>(
  items: readonly T[],
  query: string,
  limit: number,
): T[] {
  if (query.length === 0) return items.slice(0, limit);

  const search = prepareFuzzySearch(query);
  const best: RankedPath<T>[] = [];
  for (const item of items) {
    const result = search(item.path);
    if (result === null) continue;
    const candidate = { item, result };
    if (best.length < limit) {
      best.push(candidate);
      siftRankedPathUp(best, best.length - 1);
    } else if (compareRankedPaths(candidate, best[0] as RankedPath<T>) < 0) {
      best[0] = candidate;
      siftRankedPathDown(best, 0);
    }
  }
  return best.sort(compareRankedPaths).map(({ item }) => item);
}

function siftRankedPathUp<T extends { readonly path: string }>(
  heap: RankedPath<T>[],
  index: number,
): void {
  while (index > 0) {
    const parentIndex = Math.floor((index - 1) / 2);
    const parent = heap[parentIndex];
    const current = heap[index];
    if (parent === undefined || current === undefined || compareRankedPaths(current, parent) <= 0) {
      return;
    }
    heap[parentIndex] = current;
    heap[index] = parent;
    index = parentIndex;
  }
}

function siftRankedPathDown<T extends { readonly path: string }>(
  heap: RankedPath<T>[],
  index: number,
): void {
  while (true) {
    const leftIndex = index * 2 + 1;
    const rightIndex = leftIndex + 1;
    let worstIndex = index;
    if (
      heap[leftIndex] !== undefined &&
      compareRankedPaths(heap[leftIndex] as RankedPath<T>, heap[worstIndex] as RankedPath<T>) > 0
    ) {
      worstIndex = leftIndex;
    }
    if (
      heap[rightIndex] !== undefined &&
      compareRankedPaths(heap[rightIndex] as RankedPath<T>, heap[worstIndex] as RankedPath<T>) > 0
    ) {
      worstIndex = rightIndex;
    }
    if (worstIndex === index) return;
    [heap[index], heap[worstIndex]] = [
      heap[worstIndex] as RankedPath<T>,
      heap[index] as RankedPath<T>,
    ];
    index = worstIndex;
  }
}

function compareRankedPaths<T extends { readonly path: string }>(
  left: RankedPath<T>,
  right: RankedPath<T>,
): number {
  return right.result.score - left.result.score || comparePaths(left.item, right.item);
}

function getSuggestionLimit(limit: number | undefined): number {
  return Number.isInteger(limit) && (limit ?? 0) > 0
    ? limit as number
    : DEFAULT_SUGGESTION_LIMIT;
}

function renderPathSuggestion(element: HTMLElement, path: string, query: string): void {
  const result = query.length === 0 ? null : prepareFuzzySearch(query)(path);
  if (result === null) {
    element.setText(path);
  } else {
    renderResults(element, path, result);
  }
}

function comparePaths(left: { readonly path: string }, right: { readonly path: string }): number {
  return left.path.localeCompare(right.path);
}

function normalizeFolderQuery(value: string): string {
  return value.trim().replaceAll("\\", "/");
}

function dispatchInput(input: HTMLInputElement): void {
  const EventConstructor = input.ownerDocument.defaultView?.Event ?? Event;
  input.dispatchEvent(new EventConstructor("input", { bubbles: true }));
}
