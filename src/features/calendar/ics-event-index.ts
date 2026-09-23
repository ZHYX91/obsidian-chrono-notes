import {
  buildIcsDateIndex,
  compareOccurrences,
  parseIcsCalendar,
  type IcsCalendarEvent,
  type IcsEventOccurrence,
} from "../../core/calendar/ics-calendar";
import { notifyListeners } from "../notify-listeners";

export interface IcsSourceReader {
  read(source: string): Promise<string>;
}

export interface IcsRefreshOptions {
  readonly enabled: boolean;
  readonly sources: readonly string[];
  readonly displayZone: string;
}

export interface IcsSourceStatus {
  readonly source: string;
  readonly sourceLabel: string;
  readonly eventCount: number;
  readonly skippedRecurring: number;
  readonly skippedInvalid: number;
  readonly error: string | null;
}

export interface IcsEventIndexSnapshot {
  readonly version: number;
  /** Advances only when calendar-visible occurrences change. */
  readonly contentVersion: number;
  readonly state: "disabled" | "refreshing" | "ready";
  readonly enabled: boolean;
  readonly totalSources: number;
  readonly loadedSources: number;
  readonly eventCount: number;
  readonly skippedRecurring: number;
  readonly skippedInvalid: number;
  readonly truncatedEvents: number;
  /** Present only when configured sources were omitted from this refresh. */
  readonly sourceLimit?: number;
  /** Present only when the global occurrence budget omitted event data. */
  readonly occurrenceLimit?: number;
  readonly refreshedAt: number | null;
  readonly sourceStatuses: readonly IcsSourceStatus[];
  readonly errors: readonly string[];
  readonly eventsByDate: Readonly<Record<string, readonly IcsEventOccurrence[]>>;
}

export interface IcsEventIndexOptions {
  readonly now?: () => number;
  readonly maxConcurrentReads?: number;
  readonly maxSources?: number;
  readonly maxOccurrences?: number;
}

export const DEFAULT_ICS_MAX_CONCURRENT_READS = 4;
export const DEFAULT_ICS_MAX_SOURCES = 32;

export class IcsEventIndex {
  private readonly listeners = new Set<() => void>();
  private readonly now: () => number;
  private readonly maxSources: number;
  private readonly maxOccurrences: number;
  private readonly readSlots: AsyncSlotLimiter;
  private activeRevision?: AbortController | null;
  private snapshot: IcsEventIndexSnapshot = createDisabledSnapshot(0);

  constructor(
    private readonly reader: IcsSourceReader,
    options: IcsEventIndexOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.maxSources = normalizePositiveLimit(options.maxSources, DEFAULT_ICS_MAX_SOURCES);
    this.maxOccurrences = normalizePositiveLimit(options.maxOccurrences, 100_000);
    this.readSlots = new AsyncSlotLimiter(normalizePositiveLimit(
      options.maxConcurrentReads,
      DEFAULT_ICS_MAX_CONCURRENT_READS,
    ));
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): IcsEventIndexSnapshot => this.snapshot;

