import { describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => {
  class Modal {
    readonly contentEl = {
      empty: vi.fn(),
    };

    close(): void {
      (this as unknown as { onClose(): void }).onClose();
    }

    onClose(): void {}
  }

  return {
    Modal,
    Notice: class {},
    Setting: class {},
  };
});

import { createTranslator } from "../../src/shared/i18n";
import { CreateIntervalNoteModal } from "../../src/ui/modals/create-interval-note-modal";

describe("CreateIntervalNoteModal", () => {
  it("reports cancellation when it closes before submission", () => {
    const onCancel = vi.fn();
    const modal = new CreateIntervalNoteModal(
      {} as never,
      { year: 2026, month: 7, day: 14 },
      createTranslator("zh-CN", "en"),
      vi.fn(),
      onCancel,
    );

    modal.onClose();

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("does not report cancellation after submitting the default range", () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const modal = new CreateIntervalNoteModal(
      {} as never,
      { year: 2026, month: 7, day: 14 },
      createTranslator("zh-CN", "en"),
      onSubmit,
      onCancel,
    );

    (modal as unknown as { submit(): void }).submit();

    expect(onSubmit).toHaveBeenCalledWith(
      { year: 2026, month: 7, day: 14 },
      { year: 2026, month: 7, day: 15 },
    );
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("submits both prefilled drag endpoints instead of replacing the end with next day", () => {
    const onSubmit = vi.fn();
    const modal = new CreateIntervalNoteModal(
      {} as never,
      { year: 2026, month: 7, day: 20 },
      createTranslator("en", "en"),
      onSubmit,
      undefined,
      { year: 2026, month: 7, day: 16 },
    );

    (modal as unknown as { submit(): void }).submit();

    expect(onSubmit).toHaveBeenCalledWith(
      { year: 2026, month: 7, day: 20 },
      { year: 2026, month: 7, day: 16 },
    );
  });
});
