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

import { yieldToHost } from "../../shared/yield-to-host";
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
const PATH_BATCH = 256;

interface PathSnapshot<T> {
  items: readonly T[];
  sorted?: boolean;
  sorting?: Generator<void, void>;
}

export class VaultPathSuggestionCatalog {
  private markdownFiles: PathSnapshot<TFile> | null = null;
  private folders: PathSnapshot<TFolder> | null = null;
  private eventRefs: EventRef[] = [];

  revision = 0;
  private lifetime = new AbortController();

  get signal(): AbortSignal { return this.lifetime.signal; }

  public constructor(private readonly app: App) {}

  public start(): void {
    if (this.eventRefs.length > 0) return;
    if (this.lifetime.signal.aborted) this.lifetime = new AbortController();
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
    this.lifetime.abort();
    this.markDirty();
  }

  public getMarkdownFiles(): PathSnapshot<TFile> {
    this.markdownFiles ??= { items: this.app.vault.getMarkdownFiles() };
    return this.markdownFiles;
  }

  public getFolders(): PathSnapshot<TFolder> {
    this.folders ??= { items: this.app.vault.getAllFolders(false) };
    return this.folders;
  }

  private markDirty(): void {
    this.revision++;
    this.markdownFiles = null;
    this.folders = null;
  }
}

abstract class VaultPathSuggest<T extends { readonly path: string }> extends AbstractInputSuggest<T> {
  private latest: { result: T[] | Promise<T[]> } | null = null;

  constructor(app: App, protected readonly inputEl: HTMLInputElement, protected readonly catalog: VaultPathSuggestionCatalog) {
    super(app, inputEl);
  }

  protected abstract paths(): PathSnapshot<T>;
  protected abstract query(value: string): string;

  public getSuggestions(value: string): T[] | Promise<T[]> {
    const lifetime = this.catalog.signal;
    if (lifetime.aborted) return [];
    const request: { result: T[] | Promise<T[]> } = { result: [] };
    this.latest = request;
    const revision = this.catalog.revision;
    const ranking = rankPaths(this.paths(), this.query(value), getSuggestionLimit(this.limit));
    const resume = (): T[] | Promise<T[]> => {
      // Host versions may display each resolved Promise regardless of input order.
      if (this.latest !== request) return this.latest?.result ?? [];
      if (lifetime.aborted) return [];
      if (this.catalog.revision !== revision) return this.getSuggestions(value);
      const start = performance.now();
      for (let batch = 0; batch < 4; batch++) {
        const next = ranking.next();
        if (next.done) return next.value;
        if (performance.now() - start >= 4) break;
      }
      return yieldToHost().then(resume);
    };
    request.result = resume();
    return request.result;
  }

  override close(): void {
    this.latest = null;
    super.close();
  }
}

export class PeriodicNoteFolderSuggest extends VaultPathSuggest<TFolder> {
  public constructor(app: App, inputEl: HTMLInputElement, private readonly noteType: PeriodicNoteType, catalog: VaultPathSuggestionCatalog) {
    super(app, inputEl, catalog);
  }

  protected paths(): PathSnapshot<TFolder> { return this.catalog.getFolders(); }
  protected query(pattern: string): string { return getPeriodicNoteFolderQuery(pattern); }

  public renderSuggestion(folder: TFolder, element: HTMLElement): void {
    renderPathSuggestion(element, folder.path, getPeriodicNoteFolderQuery(this.getValue()));
  }

  public selectSuggestion(folder: TFolder): void {
    this.setValue(setPeriodicNoteFolder(this.getValue(), folder.path, this.noteType));
    dispatchInput(this.inputEl);
    this.close();
  }
}

export class VaultFolderSuggest extends VaultPathSuggest<TFolder> {
  protected paths(): PathSnapshot<TFolder> { return this.catalog.getFolders(); }
  protected query(query: string): string { return normalizeFolderQuery(query); }

  public renderSuggestion(folder: TFolder, element: HTMLElement): void {
    renderPathSuggestion(element, folder.path, normalizeFolderQuery(this.getValue()));
  }

  public selectSuggestion(folder: TFolder): void {
    this.setValue(folder.path);
    dispatchInput(this.inputEl);
    this.close();
  }
}

export class MarkdownFileSuggest extends VaultPathSuggest<TFile> {
  protected paths(): PathSnapshot<TFile> { return this.catalog.getMarkdownFiles(); }
  protected query(query: string): string { return query.trim(); }

  public renderSuggestion(file: TFile, element: HTMLElement): void {
    renderPathSuggestion(element, file.path, this.getValue().trim());
  }

  public selectSuggestion(file: TFile): void {
    this.setValue(file.path);
    dispatchInput(this.inputEl);
    this.close();
  }
}

// A cold catalog must yield during its stable path sort, too. Keep the sorted
// snapshot for subsequent inputs and retain localeCompare's ordering of ties.
function* sortPaths<T extends { readonly path: string }>(snapshot: PathSnapshot<T>): Generator<void, void> {
  const items = snapshot.items;
  let runs: T[][] = [];
  for (let i = 0; i < items.length; i += PATH_BATCH) {
    runs.push(items.slice(i, i + PATH_BATCH).sort(comparePaths));
    if (items.length > PATH_BATCH) yield;
  }
  while (runs.length > 1) {
    const next: T[][] = [];
    for (let i = 0; i < runs.length; i += 2) {
      const left = runs[i]!;
      const right = runs[i + 1];
      if (!right) {
        next.push(left);
        continue;
      }
      const merged: T[] = [];
      let leftIndex = 0;
      let rightIndex = 0;
      while (leftIndex < left.length || rightIndex < right.length) {
        if (rightIndex === right.length || (leftIndex < left.length && comparePaths(left[leftIndex]!, right[rightIndex]!) <= 0)) {
          merged.push(left[leftIndex++]!);
        } else {
          merged.push(right[rightIndex++]!);
        }
        if (merged.length % PATH_BATCH === 0) yield;
      }
      next.push(merged);
    }
    runs = next;
  }
  snapshot.items = runs[0] ?? [];
  snapshot.sorted = true;
  delete snapshot.sorting;
}

function* rankPaths<T extends { readonly path: string }>(
  snapshot: PathSnapshot<T>,
  query: string,
  limit: number,
): Generator<void, T[]> {
  if (!snapshot.sorted) {
    // Request changes and separate inputs can continue the same cold sort.
    const sorting = snapshot.sorting ??= sortPaths(snapshot);
    while (!sorting.next().done) yield;
  }
  const items = snapshot.items;
  if (query.length === 0) return items.slice(0, limit);

  const search = prepareFuzzySearch(query);
  const best: RankedPath<T>[] = [];
  for (let i = 0; i < items.length; i++) {
    if (i > 0 && i % PATH_BATCH === 0) yield;
    const item = items[i]!;
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
    const left = heap[leftIndex];
    const currentWorst = heap[worstIndex];
    if (
      left !== undefined &&
      currentWorst !== undefined &&
      compareRankedPaths(left, currentWorst) > 0
    ) {
      worstIndex = leftIndex;
    }
    const right = heap[rightIndex];
    const updatedWorst = heap[worstIndex];
    if (
      right !== undefined &&
      updatedWorst !== undefined &&
      compareRankedPaths(right, updatedWorst) > 0
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
