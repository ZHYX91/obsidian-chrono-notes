import { Modal, type App } from "obsidian";

import type {
  CalendarPickerModalHost,
  CalendarPickerModalSession,
} from "../calendar/calendar-picker-layer";

export function createCalendarPickerModalHost(
  app: App,
): CalendarPickerModalHost {
  return Object.freeze({
    open: (title: string, onRequestClose: () => void) => {
      const modal = new CalendarPickerModal(app, title, onRequestClose);
      modal.open();
      return Object.freeze({
        mount: modal.getMount(),
        close: () => modal.dispose(),
      }) satisfies CalendarPickerModalSession;
    },
  });
}

class CalendarPickerModal extends Modal {
  private disposed = false;
  private mount: HTMLElement | null = null;

  constructor(
    app: App,
    private readonly pickerTitle: string,
    private readonly onRequestClose: () => void,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.titleEl.setText(this.pickerTitle);
    this.modalEl.addClass("chrono-notes-calendar-picker-modal");
    this.contentEl.empty();
    this.mount = this.contentEl.createDiv();
  }

  override onClose(): void {
    this.mount = null;
    if (!this.disposed) this.onRequestClose();
  }

  getMount(): HTMLElement {
    if (this.mount === null) {
      throw new Error("Calendar picker modal did not create its mount");
    }
    return this.mount;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.close();
  }
}
