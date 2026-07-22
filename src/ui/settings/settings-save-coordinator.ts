export interface SettingsSaveClock {
  setTimeout(callback: () => void, delayMs: number): number;
  clearTimeout(handle: number): void;
}

export interface SettingsSaveCoordinatorOptions {
  delayMs: number;
  onError(error: unknown): void;
  clock?: SettingsSaveClock;
}

const BROWSER_CLOCK: SettingsSaveClock = {
  setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
  clearTimeout: (handle) => window.clearTimeout(handle),
};

export class SettingsSaveCoordinator {
  private readonly clock: SettingsSaveClock;
  private readonly delayMs: number;
  private readonly onError: (error: unknown) => void;
  private hasPendingSave = false;
  private pendingTimer: number | null = null;
  private latestSave: Promise<void> = Promise.resolve();

  constructor(
    private readonly saveSettings: () => Promise<void>,
    options: SettingsSaveCoordinatorOptions,
  ) {
    this.clock = options.clock ?? BROWSER_CLOCK;
    this.delayMs = options.delayMs;
    this.onError = options.onError;
  }

  schedule(): void {
    this.hasPendingSave = true;
    this.cancelPendingTimer();
    this.pendingTimer = this.clock.setTimeout(() => {
      this.pendingTimer = null;
      this.saveInBackground();
    }, this.delayMs);
  }

  saveNow(): Promise<void> {
    this.cancelPendingTimer();
    this.hasPendingSave = false;
    const save = this.saveSettings();
    this.latestSave = save.catch(() => undefined);
    return save;
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

  private cancelPendingTimer(): void {
    if (this.pendingTimer === null) return;
    this.clock.clearTimeout(this.pendingTimer);
    this.pendingTimer = null;
  }
}
