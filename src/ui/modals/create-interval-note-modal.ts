import { Modal, Notice, Setting, type App } from "obsidian";

import {
  formatLocalDateKey,
  parseLocalDateKey,
  shiftPeriod,
  toDateTime,
  type LocalDate,
} from "../../core/periodic/periodic-date";
import type { Translator } from "../../shared/i18n";
import { getCreationModalMessages } from "./creation-modal-presentation";

export class CreateIntervalNoteModal extends Modal {
  private startValue: string;
  private endValue: string;
  private settled = false;

  constructor(
    app: App,
    initialDate: LocalDate,
    private readonly translator: Translator,
    private readonly onSubmit: (start: LocalDate, end: LocalDate) => void,
    private readonly onCancel?: () => void,
    initialEndDate?: LocalDate,
  ) {
    super(app);
    this.startValue = formatLocalDateKey(initialDate);
    this.endValue = formatLocalDateKey(
      initialEndDate ?? shiftPeriod(initialDate, "daily", 1, "monday"),
    );
  }

  override onOpen(): void {
    const messages = getCreationModalMessages(this.translator.t);
    this.titleEl.setText(messages.createRangeTitle);
    this.contentEl.createEl("p", {
      text: messages.rangeInstructions,
    });
    new Setting(this.contentEl).setName(messages.startDate).addText((text) => {
      text.setPlaceholder("2026-07-04").setValue(this.startValue).onChange((value) => {
        this.startValue = value.trim();
      });
    });
    new Setting(this.contentEl).setName(messages.endDate).addText((text) => {
      text.setPlaceholder("2026-07-10").setValue(this.endValue).onChange((value) => {
        this.endValue = value.trim();
      });
    });
    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText(messages.cancel).onClick(() => this.close()))
      .addButton((button) => {
        button.setButtonText(messages.continue).setCta().onClick(() => this.submit());
      });
  }

  override onClose(): void {
    this.contentEl.empty();
    if (this.settled) return;
    this.settled = true;
    this.onCancel?.();
  }

  private submit(): void {
    const start = parseLocalDateKey(this.startValue);
    const end = parseLocalDateKey(this.endValue);
    if (start === null || end === null || toDateTime(start).equals(toDateTime(end))) {
      new Notice(getCreationModalMessages(this.translator.t).invalidRange);
      return;
    }
    this.settled = true;
    this.close();
    this.onSubmit(start, end);
  }
}
