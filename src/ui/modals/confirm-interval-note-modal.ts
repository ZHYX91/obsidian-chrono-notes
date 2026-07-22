import { Modal, Setting, type App } from "obsidian";

import type { IntervalNoteSpec } from "../../core/note/interval-note-spec";
import {
  createNoteCreationConfirmationDecision,
  type NoteCreationConfirmationDecision,
} from "../../features/notes/note-creation-confirmation";
import type { Translator } from "../../shared/i18n";
import {
  formatIntervalSummary,
  getCreationModalMessages,
} from "./creation-modal-presentation";

export class ConfirmIntervalNoteModal extends Modal {
  private settled = false;
  private suppressFutureConfirmation = false;
  private resolveResult: ((decision: NoteCreationConfirmationDecision) => void) | null = null;

  constructor(
    app: App,
    private readonly spec: IntervalNoteSpec,
    private readonly translator: Translator,
  ) {
    super(app);
  }

  confirm(): Promise<NoteCreationConfirmationDecision> {
    return new Promise((resolve) => {
      this.resolveResult = resolve;
      this.open();
    });
  }

  override onOpen(): void {
    const messages = getCreationModalMessages(this.translator.t);
    this.titleEl.setText(messages.confirmRangeTitle);
    this.contentEl.createEl("p", {
      text: formatIntervalSummary(this.spec.title, this.spec.dayCount, this.translator.t),
    });
    new Setting(this.contentEl).setName(messages.targetPath).setDesc(this.spec.path);
    new Setting(this.contentEl)
      .setName(messages.suppressFutureIntervalConfirmation)
      .addToggle((toggle) => {
        toggle.setValue(false).onChange((value) => {
          this.suppressFutureConfirmation = value;
        });
      });
    new Setting(this.contentEl)
      .addButton((button) => {
        button.setButtonText(messages.cancel).onClick(() => this.finish(false));
      })
      .addButton((button) => {
        button.setButtonText(messages.create).setCta().onClick(() => this.finish(true));
      });
  }

  override onClose(): void {
    this.contentEl.empty();
    if (!this.settled) this.finish(false);
  }

  private finish(confirmed: boolean): void {
    if (this.settled) return;
    this.settled = true;
    this.resolveResult?.(createNoteCreationConfirmationDecision(
      confirmed,
      this.suppressFutureConfirmation,
    ));
    this.resolveResult = null;
    this.close();
  }
}
