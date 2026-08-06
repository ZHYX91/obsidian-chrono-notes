import { describe, expect, it, vi } from "vitest";

import { notifyListeners } from "../../src/features/notify-listeners";

describe("notifyListeners", () => {
  it("uses a listener snapshot when subscriptions mutate during notification", () => {
    const listeners = new Set<() => void>();
    const added = vi.fn();
    const removed = vi.fn();
    const mutating = vi.fn(() => {
      listeners.delete(removed);
      listeners.add(added);
    });
    listeners.add(mutating);
    listeners.add(removed);

    notifyListeners(listeners);

    expect(mutating).toHaveBeenCalledOnce();
    expect(removed).toHaveBeenCalledOnce();
    expect(added).not.toHaveBeenCalled();

    notifyListeners(listeners);
    expect(removed).toHaveBeenCalledOnce();
    expect(added).toHaveBeenCalledOnce();
  });

  it("isolates both subscriber and error-reporter failures", () => {
    const reportError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {
        throw new Error("broken error reporter");
      });
    const remainingListener = vi.fn();

    try {
      expect(() => notifyListeners([
        () => {
          throw new Error("broken subscriber");
        },
        remainingListener,
      ])).not.toThrow();
      expect(reportError).toHaveBeenCalledOnce();
      expect(remainingListener).toHaveBeenCalledOnce();
    } finally {
      reportError.mockRestore();
    }
  });

  it("observes asynchronous subscriber rejections", async () => {
    const listenerError = new Error("async subscriber failed");
    const reportError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const remainingListener = vi.fn();

    try {
      notifyListeners([
        async () => Promise.reject(listenerError),
        remainingListener,
      ]);
      await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));

      expect(remainingListener).toHaveBeenCalledOnce();
      expect(reportError).toHaveBeenCalledWith(
        "Chrono Notes: listener notification failed",
        listenerError,
      );
    } finally {
      reportError.mockRestore();
    }
  });
});
