import { Modal, Platform, Setting, type App } from "obsidian";

import type { Translator } from "../../shared/i18n";
import { getFirstUseGuideMessages } from "./first-use-guide-presentation";

export class FirstUseGuideModal extends Modal {
  constructor(
    app: App,
    private readonly translator: Translator,
    private readonly onOpenSettings: () => void,
  ) {
    super(app);
  }

  override onOpen(): void {
    const messages = getFirstUseGuideMessages(
      this.translator.t,
      Platform.isMacOS ? "Cmd" : "Ctrl",
    );
    this.titleEl.setText(messages.title);
    this.contentEl.createEl("p", { text: messages.intro });
    const list = this.contentEl.createEl("ul");
    for (const hint of messages.hints) list.createEl("li", { text: hint });
    new Setting(this.contentEl)
      .addButton((button) => {
        button.setButtonText(messages.openSettings).onClick(() => {
          this.close();
          this.onOpenSettings();
        });
      })
      .addButton((button) => {
        button.setButtonText(messages.dismiss).setCta().onClick(() => this.close());
      });
  }

  override onClose(): void {
    this.contentEl.empty();
  }
}
