export interface LongPressClock {
  setTimeout(callback: () => void, delay: number): number;
  clearTimeout(handle: number): void;
}

const LONG_PRESS_DELAY_MS = 500;

export interface LongPressBinding {
  onTouchStart(): void;
  onTouchMove(): void;
  onTouchEnd(): void;
  onTouchCancel(): void;
  onContextMenu(): void;
  consumeClick(): boolean;
}

export interface LongPressBindingOptions {
  readonly preferContextMenu?: boolean;
}

export class LongPressGesture {
  private thresholdTimer: number | null = null;
  private commitTimer: number | null = null;
  private action: (() => void) | null = null;
  private preferContextMenu = false;
  private thresholdReached = false;
  private suppressNextClick = false;

  constructor(private readonly clock: LongPressClock) {}

  start(action: () => void, options: LongPressBindingOptions = {}): void {
    this.clearPendingAction();
    this.suppressNextClick = false;
    this.action = action;
    this.preferContextMenu = options.preferContextMenu ?? false;
    this.thresholdTimer = this.clock.setTimeout(() => {
      this.thresholdTimer = null;
      this.suppressNextClick = true;
      if (this.preferContextMenu) {
        this.thresholdReached = true;
        return;
      }
      this.commitAction();
    }, LONG_PRESS_DELAY_MS);
  }

  move(): void {
    this.clearPendingAction();
  }

  end(): void {
    this.clearThresholdTimer();
    if (!this.thresholdReached || this.action === null) {
      this.clearActionState();
      return;
    }

    // Android may dispatch the synthetic contextmenu immediately after
    // touchend. Commit in the next task so that contextmenu can claim the
    // gesture first instead of opening both a note and its date menu.
    this.commitTimer = this.clock.setTimeout(() => {
      this.commitTimer = null;
      this.commitAction();
    }, 0);
  }

  cancel(): void {
    this.clearPendingAction();
    this.suppressNextClick = false;
  }

  contextMenu(): void {
    if (!this.preferContextMenu || this.action === null) return;
    this.clearPendingAction();
    this.suppressNextClick = true;
  }

  consumeClick(): boolean {
    if (!this.suppressNextClick) return false;
    this.suppressNextClick = false;
    return true;
  }

  dispose(): void {
    this.clearPendingAction();
    this.suppressNextClick = false;
  }

  private commitAction(): void {
    const action = this.action;
    this.clearActionState();
    action?.();
  }

  private clearPendingAction(): void {
    this.clearThresholdTimer();
    if (this.commitTimer !== null) {
      this.clock.clearTimeout(this.commitTimer);
      this.commitTimer = null;
    }
    this.clearActionState();
  }

  private clearThresholdTimer(): void {
    if (this.thresholdTimer === null) return;
    this.clock.clearTimeout(this.thresholdTimer);
    this.thresholdTimer = null;
  }

  private clearActionState(): void {
    this.action = null;
    this.preferContextMenu = false;
    this.thresholdReached = false;
  }
}

export function bindLongPress(
  gesture: LongPressGesture,
  action: () => void,
  options: LongPressBindingOptions = {},
): LongPressBinding {
  return {
    onTouchStart: () => gesture.start(action, options),
    onTouchMove: () => gesture.move(),
    onTouchEnd: () => gesture.end(),
    onTouchCancel: () => gesture.cancel(),
    onContextMenu: () => gesture.contextMenu(),
    consumeClick: () => gesture.consumeClick(),
  };
}
