import { Modal, Setting, type App } from "obsidian";

import {
  createNoteCreationConfirmationDecision,
  type NoteCreationConfirmationDecision,
} from "../../features/notes/note-creation-confirmation";
import type { Translator } from "../../shared/i18n";
import { getCreationModalMessages } from "./creation-modal-presentation";

export class ConfirmPeriodicNoteModal extends Modal {
  private settled = false;
  private suppressFutureConfirmation = false;
  private resolveResult: ((decision: NoteCreationConfirmationDecision) => void) | null = null;

  constructor(
    app: App,
    private readonly path: string,
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
    this.titleEl.setText(messages.createPeriodicTitle);
    this.contentEl.createEl("p", { text: this.path });
    new Setting(this.contentEl)
      .setName(messages.suppressFuturePeriodicConfirmation)
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
