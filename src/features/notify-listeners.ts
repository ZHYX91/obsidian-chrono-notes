type Listener = () => unknown;

/**
 * Notify independent observers without allowing one failure to interrupt the
 * publisher or the remaining observers.
 */
export function notifyListeners(listeners: Iterable<Listener>): void {
  // A listener may subscribe or unsubscribe while handling a publication.
  // Iterate the publication-time snapshot so those mutations affect only the
  // next publication and cannot skip or duplicate observers in this one.
  for (const listener of [...listeners]) {
    try {
      const result = listener();
      if (isPromiseLike(result)) {
        void Promise.resolve(result).catch(reportListenerError);
      }
    } catch (error) {
      reportListenerError(error);
    }
  }
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === "object" && value !== null) ||
    typeof value === "function"
  ) && typeof (value as { readonly then?: unknown }).then === "function";
}

function reportListenerError(error: unknown): void {
  try {
    console.error("Chrono Notes: listener notification failed", error);
  } catch {
    // Error reporting must not break snapshot publication either.
  }
}
