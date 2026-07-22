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

describe("note creation confirmation modals", () => {
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
