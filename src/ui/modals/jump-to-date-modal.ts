import { Modal, Notice, Setting, type App } from "obsidian";

import type { LocalDate } from "../../core/periodic/periodic-date";
import { formatLocalDateKey } from "../../core/periodic/periodic-date";
import { parseDateInput } from "../../features/calendar/date-picker";
import type { Translator } from "../../shared/i18n";
import { getDateModalMessages } from "./date-modal-presentation";

export class JumpToDateModal extends Modal {
  private input: HTMLInputElement | null = null;
  private submitting = false;

  constructor(
    app: App,
    private readonly initialDate: LocalDate,
    private readonly translator: Translator,
    private readonly onSelect: (date: LocalDate) => void | Promise<void>,
  ) {
    super(app);
  }

  override onOpen(): void {
    const messages = getDateModalMessages(this.translator.t);
    this.titleEl.setText(messages.jumpToDate);
    this.contentEl.empty();
    this.input = this.contentEl.createEl("input", {
      cls: "prompt-input",
      attr: {
        type: "text",
        placeholder: "2026-05-06",
        "aria-label": messages.date,
      },
    });
    this.input.value = formatLocalDateKey(this.initialDate);
    this.contentEl.createEl("p", {
      cls: "chrono-notes-date-input-hint",
      text: messages.formats,
    });
    this.input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      void this.submit();
    });
    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText(messages.cancel).onClick(() => this.close()))
      .addButton((button) => button
        .setButtonText(messages.jump)
        .setCta()
        .onClick(() => void this.submit()));
    window.setTimeout(() => {
      this.input?.focus();
      this.input?.select();
    }, 0);
  }

  override onClose(): void {
    this.contentEl.empty();
    this.input = null;
    this.submitting = false;
  }

  private async submit(): Promise<void> {
    if (this.submitting) return;
    const date = parseDateInput(this.input?.value ?? "");
    if (date === null) {
      new Notice(getDateModalMessages(this.translator.t).invalidDate);
      this.input?.focus();
      this.input?.select();
      return;
    }
    this.submitting = true;
    try {
      await this.onSelect(date);
      this.close();
    } finally {
      this.submitting = false;
    }
  }
}
