import { describe, expect, it, vi } from "vitest";

import {
  SettingsSaveCoordinator,
  type SettingsSaveClock,
} from "../../src/ui/settings/settings-save-coordinator";

class FakeClock implements SettingsSaveClock {
  private nextHandle = 1;
  private readonly callbacks = new Map<number, () => void>();

  setTimeout(callback: () => void, _delayMs: number): number {
    const handle = this.nextHandle++;
    this.callbacks.set(handle, callback);
    return handle;
  }

  clearTimeout(handle: number): void {
    this.callbacks.delete(handle);
  }

  fireAll(): void {
    const callbacks = [...this.callbacks.values()];
    this.callbacks.clear();
    for (const callback of callbacks) callback();
  }

  get pending(): number {
    return this.callbacks.size;
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("SettingsSaveCoordinator", () => {
  it("debounces scheduled saves and keeps only the latest timer", async () => {
    const clock = new FakeClock();
    const saveSettings = vi.fn(async () => undefined);
    const coordinator = new SettingsSaveCoordinator(saveSettings, {
      delayMs: 300,
      onError: vi.fn(),
      clock,
    });

    coordinator.schedule();
    coordinator.schedule();
    coordinator.schedule();

    expect(clock.pending).toBe(1);
    expect(saveSettings).not.toHaveBeenCalled();
    clock.fireAll();
    await coordinator.flush();

    expect(saveSettings).toHaveBeenCalledOnce();
  });

  it("flushes pending edits immediately and waits for the active save", async () => {
    const clock = new FakeClock();
    const pendingSave = deferred<void>();
    const saveSettings = vi.fn(() => pendingSave.promise);
    const coordinator = new SettingsSaveCoordinator(saveSettings, {
      delayMs: 300,
      onError: vi.fn(),
      clock,
    });

    coordinator.schedule();
    const flush = coordinator.flush();

    expect(clock.pending).toBe(0);
    expect(saveSettings).toHaveBeenCalledOnce();
    let settled = false;
    void flush.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    pendingSave.resolve();
    await flush;
    expect(settled).toBe(true);
  });

  it("delegates save ordering to the shared persistence boundary", async () => {
    const first = deferred<void>();
    const second = deferred<void>();
    const saveSettings = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const coordinator = new SettingsSaveCoordinator(saveSettings, {
      delayMs: 300,
      onError: vi.fn(),
      clock: new FakeClock(),
    });

    const firstSave = coordinator.saveNow();
    const secondSave = coordinator.saveNow();

    expect(saveSettings).toHaveBeenCalledTimes(2);
    first.resolve();
    second.resolve();
    await Promise.all([firstSave, secondSave]);
  });

  it("reports background failures without changing direct-save rejection semantics", async () => {
    const clock = new FakeClock();
    const error = new Error("disk full");
    const onError = vi.fn();
    const saveSettings = vi.fn(() => Promise.reject(error));
    const coordinator = new SettingsSaveCoordinator(saveSettings, {
      delayMs: 300,
      onError,
      clock,
    });

    await expect(coordinator.saveNow()).rejects.toBe(error);
    expect(onError).not.toHaveBeenCalled();

    coordinator.schedule();
    clock.fireAll();
    await Promise.resolve();
    await Promise.resolve();
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(error);
    await expect(coordinator.flush()).resolves.toBeUndefined();
  });

  it("flushes and reports a pending failure when the tab lifecycle closes", async () => {
    const clock = new FakeClock();
    const error = new Error("permission denied");
    const onError = vi.fn();
    const coordinator = new SettingsSaveCoordinator(
      () => Promise.reject(error),
      { delayMs: 300, onError, clock },
    );

    coordinator.schedule();
    coordinator.close();
    await Promise.resolve();
    await Promise.resolve();

    expect(clock.pending).toBe(0);
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(error);
  });

  it("contains failures from the background error reporter", async () => {
    const clock = new FakeClock();
    const onError = vi.fn(() => {
      throw new Error("reporting failed");
    });
    const coordinator = new SettingsSaveCoordinator(
      () => Promise.reject(new Error("save failed")),
      {
        delayMs: 300,
        onError,
        clock,
      },
    );

    coordinator.schedule();
    clock.fireAll();
    await Promise.resolve();
    await Promise.resolve();
    expect(onError).toHaveBeenCalledOnce();
  });
});