  async refresh(options: IcsRefreshOptions): Promise<void> {
    if (this.activeRevision === null) return;
    this.activeRevision?.abort();
    const revision = this.activeRevision = new AbortController();
    const configuredSources = normalizeSources(options.sources);
    const sources = configuredSources.slice(0, this.maxSources);
    const omittedSources = configuredSources.length - sources.length;
    if (!options.enabled) {
      this.publish(createDisabledSnapshot(
        this.snapshot.version + 1,
        this.snapshot.contentVersion + (hasVisibleEvents(this.snapshot.eventsByDate) ? 1 : 0),
      ));
      return;
    }

    this.publish(Object.freeze({
      ...this.snapshot,
      version: this.snapshot.version + 1,
      state: "refreshing",
      enabled: true,
      totalSources: configuredSources.length,
    }));

    const pendingResults = await Promise.all(sources.map(async (source) => {
      const sourceLabel = getSourceLabel(source);
      try {
        const content = await this.startRead(source, revision.signal);
        if (content === null || revision.signal.aborted) return null;
        const parsed = parseIcsCalendar(content, source, { displayZone: options.displayZone });
        return {
          status: Object.freeze({
            source,
            sourceLabel,
            eventCount: parsed.events.length,
            skippedRecurring: parsed.skippedRecurring,
            skippedInvalid: parsed.skippedInvalid,
            error: null,
          }) satisfies IcsSourceStatus,
          events: parsed.events,
        };
      } catch (error) {
        if (revision.signal.aborted) return null;
        return {
          status: Object.freeze({
            source,
            sourceLabel,
            eventCount: 0,
            skippedRecurring: 0,
            skippedInvalid: 0,
            error: getErrorMessage(error),
          }) satisfies IcsSourceStatus,
          events: [],
        };
      }
    }));

    if (revision.signal.aborted) return;
    const results = pendingResults.filter((result) => result !== null);
    const events = results.flatMap((result) => result.events);
    const dateIndex = await this.buildDateIndex(events, revision.signal);
    if (dateIndex === null || revision.signal.aborted) return;
    const eventsByDate = reuseEventDateIndex(this.snapshot.eventsByDate, dateIndex[0]);
    const sourceStatuses = Object.freeze(results.map((result) => result.status));
    const errors = Object.freeze(sourceStatuses
      .filter((status) => status.error !== null)
      .map((status) => `${status.sourceLabel}: ${status.error}`));
    this.publish(Object.freeze({
      version: this.snapshot.version + 1,
      contentVersion: this.snapshot.contentVersion + (
        eventsByDate === this.snapshot.eventsByDate ? 0 : 1
      ),
      state: "ready",
      enabled: true,
      totalSources: configuredSources.length,
      loadedSources: sourceStatuses.filter((status) => status.error === null).length,
      eventCount: events.length,
      skippedRecurring: sum(sourceStatuses, "skippedRecurring"),
      skippedInvalid: sum(sourceStatuses, "skippedInvalid"),
      truncatedEvents: dateIndex[1],
      ...(omittedSources > 0 ? { sourceLimit: this.maxSources } : {}),
      ...(dateIndex[2] ? { occurrenceLimit: this.maxOccurrences } : {}),
      refreshedAt: this.now(),
      sourceStatuses,
      errors,
      eventsByDate,
    }));
  }

  stop(): void {
    if (this.activeRevision === null) return;
    this.activeRevision?.abort();
    this.activeRevision = null;
    this.listeners.clear();
    this.snapshot = createDisabledSnapshot(
      this.snapshot.version + 1,
      this.snapshot.contentVersion + (hasVisibleEvents(this.snapshot.eventsByDate) ? 1 : 0),
    );
  }

  private async buildDateIndex(
    events: readonly IcsCalendarEvent[],
    signal: AbortSignal,
  ): Promise<readonly [
    Readonly<Record<string, readonly IcsEventOccurrence[]>>,
    number,
    boolean,
  ] | null> {
    const mutable: Record<string, IcsEventOccurrence[]> = {};
    let remaining = this.maxOccurrences;
    let truncated = 0;

    outer: for (let index = 0; index < events.length; index += 1) {
      if (remaining === 0) {
        remaining = -1;
        truncated += events.length - index;
        break;
      }
      const expanded = buildIcsDateIndex([events[index]!]);
      truncated += expanded.truncatedEvents;
      for (const dateKey in expanded.eventsByDate) {
        if (remaining === 0) {
          remaining = -1;
          if (expanded.truncatedEvents === 0) truncated += 1;
          truncated += events.length - index - 1;
          break outer;
        }
        (mutable[dateKey] ??= []).push(expanded.eventsByDate[dateKey]![0]!);
        remaining -= 1;
      }
      if ((index & 63) === 63 && index + 1 < events.length) {
        await new Promise<void>((resolve) => window.setTimeout(resolve));
        if (signal.aborted) return null;
      }
    }

    for (const occurrences of Object.values(mutable)) {
      occurrences.sort(compareOccurrences);
      Object.freeze(occurrences);
    }
    return [Object.freeze(mutable), truncated, remaining < 0];
  }

  private async startRead(
    source: string,
    signal: AbortSignal,
  ): Promise<string | null> {
    const release = this.readSlots.acquireImmediately() ?? await this.readSlots.acquire();
    try {
      return await readUntilAborted(this.reader, source, signal);
    } finally {
      release();
    }
  }

  private publish(snapshot: IcsEventIndexSnapshot): void {
    if (this.activeRevision === null) return;
    this.snapshot = snapshot;
    notifyListeners(this.listeners);
  }
}

function readUntilAborted(
  reader: IcsSourceReader,
  source: string,
  signal: AbortSignal,
): Promise<string | null> {
  if (signal.aborted) return Promise.resolve(null);
  let pending: Promise<string>;
  try {
    pending = reader.read(source);
  } catch (error) {
    return Promise.reject(normalizeError(error));
  }
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      resolve(null);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    void pending.then(
      (content) => {
        signal.removeEventListener("abort", onAbort);
        resolve(content);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(normalizeError(error));
      },
    );
  });
}

