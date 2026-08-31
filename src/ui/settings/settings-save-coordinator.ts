export interface SettingsSaveClock {
  readonly setTimeout: (callback: () => void, delayMs: number) => number;
  readonly clearTimeout: (handle: number) => void;
}

export interface SettingsSaveCoordinatorOptions {
  readonly delayMs: number;
  readonly onError: (error: unknown) => void;
  readonly clock?: SettingsSaveClock;
}

export type SettingsSaveStatus =
  | Readonly<{ readonly state: "idle" }>
  | Readonly<{ readonly state: "scheduled" }>
  | Readonly<{ readonly state: "saving" }>
  | Readonly<{ readonly state: "failed"; readonly error: unknown }>;

export type SettingsSaveStatusListener = (status: SettingsSaveStatus) => void;

const BROWSER_CLOCK: SettingsSaveClock = {
  setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
  clearTimeout: (handle) => window.clearTimeout(handle),
};

const IDLE_STATUS: SettingsSaveStatus = Object.freeze({ state: "idle" });
const SCHEDULED_STATUS: SettingsSaveStatus = Object.freeze({ state: "scheduled" });
const SAVING_STATUS: SettingsSaveStatus = Object.freeze({ state: "saving" });

export class SettingsSaveCoordinator {
  private readonly clock: SettingsSaveClock;
  private readonly delayMs: number;
  private readonly onError: (error: unknown) => void;
  private hasPendingSave = false;
  private pendingTimer: number | null = null;
  private latestSave: Promise<void> = Promise.resolve();
  private operationRevision = 0;
  private status: SettingsSaveStatus = IDLE_STATUS;
  private readonly statusListeners = new Set<SettingsSaveStatusListener>();

  constructor(
    private readonly saveSettings: () => Promise<void>,
    options: SettingsSaveCoordinatorOptions,
  ) {
    this.clock = options.clock ?? BROWSER_CLOCK;
    this.delayMs = options.delayMs;
    this.onError = options.onError;
  }

  schedule(): void {
    this.operationRevision += 1;
    this.hasPendingSave = true;
    this.setStatus(SCHEDULED_STATUS);
    this.cancelPendingTimer();
    this.pendingTimer = this.clock.setTimeout(() => {
      this.pendingTimer = null;
      this.saveInBackground();
    }, this.delayMs);
  }

  saveNow(): Promise<void> {
    this.cancelPendingTimer();
    this.hasPendingSave = false;
    const operationRevision = ++this.operationRevision;
    this.setStatus(SAVING_STATUS);

    let save: Promise<void>;
    try {
      save = this.saveSettings();
    } catch (error) {
      this.recordFailure(operationRevision, error);
      return Promise.resolve().then(() => {
        throw error;
      });
    }

    const observedSave = save.then(
      () => {
        if (operationRevision === this.operationRevision) {
          this.setStatus(IDLE_STATUS);
        }
      },
      (error: unknown) => {
        this.recordFailure(operationRevision, error);
        throw error;
      },
    );
    this.latestSave = observedSave.catch(() => undefined);
    return observedSave;
  }

  retry(): Promise<void> {
    return this.status.state === "failed"
      ? this.saveNow()
      : this.latestSave;
  }

  retryInBackground(): void {
    void this.retry().catch((error: unknown) => this.reportError(error));
  }

  getStatus(): SettingsSaveStatus {
    return this.status;
  }

  subscribe(listener: SettingsSaveStatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  flush(): Promise<void> {
    return this.hasPendingSave
      ? this.saveNow()
      : this.latestSave;
  }

  flushInBackground(): void {
    void this.flush().catch((error: unknown) => this.reportError(error));
  }

  /** Flushes the current visible-tab lifecycle; the coordinator remains reusable. */
  close(): void {
    this.flushInBackground();
  }

  private saveInBackground(): void {
    void this.saveNow().catch((error: unknown) => this.reportError(error));
  }

  private reportError(error: unknown): void {
    try {
      this.onError(error);
    } catch {
      // Background error reporting must not create another rejected promise.
    }
  }

  private recordFailure(operationRevision: number, error: unknown): void {
    if (operationRevision !== this.operationRevision) return;
    this.setStatus(Object.freeze({ state: "failed", error }));
  }

  private setStatus(status: SettingsSaveStatus): void {
    this.status = status;
    for (const listener of [...this.statusListeners]) {
      try {
        listener(status);
      } catch {
        // Presentation listeners must not change persistence semantics.
      }
    }
  }

  private cancelPendingTimer(): void {
    if (this.pendingTimer === null) return;
    this.clock.clearTimeout(this.pendingTimer);
    this.pendingTimer = null;
  }
}
