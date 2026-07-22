import { describe, expect, it, vi } from "vitest";

import {
  createNoteCreationConfirmationDecision,
  resolveNoteCreationConfirmation,
} from "../../src/features/notes/note-creation-confirmation";

describe("note creation confirmation", () => {
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
