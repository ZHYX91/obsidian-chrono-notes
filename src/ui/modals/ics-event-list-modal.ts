import { Modal, type App } from "obsidian";

import type { IcsEventOccurrence } from "../../core/calendar/ics-calendar";
import {
  formatLocalDateKey,
  type LocalDate,
} from "../../core/periodic/periodic-date";
import type { Translator } from "../../shared/i18n";
import { formatCalendarIcsEventLabel } from "../calendar/calendar-ics-presentation";

export class IcsEventListModal extends Modal {
  constructor(
    app: App,
    private readonly date: LocalDate,
    private readonly events: readonly IcsEventOccurrence[],
    private readonly translator: Translator,
  ) {
    super(app);
  }

  override onOpen(): void {
    const { t } = this.translator;
    this.titleEl.setText(
      `${t("dateContextMenu.viewCalendarEvents")} · ${formatLocalDateKey(this.date)}`,
    );
    this.contentEl.empty();

    const list = this.contentEl.createEl("ul");
    for (const event of this.events) {
      const item = list.createEl("li");
      item.createEl("strong", {
        text: formatCalendarIcsEventLabel(event, t),
      });
      item.createDiv({
        text: t("calendar.ics.source", { source: event.sourceLabel }),
      });
    }
  }

  override onClose(): void {
    this.contentEl.empty();
  }
}
