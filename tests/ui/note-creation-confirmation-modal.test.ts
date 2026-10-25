import { describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => {
  class Modal {
    readonly contentEl = { empty: vi.fn() };

    open(): void {}
    close(): void {}
  }

  return {
    Modal,
    Setting: class {},
  };
});

import { buildIntervalNoteSpec } from "../../src/core/note/interval-note-spec";
import { createTranslator } from "../../src/shared/i18n";
import { ConfirmIntervalNoteModal } from "../../src/ui/modals/confirm-interval-note-modal";
import { ConfirmPeriodicNoteModal } from "../../src/ui/modals/confirm-periodic-note-modal";

interface ControllableConfirmationModal {
  suppressFutureConfirmation: boolean;
  finish(confirmed: boolean): void;
}

function createModal(kind: "periodic" | "interval") {
  const translator = createTranslator("en", "en");
  return kind === "periodic"
    ? new ConfirmPeriodicNoteModal({} as never, "Daily/2026-07-18.md", translator)
    : new ConfirmIntervalNoteModal(
        {} as never,
        buildIntervalNoteSpec(
          { year: 2026, month: 7, day: 18 },
          { year: 2026, month: 7, day: 20 },
          "Ranges",
        ),
        translator,
      );
}

describe("note creation confirmation modals", () => {
  it.each(["periodic", "interval"] as const)(
    "does not open a %s confirmation for an already stopped runtime",
    async (kind) => {
      const controller = new AbortController();
      controller.abort();
      const modal = createModal(kind);
      const open = vi.spyOn(modal, "open");
      const addListener = vi.spyOn(controller.signal, "addEventListener");

      await expect(modal.confirm(controller.signal)).resolves.toEqual({
        confirmed: false,
        suppressFutureConfirmation: false,
      });

      expect(open).not.toHaveBeenCalled();
      expect(addListener).not.toHaveBeenCalled();
    },
  );

  it.each(["periodic", "interval"] as const)(
    "closes the old %s confirmation on abort and ignores its late confirm callback",
    async (kind) => {
      const controller = new AbortController();
      const modal = createModal(kind);
      const open = vi.spyOn(modal, "open");
      const close = vi.spyOn(modal, "close");
      const addListener = vi.spyOn(controller.signal, "addEventListener");
      const removeListener = vi.spyOn(controller.signal, "removeEventListener");
      const result = modal.confirm(controller.signal);
      const controllable = modal as unknown as ControllableConfirmationModal;
      controllable.suppressFutureConfirmation = true;

      controller.abort();
      controllable.finish(true);

      await expect(result).resolves.toEqual({
        confirmed: false,
        suppressFutureConfirmation: false,
      });
      expect(open).toHaveBeenCalledOnce();
      expect(close).toHaveBeenCalledOnce();
      expect(removeListener).toHaveBeenCalledExactlyOnceWith(
        "abort", addListener.mock.calls[0]?.[1],
      );
    },
  );

  it.each(["periodic", "interval"] as const)(
    "removes the %s abort listener when confirmation completes normally",
    async (kind) => {
      const controller = new AbortController();
      const modal = createModal(kind);
      const close = vi.spyOn(modal, "close");
      const addListener = vi.spyOn(controller.signal, "addEventListener");
      const removeListener = vi.spyOn(controller.signal, "removeEventListener");
      const result = modal.confirm(controller.signal);
      const controllable = modal as unknown as ControllableConfirmationModal;
      controllable.suppressFutureConfirmation = true;

      controllable.finish(true);
      await expect(result).resolves.toEqual({
        confirmed: true,
        suppressFutureConfirmation: true,
      });
      expect(removeListener).toHaveBeenCalledExactlyOnceWith(
        "abort", addListener.mock.calls[0]?.[1],
      );

      controller.abort();
      expect(close).toHaveBeenCalledOnce();
    },
  );

  it("treats closing a checked periodic modal as cancellation without suppression", async () => {
    const modal = new ConfirmPeriodicNoteModal(
      {} as never,
      "Daily/2026-07-18.md",
      createTranslator("en", "en"),
    );
    const result = modal.confirm();
    const controllable = modal as unknown as ControllableConfirmationModal;
    controllable.suppressFutureConfirmation = true;

    modal.onClose();

    await expect(result).resolves.toEqual({
      confirmed: false,
      suppressFutureConfirmation: false,
    });
  });

  it("returns suppression only when periodic creation is confirmed", async () => {
    const modal = new ConfirmPeriodicNoteModal(
      {} as never,
      "Daily/2026-07-18.md",
      createTranslator("en", "en"),
    );
    const result = modal.confirm();
    const controllable = modal as unknown as ControllableConfirmationModal;
    controllable.suppressFutureConfirmation = true;

    controllable.finish(true);

    await expect(result).resolves.toEqual({
      confirmed: true,
      suppressFutureConfirmation: true,
    });
  });

  it("applies the same cancellation boundary to interval creation", async () => {
    const modal = new ConfirmIntervalNoteModal(
      {} as never,
      buildIntervalNoteSpec(
        { year: 2026, month: 7, day: 18 },
        { year: 2026, month: 7, day: 20 },
        "Ranges",
      ),
      createTranslator("en", "en"),
    );
    const result = modal.confirm();
    const controllable = modal as unknown as ControllableConfirmationModal;
    controllable.suppressFutureConfirmation = true;

    modal.onClose();

    await expect(result).resolves.toEqual({
      confirmed: false,
      suppressFutureConfirmation: false,
    });
  });
});
