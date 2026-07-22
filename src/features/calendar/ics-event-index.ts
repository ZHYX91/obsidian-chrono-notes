import {
  buildIcsDateIndex,
  parseIcsCalendar,
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
  readonly refreshedAt: number | null;
  readonly sourceStatuses: readonly IcsSourceStatus[];
  readonly errors: readonly string[];
  readonly eventsByDate: Readonly<Record<string, readonly IcsEventOccurrence[]>>;
}

export interface IcsEventIndexOptions {
  readonly now?: () => number;
}

interface CoordinatedRead {
  readonly revision: number;
  readonly promise: Promise<string | null>;
}

export class IcsEventIndex {
  private readonly listeners = new Set<() => void>();
  private readonly inFlightReads = new Map<string, CoordinatedRead>();
  private readonly now: () => number;
  private requestRevision = 0;
  private stopped = false;
  private snapshot: IcsEventIndexSnapshot = createDisabledSnapshot(0);

  constructor(
    private readonly reader: IcsSourceReader,
    options: IcsEventIndexOptions = {},
  ) {
    this.now = options.now ?? Date.now;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): IcsEventIndexSnapshot => this.snapshot;

  async refresh(options: IcsRefreshOptions): Promise<void> {
    if (this.stopped) return;
    const revision = ++this.requestRevision;
    const sources = normalizeSources(options.sources);
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
      totalSources: sources.length,
    }));

    const pendingResults = await Promise.all(sources.map(async (source) => {
      const sourceLabel = getSourceLabel(source);
      try {
        const content = await this.readForRevision(source, revision);
        // Parsing can be materially more expensive than the read itself. A
        // superseded request must not consume that work or expose its content.
        if (content === null || this.stopped || revision !== this.requestRevision) {
          return null;
        }
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
        if (this.stopped || revision !== this.requestRevision) return null;
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

    if (this.stopped || revision !== this.requestRevision) return;
    const results = pendingResults.filter((result) => result !== null);
    const events = results.flatMap((result) => result.events);
    const dateIndex = buildIcsDateIndex(events);
    const eventsByDate = reuseEventDateIndex(
      this.snapshot.eventsByDate,
      dateIndex.eventsByDate,
    );
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
      totalSources: sourceStatuses.length,
      loadedSources: sourceStatuses.filter((status) => status.error === null).length,
      eventCount: events.length,
      skippedRecurring: sum(sourceStatuses, "skippedRecurring"),
      skippedInvalid: sum(sourceStatuses, "skippedInvalid"),
      truncatedEvents: dateIndex.truncatedEvents,
      refreshedAt: this.now(),
      sourceStatuses,
      errors,
      eventsByDate,
    }));
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.requestRevision += 1;
    this.listeners.clear();
    this.inFlightReads.clear();
    this.snapshot = createDisabledSnapshot(
      this.snapshot.version + 1,
      this.snapshot.contentVersion + (hasVisibleEvents(this.snapshot.eventsByDate) ? 1 : 0),
    );
  }

  private readForRevision(source: string, revision: number): Promise<string | null> {
    const existing = this.inFlightReads.get(source);
    if (existing?.revision === revision) return existing.promise;

    // A later revision starts a genuinely fresh read immediately. Waiting for
    // an older source promise could indefinitely block the authoritative
    // refresh; the revision gates discard that older result instead.
    const pending = this.startRead(source, revision);
    const coordinated = { revision, promise: pending };
    this.inFlightReads.set(source, coordinated);
    const cleanup = () => {
      if (this.inFlightReads.get(source) === coordinated) {
        this.inFlightReads.delete(source);
      }
    };
    void pending.then(cleanup, cleanup);
    return pending;
  }

  private startRead(source: string, revision: number): Promise<string | null> {
    if (this.stopped || revision !== this.requestRevision) return Promise.resolve(null);
    try {
      return Promise.resolve(this.reader.read(source));
    } catch (error) {
      return Promise.reject(error);
    }
  }

  private publish(snapshot: IcsEventIndexSnapshot): void {
    if (this.stopped) return;
    this.snapshot = snapshot;
    notifyListeners(this.listeners);
  }
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

function sum(
  statuses: readonly IcsSourceStatus[],
  key: "skippedRecurring" | "skippedInvalid",
): number {
  return statuses.reduce((total, status) => total + status[key], 0);
}
