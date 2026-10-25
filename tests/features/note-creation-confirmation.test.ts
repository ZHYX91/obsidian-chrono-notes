import { describe, expect, it, vi } from "vitest";

import {
  createNoteCreationConfirmationDecision,
  resolveNoteCreationConfirmation,
  type NoteCreationConfirmationDecision,
} from "../../src/features/notes/note-creation-confirmation";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("note creation confirmation", () => {
  it("rejects an already stopped runtime before requesting a decision", async () => {
    const controller = new AbortController();
    controller.abort();
    const requestDecision = vi.fn(async () => createNoteCreationConfirmationDecision(true, true));
    const suppressFuture = vi.fn(async () => undefined);

    await expect(resolveNoteCreationConfirmation(
      requestDecision, suppressFuture, controller.signal,
    )).rejects.toMatchObject({ details: { code: "noteCreationStopped" } });
    expect(requestDecision).not.toHaveBeenCalled();
    expect(suppressFuture).not.toHaveBeenCalled();
  });

  it("rejects a late confirmation without saving the suppression preference", async () => {
    const controller = new AbortController();
    const decision = deferred<NoteCreationConfirmationDecision>();
    const suppressFuture = vi.fn(async () => undefined);
    const result = resolveNoteCreationConfirmation(
      () => decision.promise, suppressFuture, controller.signal,
    );
    const rejected = expect(result).rejects.toMatchObject({
      details: { code: "noteCreationStopped" },
    });

    controller.abort();
    decision.resolve(createNoteCreationConfirmationDecision(true, true));

    await rejected;
    expect(suppressFuture).not.toHaveBeenCalled();
  });

  it("does not authorize creation after an already dispatched save settles in a stopped runtime", async () => {
    const controller = new AbortController();
    const saveStarted = deferred<void>();
    const saved = deferred<void>();
    const suppressFuture = vi.fn(async () => {
      saveStarted.resolve();
      await saved.promise;
    });
    const result = resolveNoteCreationConfirmation(
      async () => createNoteCreationConfirmationDecision(true, true),
      suppressFuture,
      controller.signal,
    );
    const rejected = expect(result).rejects.toMatchObject({
      details: { code: "noteCreationStopped" },
    });

    await saveStarted.promise;
    controller.abort();
    saved.resolve();

    await rejected;
    expect(suppressFuture).toHaveBeenCalledOnce();
  });

  it("cannot suppress future confirmation from a cancelled modal", () => {
    expect(createNoteCreationConfirmationDecision(false, true)).toEqual({
      confirmed: false,
      suppressFutureConfirmation: false,
    });
  });

  it("returns cancellation without persisting a preference", async () => {
    const suppressFuture = vi.fn(async () => undefined);

    await expect(resolveNoteCreationConfirmation(
      async () => createNoteCreationConfirmationDecision(false, false),
      suppressFuture,
    )).resolves.toBe(false);
    expect(suppressFuture).not.toHaveBeenCalled();
  });

  it("confirms without persisting when the option is not selected", async () => {
    const suppressFuture = vi.fn(async () => undefined);

    await expect(resolveNoteCreationConfirmation(
      async () => createNoteCreationConfirmationDecision(true, false),
      suppressFuture,
    )).resolves.toBe(true);
    expect(suppressFuture).not.toHaveBeenCalled();
  });

  it("persists before returning a confirmed result when the option is selected", async () => {
    const order: string[] = [];

    await expect(resolveNoteCreationConfirmation(
      async () => {
        order.push("decision");
        return createNoteCreationConfirmationDecision(true, true);
      },
      async () => {
        order.push("persist");
      },
    )).resolves.toBe(true);
    expect(order).toEqual(["decision", "persist"]);
  });
});