class AsyncSlotLimiter {
  private available: number;
  private readonly queue: Array<(release: () => void) => void> = [];

  constructor(limit: number) {
    this.available = limit;
  }

  acquireImmediately(): (() => void) | null {
    if (this.available <= 0) return null;
    this.available -= 1;
    return this.createRelease();
  }

  acquire(): Promise<() => void> {
    const immediate = this.acquireImmediately();
    if (immediate !== null) return Promise.resolve(immediate);
    return new Promise((resolve) => this.queue.push(resolve));
  }

  private createRelease(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = this.queue.shift();
      if (next === undefined) this.available += 1;
      else next(this.createRelease());
    };
  }
}

function normalizePositiveLimit(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

function createDisabledSnapshot(
  version: number,
  contentVersion = 0,
): IcsEventIndexSnapshot {
  return Object.freeze({
    version,
    contentVersion,
    state: "disabled",
    enabled: false,
    totalSources: 0,
    loadedSources: 0,
    eventCount: 0,
    skippedRecurring: 0,
    skippedInvalid: 0,
    truncatedEvents: 0,
    refreshedAt: null,
    sourceStatuses: Object.freeze([]),
    errors: Object.freeze([]),
    eventsByDate: Object.freeze({}),
  });
}

function reuseEventDateIndex(
  previous: Readonly<Record<string, readonly IcsEventOccurrence[]>>,
  next: Readonly<Record<string, readonly IcsEventOccurrence[]>>,
): Readonly<Record<string, readonly IcsEventOccurrence[]>> {
  const previousKeys = Object.keys(previous);
  const nextKeys = Object.keys(next);
  let unchanged = previousKeys.length === nextKeys.length;
  const shared: Record<string, readonly IcsEventOccurrence[]> = Object.create(null) as Record<
    string,
    readonly IcsEventOccurrence[]
  >;

  for (const dateKey of nextKeys) {
    const nextEvents = next[dateKey];
    if (nextEvents === undefined) continue;
    const previousEvents = previous[dateKey];
    if (previousEvents !== undefined && equalOccurrences(previousEvents, nextEvents)) {
      shared[dateKey] = previousEvents;
    } else {
      shared[dateKey] = nextEvents;
      unchanged = false;
    }
  }

  if (unchanged && previousKeys.every((dateKey) => next[dateKey] !== undefined)) {
    return previous;
  }
  return Object.freeze(shared);
}

function equalOccurrences(
  left: readonly IcsEventOccurrence[],
  right: readonly IcsEventOccurrence[],
): boolean {
  if (left.length !== right.length) return false;
  return left.every((occurrence, index) => {
    const candidate = right[index];
    return candidate !== undefined &&
      occurrence.id === candidate.id &&
      occurrence.title === candidate.title &&
      occurrence.source === candidate.source &&
      occurrence.sourceLabel === candidate.sourceLabel &&
      occurrence.isAllDay === candidate.isAllDay &&
      occurrence.startsOnDate === candidate.startsOnDate &&
      occurrence.endsOnDate === candidate.endsOnDate &&
      occurrence.continuesBefore === candidate.continuesBefore &&
      occurrence.continuesAfter === candidate.continuesAfter &&
      occurrence.timeLabel === candidate.timeLabel &&
      occurrence.sortTimestamp === candidate.sortTimestamp;
  });
}

function hasVisibleEvents(
  eventsByDate: Readonly<Record<string, readonly IcsEventOccurrence[]>>,
): boolean {
  return Object.keys(eventsByDate).length > 0;
}

function normalizeSources(sources: readonly string[]): readonly string[] {
  const unique = new Set<string>();
  for (const source of sources) {
    const trimmed = source.trim();
    if (trimmed.length > 0) unique.add(trimmed);
  }
  return Object.freeze([...unique]);
}

function getSourceLabel(source: string): string {
  const normalized = source.replace(/[\\/]+$/, "");
  return normalized.split(/[\\/]/).at(-1) || normalized || source;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error;
  const message = typeof error === "string" && error.length > 0
    ? error
    : "ICS source reader failed";
  return new Error(message, { cause: error });
}

function sum(
  statuses: readonly IcsSourceStatus[],
  key: "skippedRecurring" | "skippedInvalid",
): number {
  return statuses.reduce((total, status) => total + status[key], 0);
}
